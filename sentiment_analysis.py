# sentiment_analysis.py - Real-time sentiment analysis for meeting transcripts
import time
import re
from collections import defaultdict

# Simple sentiment lexicon
POSITIVE_WORDS = {
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 
    'happy', 'excited', 'agree', 'yes', 'perfect', 'awesome', 'brilliant', 'outstanding',
    'superb', 'terrific', 'marvelous', 'fabulous', 'incredible', 'impressive', 'positive',
    'successful', 'effective', 'efficient', 'productive', 'valuable', 'beneficial',
    'helpful', 'useful', 'constructive', 'innovative', 'creative', 'inspiring'
}

NEGATIVE_WORDS = {
    'bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'angry', 'frustrated', 
    'disagree', 'no', 'wrong', 'problem', 'issue', 'concern', 'worried', 'disappointed',
    'upset', 'annoyed', 'irritated', 'confused', 'difficult', 'challenging', 'impossible',
    'failure', 'failed', 'broken', 'error', 'mistake', 'ineffective', 'useless',
    'pointless', 'waste', 'boring', 'tedious', 'overwhelming', 'stressful'
}

INTENSIFIERS = {
    'very': 1.5, 'really': 1.4, 'extremely': 1.8, 'incredibly': 1.7, 'absolutely': 1.6,
    'totally': 1.5, 'completely': 1.6, 'quite': 1.2, 'rather': 1.1, 'pretty': 1.1,
    'so': 1.3, 'too': 1.2, 'highly': 1.4, 'deeply': 1.3, 'truly': 1.4
}

NEGATIONS = {'not', 'no', 'never', 'nothing', 'nobody', 'nowhere', 'neither', 'nor', "don't", "won't", "can't", "shouldn't", "wouldn't", "couldn't", "isn't", "aren't", "wasn't", "weren't"}

def analyze_sentiment(text):
    """
    Analyze sentiment of text using lexicon-based approach
    
    Args:
        text: Input text to analyze
        
    Returns:
        Float between -1 (negative) and 1 (positive)
    """
    if not text or not text.strip():
        return 0.0
    
    # Clean and tokenize text
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)  # Remove punctuation
    words = text.split()
    
    if not words:
        return 0.0
    
    sentiment_score = 0.0
    word_count = 0
    
    i = 0
    while i < len(words):
        word = words[i]
        
        # Check for negation in the previous 2 words
        negated = False
        for j in range(max(0, i-2), i):
            if words[j] in NEGATIONS:
                negated = True
                break
        
        # Check for intensifiers in the previous word
        intensifier = 1.0
        if i > 0 and words[i-1] in INTENSIFIERS:
            intensifier = INTENSIFIERS[words[i-1]]
        
        # Calculate sentiment for current word
        word_sentiment = 0.0
        if word in POSITIVE_WORDS:
            word_sentiment = 1.0 * intensifier
        elif word in NEGATIVE_WORDS:
            word_sentiment = -1.0 * intensifier
        
        # Apply negation
        if negated and word_sentiment != 0:
            word_sentiment *= -0.8  # Reduce impact of negation slightly
        
        sentiment_score += word_sentiment
        if word_sentiment != 0:
            word_count += 1
        
        i += 1
    
    # Normalize by number of sentiment-bearing words
    if word_count > 0:
        sentiment_score = sentiment_score / word_count
    
    # Clamp to [-1, 1] range
    return max(-1.0, min(1.0, sentiment_score))

def update_room_sentiment(room_data, text, speaker_id=None):
    """
    Update room sentiment history with new text
    
    Args:
        room_data: Room data dictionary
        text: New text to analyze
        speaker_id: ID of the speaker (optional)
    """
    sentiment_score = analyze_sentiment(text)
    timestamp = time.time()
    
    sentiment_entry = {
        "timestamp": timestamp,
        "score": sentiment_score,
        "text": text[:100],  # Store first 100 chars for context
        "speaker": speaker_id
    }
    
    room_data["sentiment_history"].append(sentiment_entry)
    
    # Keep only last 100 entries to prevent memory issues
    if len(room_data["sentiment_history"]) > 100:
        room_data["sentiment_history"] = room_data["sentiment_history"][-100:]
    
    return sentiment_score

def get_sentiment_graph(room_data, time_window_minutes=30):
    """
    Get sentiment data for graphing
    
    Args:
        room_data: Room data dictionary
        time_window_minutes: Time window to include in minutes
        
    Returns:
        Dictionary with sentiment graph data
    """
    current_time = time.time()
    cutoff_time = current_time - (time_window_minutes * 60)
    
    # Filter recent sentiment entries
    recent_entries = [
        entry for entry in room_data["sentiment_history"]
        if entry["timestamp"] >= cutoff_time
    ]
    
    if not recent_entries:
        return {
            "sentiment_history": [],
            "overall_sentiment": 0.0,
            "trend": "neutral",
            "summary": "No recent sentiment data"
        }
    
    # Calculate overall sentiment
    scores = [entry["score"] for entry in recent_entries]
    overall_sentiment = sum(scores) / len(scores)
    
    # Determine trend
    if overall_sentiment > 0.2:
        trend = "positive"
    elif overall_sentiment < -0.2:
        trend = "negative"
    else:
        trend = "neutral"
    
    # Generate summary
    positive_count = sum(1 for score in scores if score > 0.2)
    negative_count = sum(1 for score in scores if score < -0.2)
    neutral_count = len(scores) - positive_count - negative_count
    
    summary = f"Recent sentiment: {positive_count} positive, {neutral_count} neutral, {negative_count} negative statements"
    
    return {
        "sentiment_history": recent_entries,
        "overall_sentiment": overall_sentiment,
        "trend": trend,
        "summary": summary,
        "stats": {
            "positive_count": positive_count,
            "negative_count": negative_count,
            "neutral_count": neutral_count,
            "total_entries": len(recent_entries)
        }
    }

def get_speaker_sentiment_analysis(room_data, speaker_id):
    """
    Get sentiment analysis for a specific speaker
    
    Args:
        room_data: Room data dictionary
        speaker_id: ID of the speaker
        
    Returns:
        Dictionary with speaker sentiment data
    """
    speaker_entries = [
        entry for entry in room_data["sentiment_history"]
        if entry.get("speaker") == speaker_id
    ]
    
    if not speaker_entries:
        return {
            "speaker_id": speaker_id,
            "avg_sentiment": 0.0,
            "trend": "neutral",
            "total_statements": 0
        }
    
    scores = [entry["score"] for entry in speaker_entries]
    avg_sentiment = sum(scores) / len(scores)
    
    # Determine trend
    if avg_sentiment > 0.2:
        trend = "positive"
    elif avg_sentiment < -0.2:
        trend = "negative"
    else:
        trend = "neutral"
    
    return {
        "speaker_id": speaker_id,
        "avg_sentiment": avg_sentiment,
        "trend": trend,
        "total_statements": len(speaker_entries),
        "recent_scores": scores[-10:]  # Last 10 scores
    }

def detect_sentiment_alerts(room_data, threshold=-0.5, consecutive_count=3):
    """
    Detect if room sentiment is consistently negative
    
    Args:
        room_data: Room data dictionary
        threshold: Negative sentiment threshold
        consecutive_count: Number of consecutive negative entries to trigger alert
        
    Returns:
        Dictionary with alert information
    """
    recent_entries = room_data["sentiment_history"][-consecutive_count:]
    
    if len(recent_entries) < consecutive_count:
        return {"alert": False, "message": ""}
    
    # Check if all recent entries are below threshold
    all_negative = all(entry["score"] < threshold for entry in recent_entries)
    
    if all_negative:
        avg_score = sum(entry["score"] for entry in recent_entries) / len(recent_entries)
        return {
            "alert": True,
            "message": f"Meeting sentiment has been consistently negative (avg: {avg_score:.2f}). Consider addressing concerns or taking a break.",
            "severity": "high" if avg_score < -0.7 else "medium",
            "avg_score": avg_score
        }
    
    return {"alert": False, "message": ""}
