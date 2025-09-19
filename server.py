# server.py - Complete implementation with all features
# Adaptive async mode for local development and production deployment

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, join_room, leave_room, emit
from collections import defaultdict
import logging
import os
import time
from datetime import datetime

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("agamai-platform")

app = Flask(__name__, template_folder="templates", static_folder="static")
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'agamai-secret-key-2024')

# Determine the best async mode based on available packages
def get_async_mode():
    """Determine the best async mode for the environment"""
    try:
        import gevent
        return 'gevent'
    except ImportError:
        try:
            import eventlet
            return 'eventlet'
        except ImportError:
            return 'threading'

ASYNC_MODE = get_async_mode()
log.info(f"Using async mode: {ASYNC_MODE}")

socketio = SocketIO(
    app,
    cors_allowed_origins='*',
    async_mode=ASYNC_MODE,
    logger=False,
    engineio_logger=False,
    ping_timeout=60,
    ping_interval=25
)

# Global state
rooms = defaultdict(set)
room_data = defaultdict(lambda: {
    "transcript": [],
    "participants": {},
    "engagement": {},
    "sentiment_history": [],
    "meeting_start": time.time(),
    "network_stats": {},
    "attention_scores": defaultdict(list)
})

# Import feature modules safely
try:
    from transcription import (
        handle_audio_chunk,
        audio_worker_for_room,
        rooms as trans_rooms,
        audio_workers,
        start_transcription_worker,
        get_transcription_stats
    )
    TRANSCRIPTION_ENABLED = True
    log.info("Transcription module loaded successfully")
except Exception as e:
    log.warning("Transcription module not available: %s", e)
    TRANSCRIPTION_ENABLED = False
    handle_audio_chunk = audio_worker_for_room = trans_rooms = audio_workers = None
    start_transcription_worker = get_transcription_stats = None

try:
    from summarizer import summarize_and_extract, get_summary_stats, GEMINI_AVAILABLE
    SUMMARIZER_ENABLED = True
    log.info(f"Summarizer module loaded successfully (Gemini AI: {'Available' if GEMINI_AVAILABLE else 'Fallback mode'})")
except Exception as e:
    log.warning("Summarizer module not available: %s", e)
    SUMMARIZER_ENABLED = False
    summarize_and_extract = get_summary_stats = None
    GEMINI_AVAILABLE = False

try:
    from network_adaptation import evaluate_network
    NETWORK_ADAPTATION_ENABLED = True
    log.info("Network adaptation module loaded successfully")
except Exception as e:
    log.warning("Network adaptation module not available: %s", e)
    NETWORK_ADAPTATION_ENABLED = False
    evaluate_network = None

try:
    from engagement import (
        update_engagement,
        get_room_leaderboard,
        get_speaking_distribution,
        should_nudge_participant,
        calculate_meeting_insights
    )
    ENGAGEMENT_ENABLED = True
    log.info("Engagement module loaded successfully")
except Exception as e:
    log.warning("Engagement module not available: %s", e)
    ENGAGEMENT_ENABLED = False
    update_engagement = get_room_leaderboard = get_speaking_distribution = None
    should_nudge_participant = calculate_meeting_insights = None

try:
    from sentiment_analysis import (
        update_room_sentiment,
        get_sentiment_graph,
        analyze_sentiment,
        detect_sentiment_alerts
    )
    SENTIMENT_ENABLED = True
    log.info("Sentiment analysis module loaded successfully")
except Exception as e:
    log.warning("Sentiment analysis module not available: %s", e)
    SENTIMENT_ENABLED = False
    update_room_sentiment = get_sentiment_graph = None
    analyze_sentiment = detect_sentiment_alerts = None

# CORS headers
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health_check():
    # Get transcription stats if available
    transcription_stats = {}
    if TRANSCRIPTION_ENABLED and get_transcription_stats:
        transcription_stats = get_transcription_stats()

    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "features": {
            "transcription": TRANSCRIPTION_ENABLED,
            "summarization": SUMMARIZER_ENABLED,
            "gemini_ai": GEMINI_AVAILABLE if SUMMARIZER_ENABLED else False,
            "network_adaptation": NETWORK_ADAPTATION_ENABLED,
            "engagement": ENGAGEMENT_ENABLED,
            "sentiment": SENTIMENT_ENABLED
        },
        "active_rooms": len(rooms),
        "total_participants": sum(len(participants) for participants in rooms.values()),
        "transcription_stats": transcription_stats
    })

@app.route('/transcription/status')
def transcription_status():
    if not TRANSCRIPTION_ENABLED:
        return jsonify({"error": "Transcription not available"}), 500

    stats = get_transcription_stats() if get_transcription_stats else {}
    return jsonify({
        "status": "active" if TRANSCRIPTION_ENABLED else "disabled",
        "stats": stats,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/summarize', methods=['POST'])
def summarize():
    if not SUMMARIZER_ENABLED:
        return jsonify({"error": "Summarizer not available"}), 500

    data = request.get_json(force=True)
    room = data.get("room", "default")
    include_sentiment = data.get("include_sentiment", True)
    include_action_items = data.get("include_action_items", True)

    # Get transcript from room data
    transcript_entries = room_data[room]["transcript"]
    transcript_text = " ".join([entry.get("text", "") for entry in transcript_entries])

    if not transcript_text.strip():
        return jsonify({
            "error": "No transcript available",
            "result": "No content to summarize",
            "stats": {"word_count": 0, "transcript_length": 0}
        }), 200

    try:
        # Generate AI summary
        result = summarize_and_extract(
            transcript_text,
            include_sentiment=include_sentiment,
            include_action_items=include_action_items
        )

        # Get transcript statistics
        stats = get_summary_stats(transcript_text) if get_summary_stats else {
            "word_count": len(transcript_text.split()),
            "sentence_count": len([s for s in transcript_text.split('.') if s.strip()]),
            "estimated_duration": len(transcript_text.split()) / 150,
            "key_topics": []
        }

        # Get meeting insights if available
        insights = {}
        if ENGAGEMENT_ENABLED and calculate_meeting_insights:
            insights = calculate_meeting_insights(room_data[room])

        return jsonify({
            "room": room,
            "result": result,
            "transcript_length": len(transcript_entries),
            "timestamp": datetime.now().isoformat(),
            "stats": stats,
            "insights": insights,
            "ai_backend": "Gemini AI" if GEMINI_AVAILABLE else "Fallback"
        })
    except Exception as e:
        log.error(f"Summarization error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/adapt', methods=['POST'])
def adapt():
    if not NETWORK_ADAPTATION_ENABLED:
        return jsonify({"mode": "normal", "error": "Network adaptation not available"}), 200
    
    stats = request.get_json(force=True) or {}
    try:
        mode = evaluate_network(stats)
        return jsonify({"mode": mode, "stats": stats})
    except Exception as e:
        log.error(f"Network adaptation error: {e}")
        return jsonify({"mode": "normal", "error": str(e)}), 200

@app.route('/engagement/<room>', methods=['GET'])
def get_engagement_data(room):
    try:
        data = room_data[room]
        
        # Calculate engagement metrics
        participants = []
        for sid, participant_data in data["participants"].items():
            attention_scores = data["attention_scores"].get(sid, [])
            avg_attention = sum(attention_scores) / len(attention_scores) if attention_scores else 0
            
            participants.append({
                "sid": sid,
                "name": participant_data.get("name", f"User {sid[:8]}"),
                "engagement_score": participant_data.get("engagement_score", 0.5),
                "speaking_time": participant_data.get("speaking_time", 0),
                "avg_attention": avg_attention,
                "last_activity": participant_data.get("last_activity", time.time())
            })
        
        # Sort by engagement score
        participants.sort(key=lambda x: x["engagement_score"], reverse=True)
        
        # Assign titles
        leaderboard = []
        for i, p in enumerate(participants):
            if i == 0 and len(participants) > 1:
                p["title"] = "🏆 Meeting Champ"
            elif i == len(participants) - 1 and len(participants) > 1:
                p["title"] = "🤫 Silent Listener"
            else:
                p["title"] = f"#{i+1} Participant"
            leaderboard.append(p)
        
        # Calculate speaking distribution
        total_speaking = sum(p["speaking_time"] for p in participants)
        speaking_distribution = {}
        
        for p in participants:
            speaking_distribution[p["sid"]] = {
                "time": p["speaking_time"],
                "percentage": (p["speaking_time"] / total_speaking * 100) if total_speaking > 0 else 0,
                "name": p["name"]
            }
        
        return jsonify({
            "room": room,
            "leaderboard": leaderboard,
            "speaking_distribution": speaking_distribution,
            "total_participants": len(participants),
            "meeting_duration": time.time() - data["meeting_start"]
        })
        
    except Exception as e:
        log.error(f"Engagement data error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/sentiment/<room>', methods=['GET'])
def get_sentiment_data(room):
    try:
        sentiment_history = room_data[room]["sentiment_history"]
        
        # Format sentiment data for frontend
        formatted_data = []
        for entry in sentiment_history[-50:]:  # Last 50 entries
            formatted_data.append({
                "timestamp": entry["timestamp"],
                "score": entry["score"],
                "trend": "positive" if entry["score"] > 0.2 else "negative" if entry["score"] < -0.2 else "neutral",
                "text_snippet": entry.get("text", "")[:50]
            })
        
        # Calculate overall sentiment
        recent_scores = [entry["score"] for entry in sentiment_history[-10:]]
        overall_sentiment = sum(recent_scores) / len(recent_scores) if recent_scores else 0
        
        return jsonify({
            "room": room,
            "sentiment_history": formatted_data,
            "overall_sentiment": overall_sentiment,
            "trend": "positive" if overall_sentiment > 0.2 else "negative" if overall_sentiment < -0.2 else "neutral"
        })
        
    except Exception as e:
        log.error(f"Sentiment data error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/transcript/<room>', methods=['GET'])
def get_transcript(room):
    try:
        transcript = room_data[room]["transcript"]
        return jsonify({
            "room": room,
            "transcript": transcript,
            "total_entries": len(transcript)
        })
    except Exception as e:
        log.error(f"Transcript error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/nudge', methods=['POST'])
def nudge_participants():
    data = request.get_json(force=True)
    room = data.get("room", "default")
    
    try:
        nudged = []
        room_participants = room_data[room]["participants"]
        current_time = time.time()
        
        for sid, participant_data in room_participants.items():
            last_activity = participant_data.get("last_activity", current_time)
            engagement_score = participant_data.get("engagement_score", 0.5)
            
            # Nudge if inactive for more than 5 minutes and low engagement
            if (current_time - last_activity > 300) and engagement_score < 0.3:
                socketio.emit('nudge', {
                    "message": "You've been quiet for a while. Would you like to share your thoughts?",
                    "type": "engagement"
                }, room=sid)
                nudged.append(sid)
        
        return jsonify({"nudged": nudged, "count": len(nudged)})
        
    except Exception as e:
        log.error(f"Nudge error: {e}")
        return jsonify({"error": str(e)}), 500

# Socket.IO Events
@socketio.on('connect')
def on_connect():
    log.info(f"Client connected: {request.sid}")
    emit('connected', {"sid": request.sid})

@socketio.on('disconnect')
def on_disconnect():
    log.info(f"Client disconnected: {request.sid}")
    # Clean up from all rooms
    for room in list(rooms.keys()):
        if request.sid in rooms[room]:
            rooms[room].discard(request.sid)
            if request.sid in room_data[room]["participants"]:
                del room_data[room]["participants"][request.sid]
            emit('peer-left', {"sid": request.sid}, room=room)
            
            if not rooms[room]:  # Room is empty
                del rooms[room]
                del room_data[room]

@socketio.on('join')
def on_join(data):
    room = data.get('room', 'default')
    join_room(room)
    
    # Add to room
    rooms[room].add(request.sid)
    
    # Initialize participant data
    room_data[room]["participants"][request.sid] = {
        "name": data.get("name", f"User {request.sid[:8]}"),
        "joined_at": time.time(),
        "last_activity": time.time(),
        "speaking_time": 0,
        "engagement_score": 0.5,
        "attention_scores": []
    }
    
    # Send existing peers to new participant
    existing_peers = [sid for sid in rooms[room] if sid != request.sid]
    emit('existing-peers', {"peers": existing_peers})
    
    # Notify others about new peer
    emit('new-peer', {"peer": request.sid}, room=room, include_self=False)
    
    log.info(f"User {request.sid} joined room {room}")

@socketio.on('leave')
def on_leave(data):
    room = data.get('room', 'default')
    leave_room(room)
    
    if request.sid in rooms[room]:
        rooms[room].discard(request.sid)
        if request.sid in room_data[room]["participants"]:
            del room_data[room]["participants"][request.sid]
        
        emit('peer-left', {"sid": request.sid}, room=room)
        
        if not rooms[room]:  # Room is empty
            del rooms[room]
            del room_data[room]
    
    log.info(f"User {request.sid} left room {room}")

@socketio.on('offer')
def handle_offer(data):
    target = data.get('to')
    sdp = data.get('sdp')
    log.info(f"Forwarding offer from {request.sid} to {target}")
    emit('offer', {'sdp': sdp, 'from': request.sid}, to=target)

@socketio.on('answer')
def handle_answer(data):
    target = data.get('to')
    sdp = data.get('sdp')
    log.info(f"Forwarding answer from {request.sid} to {target}")
    emit('answer', {'sdp': sdp, 'from': request.sid}, to=target)

@socketio.on('ice-candidate')
def handle_ice(data):
    target = data.get('to')
    candidate = data.get('candidate')
    log.info(f"Forwarding ICE candidate from {request.sid} to {target}")
    emit('ice-candidate', {'candidate': candidate, 'from': request.sid}, to=target)

@socketio.on('audio-chunk')
def handle_audio_chunk(data):
    """Handle audio chunks for server-side transcription"""
    room = data.get('room', 'default')
    audio_data = data.get('audio')
    ts = data.get('ts', time.time())
    seq = data.get('seq', 0)
    from_sid = data.get('from', request.sid)  # Speaker ID

    if not audio_data:
        return

    try:
        # Import transcription module if available
        if TRANSCRIPTION_ENABLED:
            from transcription import handle_audio_chunk, start_transcription_worker
            handle_audio_chunk(room, audio_data, ts, seq, from_sid)
            start_transcription_worker(room, socketio)
            log.info(f"Processing audio chunk from {from_sid} in room {room}")
        else:
            log.warning("Transcription not enabled, ignoring audio chunk")
    except Exception as e:
        log.error(f"Error handling audio chunk: {e}")

@socketio.on('transcript-text')
def handle_transcript_text(data):
    room = data.get('room', 'default')
    text = data.get('text', '').strip()
    ts = int(data.get('ts') or time.time())

    if not text:
        return

    # Store transcript
    entry = {
        "ts": ts,
        "text": text,
        "sid": request.sid,
        "speaker": room_data[room]["participants"].get(request.sid, {}).get("name", f"User {request.sid[:8]}")
    }

    room_data[room]["transcript"].append(entry)

    # Update participant activity and engagement
    if request.sid in room_data[room]["participants"]:
        participant = room_data[room]["participants"][request.sid]
        participant["last_activity"] = time.time()
        participant["speaking_time"] += len(text.split()) * 0.5  # Estimate speaking time

        # Update engagement using the engagement module
        if ENGAGEMENT_ENABLED:
            words_count = len(text.split())
            update_engagement(room_data[room], request.sid, "speaking", words_count)
        else:
            # Fallback engagement calculation
            words_count = len(text.split())
            engagement_boost = min(0.1, words_count / 50)
            participant["engagement_score"] = min(1.0, participant["engagement_score"] + engagement_boost)

    # Analyze sentiment using the sentiment analysis module
    if SENTIMENT_ENABLED:
        sentiment_score = update_room_sentiment(room_data[room], text, request.sid)
    else:
        # Fallback sentiment analysis
        sentiment_score = analyze_simple_sentiment(text)
        room_data[room]["sentiment_history"].append({
            "timestamp": ts,
            "score": sentiment_score,
            "text": text[:100],
            "speaker": request.sid
        })

    # Add sentiment to entry
    entry["sentiment"] = sentiment_score

    # Check for sentiment alerts
    if SENTIMENT_ENABLED:
        alert = detect_sentiment_alerts(room_data[room])
        if alert["alert"]:
            emit('sentiment-alert', alert, room=room)

    # Broadcast transcript update
    emit('transcript-update', {"room": room, "entry": entry}, room=room)

    log.info(f"Transcript from {request.sid} in {room}: {text[:50]}...")

    # Auto-generate summary if transcript is getting long
    transcript_length = len(room_data[room]["transcript"])
    if transcript_length > 0 and transcript_length % 20 == 0:  # Every 20 entries
        emit('auto-summary-available', {
            "room": room,
            "transcript_length": transcript_length,
            "message": f"Auto-summary available ({transcript_length} transcript entries)"
        }, room=room)

@socketio.on('attention')
def handle_attention(data):
    room = data.get('room', 'default')
    score = float(data.get('score', 0.0))
    
    # Store attention score
    room_data[room]["attention_scores"][request.sid].append(score)
    
    # Keep only last 20 scores
    if len(room_data[room]["attention_scores"][request.sid]) > 20:
        room_data[room]["attention_scores"][request.sid] = room_data[room]["attention_scores"][request.sid][-20:]
    
    # Update participant data
    if request.sid in room_data[room]["participants"]:
        participant = room_data[room]["participants"][request.sid]
        participant["last_activity"] = time.time()
        
        # Update engagement based on attention
        attention_scores = room_data[room]["attention_scores"][request.sid]
        avg_attention = sum(attention_scores) / len(attention_scores)
        participant["engagement_score"] = (participant["engagement_score"] * 0.7) + (avg_attention * 0.3)
    
    # Broadcast attention update
    emit('attention-update', {"sid": request.sid, "score": score}, room=room)

@socketio.on('network-stats')
def handle_network_stats(data):
    room = data.get('room', 'default')
    stats = data.get('stats', {})
    
    # Store network stats
    room_data[room]["network_stats"][request.sid] = {
        "timestamp": time.time(),
        "rtt": stats.get("rtt", 0),
        "packet_loss": stats.get("packet_loss", 0),
        "bandwidth": stats.get("bandwidth", 1000)
    }
    
    # Evaluate network and suggest adaptation
    if NETWORK_ADAPTATION_ENABLED:
        try:
            mode = evaluate_network(stats)
            emit('network-adaptation', {"mode": mode, "stats": stats})
        except Exception as e:
            log.error(f"Network adaptation error: {e}")

def analyze_simple_sentiment(text):
    """Simple sentiment analysis"""
    positive_words = {'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'happy', 'excited', 'agree', 'yes', 'perfect', 'awesome', 'brilliant'}
    negative_words = {'bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'angry', 'frustrated', 'disagree', 'no', 'wrong', 'problem', 'issue', 'concern', 'worried'}
    
    words = text.lower().split()
    positive_count = sum(1 for word in words if word in positive_words)
    negative_count = sum(1 for word in words if word in negative_words)
    
    if len(words) == 0:
        return 0
    
    sentiment = (positive_count - negative_count) / len(words)
    return max(-1, min(1, sentiment * 5))

if __name__ == '__main__':
    try:
        # Render uses PORT environment variable
        PORT = int(os.environ.get("PORT", 5000))
        DEBUG = os.environ.get("FLASK_ENV") != "production"
        HOST = '0.0.0.0'  # Required for Render deployment

        print(f"🚀 Starting AgamAI Meeting Platform")
        print(f"📡 Server: http://{HOST}:{PORT}")
        print(f"🔧 Debug mode: {DEBUG}")
        print(f"🌍 Environment: {'Production' if not DEBUG else 'Development'}")
        print(f"🎯 Features enabled:")
        print(f"   ✅ Transcription: {'Enabled' if TRANSCRIPTION_ENABLED else 'Disabled'}")
        print(f"   ✅ AI Summarization: {'Enabled' if SUMMARIZER_ENABLED else 'Disabled'}")
        print(f"   ✅ Network Adaptation: {'Enabled' if NETWORK_ADAPTATION_ENABLED else 'Disabled'}")
        print(f"   ✅ Engagement Tracking: {'Enabled' if ENGAGEMENT_ENABLED else 'Disabled'}")
        print(f"   ✅ Sentiment Analysis: {'Enabled' if SENTIMENT_ENABLED else 'Disabled'}")

        log.info(f"Starting AgamAI Meeting Platform on {HOST}:{PORT}")
        log.info(f"Debug mode: {DEBUG}")
        log.info(f"Features enabled: Transcription={TRANSCRIPTION_ENABLED}, Summarizer={SUMMARIZER_ENABLED}, Network={NETWORK_ADAPTATION_ENABLED}, Engagement={ENGAGEMENT_ENABLED}, Sentiment={SENTIMENT_ENABLED}")

        print("🌐 Starting SocketIO server...")
        print("=" * 50)

        socketio.run(
            app,
            host=HOST,
            port=PORT,
            debug=DEBUG,
            use_reloader=False,
            allow_unsafe_werkzeug=True
        )
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
