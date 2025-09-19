# transcription.py - Enhanced transcription with multiple backends
import os
import time
import queue
import uuid
import threading
import logging
from collections import defaultdict
import base64

# Try to import optional dependencies
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import speech_recognition as sr
    SPEECH_RECOGNITION_AVAILABLE = True
except ImportError:
    SPEECH_RECOGNITION_AVAILABLE = False

# Configuration
rooms = defaultdict(lambda: {"transcript": [], "chunk_queue": queue.Queue()})
audio_workers = {}
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

# Setup logging
logger = logging.getLogger(__name__)

def get_transcription_backend():
    """Determine which transcription backend to use"""
    if OPENAI_API_KEY and OPENAI_AVAILABLE:
        return "openai"
    elif SPEECH_RECOGNITION_AVAILABLE:
        return "speech_recognition"
    else:
        return "mock"

def handle_audio_chunk(room, b64, ts=None, seq=None):
    """Add base64 audio chunk into the queue for transcription"""
    if not b64:
        return
    try:
        raw = base64.b64decode(b64)
        rooms[room]["chunk_queue"].put((ts or time.time(), seq or 0, raw))
    except Exception as e:
        logger.error(f"Error handling audio chunk: {e}")

def audio_worker_for_room(room, socketio):
    """Background worker for transcription"""
    q = rooms[room]["chunk_queue"]
    buffer, last_flush = [], time.time()
    FLUSH_SECONDS = 3
    backend = get_transcription_backend()

    logger.info(f"Starting audio worker for room {room} with backend: {backend}")

    while True:
        try:
            try:
                item = q.get(timeout=FLUSH_SECONDS)
                buffer.append(item)
            except queue.Empty:
                pass

            now = time.time()
            if buffer and (now - last_flush >= FLUSH_SECONDS):
                buffer.sort(key=lambda x: (x[0], x[1]))
                combined = b''.join([b for (_, _, b) in buffer])
                buffer, last_flush = [], now

                # Only process if we have substantial audio data
                if len(combined) > 1024:  # At least 1KB of audio
                    text = transcribe_audio_data(combined, backend)
                    if text and text.strip():
                        entry = {
                            "ts": int(now),
                            "text": text.strip(),
                            "backend": backend
                        }
                        rooms[room]["transcript"].append(entry)
                        socketio.emit('transcript-update', {"room": room, "entry": entry}, room=room)
                        logger.info(f"Transcribed: {text[:50]}...")

        except Exception as e:
            logger.error(f"Audio worker error: {e}")
            time.sleep(1)

def transcribe_audio_data(audio_data, backend="mock"):
    """Transcribe audio data using the specified backend"""
    try:
        if backend == "openai" and OPENAI_AVAILABLE:
            return transcribe_with_openai(audio_data)
        elif backend == "speech_recognition" and SPEECH_RECOGNITION_AVAILABLE:
            return transcribe_with_speech_recognition(audio_data)
        else:
            return transcribe_mock(audio_data)
    except Exception as e:
        logger.error(f"Transcription error with {backend}: {e}")
        return None

def transcribe_with_openai(audio_data):
    """Transcribe using OpenAI Whisper API"""
    try:
        # Save audio data to temporary file
        uid = uuid.uuid4().hex
        temp_path = f"/tmp/audio_{uid}.wav"

        with open(temp_path, "wb") as f:
            f.write(audio_data)

        # Use OpenAI Whisper
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        with open(temp_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text"
            )

        # Clean up
        try:
            os.remove(temp_path)
        except:
            pass

        return transcript.strip() if transcript else None

    except Exception as e:
        logger.error(f"OpenAI transcription error: {e}")
        return None

def transcribe_with_speech_recognition(audio_data):
    """Transcribe using SpeechRecognition library"""
    try:
        # This is a simplified implementation
        # In practice, you'd need to convert the audio format properly
        r = sr.Recognizer()

        # Save audio data to temporary file
        uid = uuid.uuid4().hex
        temp_path = f"/tmp/audio_{uid}.wav"

        with open(temp_path, "wb") as f:
            f.write(audio_data)

        # Load audio file
        with sr.AudioFile(temp_path) as source:
            audio = r.record(source)

        # Recognize speech using Google Speech Recognition
        text = r.recognize_google(audio)

        # Clean up
        try:
            os.remove(temp_path)
        except:
            pass

        return text.strip() if text else None

    except sr.UnknownValueError:
        # Speech was unintelligible
        return None
    except sr.RequestError as e:
        logger.error(f"Speech recognition service error: {e}")
        return None
    except Exception as e:
        logger.error(f"Speech recognition error: {e}")
        return None

def transcribe_mock(audio_data):
    """Mock transcription for testing"""
    # Simulate processing time
    time.sleep(0.1)

    # Return mock text based on audio data size
    if len(audio_data) > 5000:
        return "This is a longer speech segment detected by the mock transcription service."
    elif len(audio_data) > 2000:
        return "Speech detected by mock transcription."
    else:
        return "Brief audio detected."

def transcribe_audio_file(path):
    """Legacy function for backward compatibility"""
    backend = get_transcription_backend()
    try:
        with open(path, "rb") as f:
            audio_data = f.read()
        return transcribe_audio_data(audio_data, backend)
    except Exception as e:
        logger.error(f"Error transcribing file {path}: {e}")
        return "[transcription error]"

def start_transcription_worker(room, socketio):
    """Start a transcription worker for a room if not already running"""
    if room not in audio_workers:
        worker_thread = threading.Thread(
            target=audio_worker_for_room,
            args=(room, socketio),
            daemon=True
        )
        worker_thread.start()
        audio_workers[room] = worker_thread
        logger.info(f"Started transcription worker for room: {room}")

def stop_transcription_worker(room):
    """Stop transcription worker for a room"""
    if room in audio_workers:
        # Note: This is a simplified stop mechanism
        # In production, you'd want a more graceful shutdown
        del audio_workers[room]
        logger.info(f"Stopped transcription worker for room: {room}")

def get_room_transcript(room):
    """Get the full transcript for a room"""
    return rooms[room]["transcript"]

def clear_room_transcript(room):
    """Clear transcript for a room"""
    rooms[room]["transcript"] = []
    logger.info(f"Cleared transcript for room: {room}")

def get_transcription_stats():
    """Get statistics about transcription service"""
    backend = get_transcription_backend()
    return {
        "backend": backend,
        "openai_available": OPENAI_AVAILABLE,
        "speech_recognition_available": SPEECH_RECOGNITION_AVAILABLE,
        "active_rooms": len(audio_workers),
        "total_rooms": len(rooms)
    }
