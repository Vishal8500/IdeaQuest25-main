# transcription.py - OpenAI Whisper tiny model transcription
import time
import queue
import threading
import logging
from collections import defaultdict
import base64

# Try to import Whisper
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False

# Load the tiny model once at startup
whisper_model = None
if WHISPER_AVAILABLE:
    try:
        whisper_model = whisper.load_model("tiny")
        print("Whisper tiny model loaded successfully")
    except Exception as e:
        print(f"Failed to load Whisper model: {e}")
        WHISPER_AVAILABLE = False

# Configuration
rooms = defaultdict(lambda: {"transcript": [], "chunk_queue": queue.Queue()})
audio_workers = {}

# Setup logging
logger = logging.getLogger(__name__)

def get_transcription_backend():
    """Determine which transcription backend to use"""
    if WHISPER_AVAILABLE and whisper_model is not None:
        return "whisper"
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
        if backend == "whisper" and WHISPER_AVAILABLE and whisper_model is not None:
            return transcribe_with_whisper(audio_data)
        else:
            return transcribe_mock(audio_data)
    except Exception as e:
        logger.error(f"Transcription error with {backend}: {e}")
        return None

def transcribe_with_whisper(audio_data):
    """Transcribe using local OpenAI Whisper tiny model"""
    try:
        import numpy as np
        import wave
        import io

        # Convert raw audio data to numpy array
        # Assume the audio_data is a WAV file in bytes
        audio_array = None

        try:
            # Try to parse as WAV file
            with io.BytesIO(audio_data) as audio_io:
                with wave.open(audio_io, 'rb') as wav_file:
                    # Get audio parameters
                    sample_rate = wav_file.getframerate()
                    n_channels = wav_file.getnchannels()
                    sample_width = wav_file.getsampwidth()
                    n_frames = wav_file.getnframes()

                    # Read audio data
                    raw_audio = wav_file.readframes(n_frames)

                    # Convert to numpy array
                    if sample_width == 1:
                        audio_array = np.frombuffer(raw_audio, dtype=np.uint8)
                        audio_array = (audio_array.astype(np.float32) - 128) / 128.0
                    elif sample_width == 2:
                        audio_array = np.frombuffer(raw_audio, dtype=np.int16)
                        audio_array = audio_array.astype(np.float32) / 32768.0
                    elif sample_width == 4:
                        audio_array = np.frombuffer(raw_audio, dtype=np.int32)
                        audio_array = audio_array.astype(np.float32) / 2147483648.0

                    # Handle stereo by taking the first channel
                    if n_channels > 1:
                        audio_array = audio_array.reshape(-1, n_channels)[:, 0]

                    # Resample to 16kHz if needed (Whisper expects 16kHz)
                    if sample_rate != 16000:
                        # Simple resampling (not ideal but works for testing)
                        target_length = int(len(audio_array) * 16000 / sample_rate)
                        audio_array = np.interp(
                            np.linspace(0, len(audio_array), target_length),
                            np.arange(len(audio_array)),
                            audio_array
                        )

        except Exception as wav_error:
            logger.error(f"Failed to parse WAV data: {wav_error}")
            return None

        if audio_array is None or len(audio_array) == 0:
            logger.error("No audio data to transcribe")
            return None

        # Use Whisper model for transcription with numpy array
        result = whisper_model.transcribe(audio_array, language="en")
        text = result["text"]

        return text.strip() if text else None

    except Exception as e:
        logger.error(f"Whisper transcription error: {e}")
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
        "whisper_available": WHISPER_AVAILABLE,
        "whisper_model_loaded": whisper_model is not None,
        "active_rooms": len(audio_workers),
        "total_rooms": len(rooms)
    }
