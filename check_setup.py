#!/usr/bin/env python3
"""
Setup checker for AgamAI Meeting Platform
"""

import sys
import importlib

def check_import(module_name, description=""):
    """Check if a module can be imported"""
    try:
        importlib.import_module(module_name)
        print(f"✅ {module_name} - {description}")
        return True
    except ImportError as e:
        print(f"❌ {module_name} - {description} (Error: {e})")
        return False

def main():
    print("🔍 AgamAI Meeting Platform - Setup Check")
    print("=" * 50)
    
    # Check core dependencies
    core_deps = [
        ("flask", "Web framework"),
        ("flask_socketio", "Real-time communication"),
        ("eventlet", "Async server"),
        ("google.generativeai", "Gemini AI for summarization"),
    ]
    
    # Check optional dependencies
    optional_deps = [
        ("openai", "OpenAI API for advanced transcription"),
        ("speech_recognition", "Speech recognition library"),
        ("opencv", "Computer vision for attention detection"),
        ("mediapipe", "Face detection and analysis"),
    ]
    
    print("📦 Core Dependencies:")
    core_ok = True
    for module, desc in core_deps:
        if not check_import(module, desc):
            core_ok = False
    
    print("\n📦 Optional Dependencies:")
    for module, desc in optional_deps:
        check_import(module, desc)
    
    print("\n🔧 Custom Modules:")
    custom_modules = [
        ("summarizer", "AI summarization"),
        ("transcription", "Speech transcription"),
        ("engagement", "Participant engagement tracking"),
        ("sentiment_analysis", "Sentiment analysis"),
        ("network_adaptation", "Network quality adaptation"),
    ]
    
    for module, desc in custom_modules:
        check_import(module, desc)
    
    print("\n" + "=" * 50)
    
    if core_ok:
        print("🎉 Core setup looks good! You can start the server.")
        print("💡 Run: python start_server.py")
    else:
        print("⚠️  Some core dependencies are missing.")
        print("💡 Run: pip install -r requirements.txt")
    
    print("\n🌐 After starting the server, open: http://localhost:5000")
    
    return core_ok

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
