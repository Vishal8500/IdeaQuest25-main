#!/usr/bin/env python3
"""
Test script for AgamAI Meeting Platform
Tests both Track A (WebRTC) and Track B (AI features)
"""

import requests
import json
import time
import sys

def test_server_health():
    """Test if the server is running and healthy"""
    try:
        response = requests.get('http://localhost:5000/health', timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ Server is healthy")
            print(f"   Features: {data['features']}")
            print(f"   Active rooms: {data['active_rooms']}")
            return True
        else:
            print(f"❌ Server health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to server: {e}")
        return False

def test_summarization():
    """Test the AI summarization feature"""
    print("\n🧠 Testing AI Summarization...")
    
    # Sample transcript for testing
    sample_transcript = """
    John: Good morning everyone, let's start our weekly team meeting.
    Sarah: Thanks John. I wanted to discuss the progress on the new feature.
    Mike: Yes, we've completed about 80% of the backend implementation.
    Sarah: That's great! What about the frontend work?
    Lisa: I'm working on the UI components. Should be done by Friday.
    John: Excellent. Any blockers or issues we need to address?
    Mike: We need to review the API documentation with the client.
    Sarah: I can schedule that meeting for tomorrow.
    John: Perfect. Let's also plan the testing phase.
    Lisa: I'll coordinate with the QA team this week.
    """
    
    try:
        response = requests.post(
            'http://localhost:5000/summarize',
            json={
                "room": "test-room",
                "transcript": sample_transcript,
                "include_sentiment": True,
                "include_action_items": True
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Summarization successful")
            print(f"   AI Backend: {data.get('ai_backend', 'Unknown')}")
            print(f"   Word count: {data.get('stats', {}).get('word_count', 'N/A')}")
            print("   Summary preview:")
            result = data.get('result', '')
            preview = result[:200] + "..." if len(result) > 200 else result
            print(f"   {preview}")
            return True
        else:
            print(f"❌ Summarization failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Summarization request failed: {e}")
        return False

def test_transcription_status():
    """Test transcription service status"""
    print("\n🎤 Testing Transcription Status...")
    
    try:
        response = requests.get('http://localhost:5000/transcription/status', timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ Transcription service is available")
            print(f"   Status: {data['status']}")
            print(f"   Backend: {data.get('stats', {}).get('backend', 'Unknown')}")
            return True
        else:
            print(f"❌ Transcription status check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Transcription status request failed: {e}")
        return False

def test_network_adaptation():
    """Test network adaptation feature"""
    print("\n🌐 Testing Network Adaptation...")
    
    try:
        response = requests.post(
            'http://localhost:5000/adapt',
            json={
                "rtt": 150,
                "packet_loss": 0.05,
                "bandwidth": 500
            },
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Network adaptation working")
            print(f"   Recommended mode: {data['mode']}")
            return True
        else:
            print(f"❌ Network adaptation failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Network adaptation request failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 AgamAI Meeting Platform Test Suite")
    print("=" * 50)
    
    # Test server health first
    if not test_server_health():
        print("\n❌ Server is not running. Please start the server first:")
        print("   python server.py")
        sys.exit(1)
    
    # Run feature tests
    tests = [
        test_transcription_status,
        test_network_adaptation,
        test_summarization
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The platform is working correctly.")
        print("\n🌐 You can now open http://localhost:5000 in your browser")
        print("   to test the WebRTC video calling features.")
    else:
        print("⚠️  Some tests failed. Check the error messages above.")
        
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
