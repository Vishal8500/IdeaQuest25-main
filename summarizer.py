import os
import logging
import google.generativeai as genai
from datetime import datetime

# Setup logging
logger = logging.getLogger(__name__)

# Get API key from environment variable
API_KEY = "AIzaSyDD3-4VGqZbncObJ7_VFA2UeovjrEO6ag0"


if not API_KEY:
    logger.warning("No Gemini API key found. Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable.")
    # Fallback API key for demo (replace with your own)
    API_KEY = "AIzaSyDD3-4VGqZbncObJ7_VFA2UeovjrEO6ag0"

try:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
    GEMINI_AVAILABLE = True
    logger.info("Gemini AI model initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Gemini AI: {e}")
    GEMINI_AVAILABLE = False
    model = None

def summarize_and_extract(transcript, include_sentiment=True, include_action_items=True):
    """
    Generate AI-powered meeting summary and action items

    Args:
        transcript: Meeting transcript text
        include_sentiment: Whether to include sentiment analysis
        include_action_items: Whether to extract action items

    Returns:
        Formatted summary string
    """
    if not GEMINI_AVAILABLE or not model:
        return generate_fallback_summary(transcript)

    if not transcript or not transcript.strip():
        return "📋 Summary:\nNo transcript content available to summarize.\n\n📝 Meeting Minutes:\n- No content recorded\n\n✅ Action Items:\n- No action items identified"

    # Build dynamic prompt based on options
    prompt_parts = [
        "You are an AI meeting assistant. Analyze the following transcript and produce:",
        "1. A concise meeting summary (3-5 sentences).",
        "2. Clear meeting minutes (MOM) with key discussion points.",
    ]

    if include_action_items:
        prompt_parts.append("3. Action items with assignees if mentioned.")

    if include_sentiment:
        prompt_parts.append("4. Overall meeting sentiment and tone.")

    prompt_parts.extend([
        f"\nTranscript:\n{transcript}",
        "\nFormat the response as:",
        "📋 Summary:",
        "...",
        "",
        "📝 Meeting Minutes:",
        "- Point 1",
        "- Point 2",
        ""
    ])

    if include_action_items:
        prompt_parts.extend([
            "✅ Action Items:",
            "- Task 1 (Assignee: Name)",
            "- Task 2 (Assignee: Name)",
            ""
        ])

    if include_sentiment:
        prompt_parts.extend([
            "🎭 Meeting Sentiment:",
            "Overall tone: [Positive/Neutral/Negative]",
            "Key observations: ...",
            ""
        ])

    prompt_parts.append(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    prompt = "\n".join(prompt_parts)

    try:
        response = model.generate_content(prompt)
        if response and response.text:
            return response.text
        else:
            logger.warning("Empty response from Gemini AI")
            return generate_fallback_summary(transcript)
    except Exception as e:
        logger.error(f"Error generating summary with Gemini AI: {e}")
        return generate_fallback_summary(transcript)

def generate_fallback_summary(transcript):
    """Generate a basic summary when AI is not available"""
    if not transcript or not transcript.strip():
        return "📋 Summary:\nNo transcript content available.\n\n📝 Meeting Minutes:\n- No content recorded\n\n✅ Action Items:\n- No action items identified"

    # Basic text analysis
    words = transcript.split()
    word_count = len(words)
    sentences = transcript.split('.')
    sentence_count = len([s for s in sentences if s.strip()])

    # Extract potential action words
    action_words = ['will', 'should', 'must', 'need to', 'action', 'task', 'todo', 'follow up']
    potential_actions = []

    for sentence in sentences:
        sentence_lower = sentence.lower()
        if any(action_word in sentence_lower for action_word in action_words):
            potential_actions.append(sentence.strip())

    # Generate basic summary
    summary = f"""📋 Summary:
Meeting transcript contains {word_count} words across {sentence_count} sentences. This is a basic summary generated without AI assistance.

📝 Meeting Minutes:
- Meeting discussion recorded with {word_count} words
- {sentence_count} main discussion points identified
- Transcript processed on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

✅ Action Items:"""

    if potential_actions:
        for i, action in enumerate(potential_actions[:5], 1):  # Limit to 5 actions
            summary += f"\n- Action {i}: {action[:100]}..."
    else:
        summary += "\n- No clear action items identified in transcript"

    summary += f"\n\n⚠️ Note: This summary was generated using basic text analysis. For better results, configure Gemini AI."

    return summary

def extract_key_topics(transcript, max_topics=5):
    """Extract key topics from transcript using simple keyword analysis"""
    if not transcript:
        return []

    # Simple keyword extraction (in production, use proper NLP)
    words = transcript.lower().split()
    word_freq = {}

    # Filter out common words
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'}

    for word in words:
        word = word.strip('.,!?;:"()[]{}')
        if len(word) > 3 and word not in stop_words:
            word_freq[word] = word_freq.get(word, 0) + 1

    # Get top keywords
    top_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:max_topics]
    return [word for word, freq in top_words]

def get_summary_stats(transcript):
    """Get basic statistics about the transcript"""
    if not transcript:
        return {
            "word_count": 0,
            "sentence_count": 0,
            "estimated_duration": 0,
            "key_topics": []
        }

    words = transcript.split()
    sentences = transcript.split('.')

    return {
        "word_count": len(words),
        "sentence_count": len([s for s in sentences if s.strip()]),
        "estimated_duration": len(words) / 150,  # Assume 150 words per minute
        "key_topics": extract_key_topics(transcript)
    }

if __name__ == "__main__":
    print("👉 AgamAI Meeting Summarizer")
    print("=" * 50)

    if GEMINI_AVAILABLE:
        print("✅ Gemini AI is available")
    else:
        print("⚠️ Gemini AI not available - using fallback mode")

    print("\nPaste your meeting transcript below (press Enter twice to submit):\n")

    lines = []
    while True:
        line = input()
        if line == "" and lines:
            break
        lines.append(line)

    transcript = "\n".join(lines)

    if transcript.strip():
        print("\n" + "=" * 50)
        print("🤖 Generating AI Summary...")
        print("=" * 50)

        result = summarize_and_extract(transcript)
        print(result)

        print("\n" + "=" * 50)
        print("📊 Transcript Statistics:")
        print("=" * 50)

        stats = get_summary_stats(transcript)
        print(f"Word Count: {stats['word_count']}")
        print(f"Sentences: {stats['sentence_count']}")
        print(f"Estimated Duration: {stats['estimated_duration']:.1f} minutes")
        print(f"Key Topics: {', '.join(stats['key_topics'][:5])}")
    else:
        print("No transcript provided.")
