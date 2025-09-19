#!/usr/bin/env python3
"""
Simple startup script for AgamAI Meeting Platform
"""

import sys
import os

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("🚀 Starting AgamAI Meeting Platform...")
    print("=" * 50)
    
    # Import and run the server
    from server import app, socketio, log
    from server import (
        TRANSCRIPTION_ENABLED, 
        SUMMARIZER_ENABLED, 
        NETWORK_ADAPTATION_ENABLED, 
        ENGAGEMENT_ENABLED, 
        SENTIMENT_ENABLED
    )
    
    PORT = int(os.environ.get("PORT", 5000))
    DEBUG = os.environ.get("FLASK_ENV") != "production"
    
    print(f"📡 Server will start on: http://localhost:{PORT}")
    print(f"🔧 Debug mode: {DEBUG}")
    print("🎯 Features status:")
    print(f"   ✅ Transcription: {'Enabled' if TRANSCRIPTION_ENABLED else 'Disabled'}")
    print(f"   ✅ AI Summarization: {'Enabled' if SUMMARIZER_ENABLED else 'Disabled'}")
    print(f"   ✅ Network Adaptation: {'Enabled' if NETWORK_ADAPTATION_ENABLED else 'Disabled'}")
    print(f"   ✅ Engagement Tracking: {'Enabled' if ENGAGEMENT_ENABLED else 'Disabled'}")
    print(f"   ✅ Sentiment Analysis: {'Enabled' if SENTIMENT_ENABLED else 'Disabled'}")
    print("=" * 50)
    print("🌐 Open http://localhost:5000 in your browser to start using the platform")
    print("🛑 Press Ctrl+C to stop the server")
    print("=" * 50)
    
    # Start the server
    socketio.run(
        app,
        host='0.0.0.0',
        port=PORT,
        debug=DEBUG,
        use_reloader=False,
        allow_unsafe_werkzeug=True
    )
    
except KeyboardInterrupt:
    print("\n🛑 Server stopped by user")
except Exception as e:
    print(f"❌ Error starting server: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
