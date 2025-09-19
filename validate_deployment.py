#!/usr/bin/env python3
"""
Comprehensive validation script for AgamAI Meeting Platform
Tests both local functionality and deployment readiness
"""

import sys
import importlib
import requests
import time
import json

def test_imports():
    """Test all critical imports"""
    print("🔍 Testing Python imports...")
    
    imports_to_test = [
        ("flask", "Flask web framework"),
        ("flask_socketio", "Real-time communication"),
        ("google.generativeai", "Gemini AI (optional)"),
        ("requests", "HTTP client"),
    ]
    
    optional_imports = [
        ("eventlet", "Local development async"),
        ("gevent", "Production async"),
        ("opencv", "Computer vision (optional)"),
        ("numpy", "Numerical computing (optional)"),
    ]
    
    success = True
    for module, desc in imports_to_test:
        try:
            importlib.import_module(module)
            print(f"  ✅ {module} - {desc}")
        except ImportError:
            print(f"  ❌ {module} - {desc} (REQUIRED)")
            success = False
    
    print("\n🔍 Testing optional imports...")
    for module, desc in optional_imports:
        try:
            importlib.import_module(module)
            print(f"  ✅ {module} - {desc}")
        except ImportError:
            print(f"  ⚠️ {module} - {desc} (Optional)")
    
    return success

def test_server_startup():
    """Test if server can start without errors"""
    print("\n🚀 Testing server startup...")
    
    try:
        # Import server modules
        from server import app, socketio, ASYNC_MODE
        print(f"  ✅ Server imports successful")
        print(f"  ✅ Async mode: {ASYNC_MODE}")
        
        # Test Flask app configuration
        if app.config.get('SECRET_KEY'):
            print(f"  ✅ Flask app configured")
        else:
            print(f"  ⚠️ No secret key configured")
        
        return True
    except Exception as e:
        print(f"  ❌ Server startup failed: {e}")
        return False

def test_ai_modules():
    """Test AI module availability"""
    print("\n🧠 Testing AI modules...")
    
    modules_to_test = [
        ("summarizer", "AI summarization"),
        ("transcription", "Speech-to-text"),
        ("engagement", "Participant tracking"),
        ("sentiment_analysis", "Sentiment analysis"),
        ("network_adaptation", "Network optimization"),
    ]
    
    for module, desc in modules_to_test:
        try:
            importlib.import_module(module)
            print(f"  ✅ {module} - {desc}")
        except ImportError as e:
            print(f"  ⚠️ {module} - {desc} (Error: {e})")

def test_health_endpoint():
    """Test if server health endpoint responds"""
    print("\n🏥 Testing health endpoint...")
    
    try:
        response = requests.get('http://localhost:5000/health', timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ Health endpoint responding")
            print(f"  ✅ Status: {data.get('status', 'unknown')}")
            
            features = data.get('features', {})
            for feature, enabled in features.items():
                status = "✅" if enabled else "⚠️"
                print(f"  {status} {feature}: {'Enabled' if enabled else 'Disabled'}")
            
            return True
        else:
            print(f"  ❌ Health endpoint returned {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"  ⚠️ Server not running (start with: python start_server.py)")
        return False
    except Exception as e:
        print(f"  ❌ Health check failed: {e}")
        return False

def test_file_structure():
    """Test if all required files exist"""
    print("\n📁 Testing file structure...")
    
    required_files = [
        ("server.py", "Main server file"),
        ("templates/index.html", "Main UI template"),
        ("static/main.js", "Frontend JavaScript"),
        ("static/style.css", "Styling"),
        ("requirements.txt", "Production dependencies"),
        ("requirements-dev.txt", "Development dependencies"),
        ("render.yaml", "Render deployment config"),
        ("runtime.txt", "Python version specification"),
    ]
    
    import os
    success = True
    for file_path, desc in required_files:
        if os.path.exists(file_path):
            print(f"  ✅ {file_path} - {desc}")
        else:
            print(f"  ❌ {file_path} - {desc} (MISSING)")
            success = False
    
    return success

def test_deployment_readiness():
    """Test deployment configuration"""
    print("\n🚀 Testing deployment readiness...")
    
    # Check runtime.txt
    try:
        with open('runtime.txt', 'r') as f:
            python_version = f.read().strip()
            print(f"  ✅ Python version: {python_version}")
    except FileNotFoundError:
        print(f"  ❌ runtime.txt missing")
        return False
    
    # Check render.yaml
    try:
        import yaml
        with open('render.yaml', 'r') as f:
            config = yaml.safe_load(f)
            print(f"  ✅ render.yaml configuration valid")
    except ImportError:
        print(f"  ⚠️ PyYAML not installed (render.yaml not validated)")
    except FileNotFoundError:
        print(f"  ❌ render.yaml missing")
        return False
    except Exception as e:
        print(f"  ❌ render.yaml invalid: {e}")
        return False
    
    # Check requirements files
    for req_file in ['requirements.txt', 'requirements-dev.txt']:
        try:
            with open(req_file, 'r') as f:
                lines = len([l for l in f.readlines() if l.strip() and not l.startswith('#')])
                print(f"  ✅ {req_file}: {lines} dependencies")
        except FileNotFoundError:
            print(f"  ❌ {req_file} missing")
            return False
    
    return True

def main():
    """Run all validation tests"""
    print("🎯 AgamAI Meeting Platform - Deployment Validation")
    print("=" * 60)
    
    tests = [
        ("Python Imports", test_imports),
        ("Server Startup", test_server_startup),
        ("AI Modules", test_ai_modules),
        ("File Structure", test_file_structure),
        ("Deployment Config", test_deployment_readiness),
        ("Health Endpoint", test_health_endpoint),
    ]
    
    results = {}
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"  ❌ {test_name} failed with exception: {e}")
            results[test_name] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 VALIDATION SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ Your platform is ready for deployment!")
        print("🚀 Deploy to Render: git push origin main")
        print("🌐 Test locally: python start_server.py")
    else:
        print(f"\n⚠️ {total - passed} tests failed")
        print("🔧 Please fix the issues above before deploying")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
