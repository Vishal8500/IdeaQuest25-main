# engagement.py - Participant engagement tracking and analysis
import time
from collections import defaultdict

def update_engagement(room_data, participant_id, activity_type, value=None):
    """
    Update engagement metrics for a participant
    
    Args:
        room_data: Room data dictionary
        participant_id: ID of the participant
        activity_type: Type of activity ('speaking', 'attention', 'interaction')
        value: Optional value for the activity
    """
    if participant_id not in room_data["participants"]:
        return
    
    participant = room_data["participants"][participant_id]
    current_time = time.time()
    
    # Update last activity time
    participant["last_activity"] = current_time
    
    # Update engagement based on activity type
    if activity_type == "speaking":
        # Increase engagement for speaking
        words_count = value or 1
        engagement_boost = min(0.1, words_count / 50)
        participant["engagement_score"] = min(1.0, participant["engagement_score"] + engagement_boost)
        participant["speaking_time"] += words_count * 0.5  # Estimate speaking time
        
    elif activity_type == "attention":
        # Update engagement based on attention score
        attention_score = value or 0.5
        participant["engagement_score"] = (participant["engagement_score"] * 0.8) + (attention_score * 0.2)
        
    elif activity_type == "interaction":
        # Boost engagement for interactions (reactions, chat, etc.)
        participant["engagement_score"] = min(1.0, participant["engagement_score"] + 0.05)

def get_room_leaderboard(room_data):
    """
    Get engagement leaderboard for a room
    
    Args:
        room_data: Room data dictionary
        
    Returns:
        List of participants sorted by engagement score
    """
    participants = []
    
    for sid, participant_data in room_data["participants"].items():
        attention_scores = room_data["attention_scores"].get(sid, [])
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
    
    return leaderboard

def get_speaking_distribution(room_data):
    """
    Get speaking time distribution for participants
    
    Args:
        room_data: Room data dictionary
        
    Returns:
        Dictionary with speaking distribution data
    """
    participants = room_data["participants"]
    total_speaking = sum(p.get("speaking_time", 0) for p in participants.values())
    
    distribution = {}
    for sid, participant_data in participants.items():
        speaking_time = participant_data.get("speaking_time", 0)
        percentage = (speaking_time / total_speaking * 100) if total_speaking > 0 else 0
        
        distribution[sid] = {
            "time": speaking_time,
            "percentage": percentage,
            "name": participant_data.get("name", f"User {sid[:8]}")
        }
    
    return distribution

def should_nudge_participant(room_data, participant_id, threshold_minutes=5):
    """
    Check if a participant should be nudged for low engagement
    
    Args:
        room_data: Room data dictionary
        participant_id: ID of the participant
        threshold_minutes: Minutes of inactivity before nudging
        
    Returns:
        Boolean indicating if participant should be nudged
    """
    if participant_id not in room_data["participants"]:
        return False
    
    participant = room_data["participants"][participant_id]
    current_time = time.time()
    last_activity = participant.get("last_activity", current_time)
    engagement_score = participant.get("engagement_score", 0.5)
    
    # Nudge if inactive for more than threshold and low engagement
    inactive_time = current_time - last_activity
    return (inactive_time > threshold_minutes * 60) and engagement_score < 0.3

def calculate_meeting_insights(room_data):
    """
    Calculate overall meeting insights and statistics
    
    Args:
        room_data: Room data dictionary
        
    Returns:
        Dictionary with meeting insights
    """
    participants = room_data["participants"]
    meeting_duration = time.time() - room_data["meeting_start"]
    
    if not participants:
        return {
            "total_participants": 0,
            "avg_engagement": 0,
            "avg_attention": 0,
            "meeting_duration": meeting_duration,
            "most_engaged": None,
            "least_engaged": None
        }
    
    # Calculate averages
    engagement_scores = [p.get("engagement_score", 0.5) for p in participants.values()]
    avg_engagement = sum(engagement_scores) / len(engagement_scores)
    
    attention_scores = []
    for sid in participants.keys():
        scores = room_data["attention_scores"].get(sid, [])
        if scores:
            attention_scores.extend(scores)
    
    avg_attention = sum(attention_scores) / len(attention_scores) if attention_scores else 0
    
    # Find most and least engaged
    leaderboard = get_room_leaderboard(room_data)
    most_engaged = leaderboard[0] if leaderboard else None
    least_engaged = leaderboard[-1] if len(leaderboard) > 1 else None
    
    return {
        "total_participants": len(participants),
        "avg_engagement": avg_engagement,
        "avg_attention": avg_attention,
        "meeting_duration": meeting_duration,
        "most_engaged": most_engaged,
        "least_engaged": least_engaged,
        "speaking_distribution": get_speaking_distribution(room_data)
    }
