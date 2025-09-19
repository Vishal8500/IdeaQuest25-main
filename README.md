# AgamAI Meeting Platform 🚀

A comprehensive real-time video conferencing platform with AI-powered features for enhanced meeting experiences.

## 🎯 Features Overview

### Track A - Core Communication ✅
- **2-way + Multi-peer WebRTC calls** using Flask + Socket.IO
- **Stable signaling** for join/leave rooms across devices
- **Reliable real-time video + audio streaming** with adaptive quality
- **Network adaptation** based on connection quality
- **Screen sharing** and media controls

### Track B - AI Engagement & Meeting Minutes ✅
- **Live speech-to-text transcription** using Web Speech API
- **AI-powered meeting summarization** using Google Gemini
- **Automatic action item extraction** from meeting content
- **Real-time sentiment analysis** of conversation
- **Participant engagement tracking** with attention detection
- **Meeting insights and analytics**

## 🛠️ Technology Stack

- **Backend**: Python Flask + Socket.IO + Eventlet
- **Frontend**: Vanilla JavaScript + WebRTC + Chart.js
- **AI Services**: Google Gemini AI for summarization
- **Real-time**: WebSocket communication for signaling
- **Audio Processing**: Web Speech API for transcription
- **Computer Vision**: MediaPipe for attention detection

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Set Environment Variables (Optional)
```bash
# For enhanced AI features
export GEMINI_API_KEY="your-gemini-api-key"
export OPENAI_API_KEY="your-openai-api-key"  # Optional for advanced transcription
```

### 3. Start the Server
```bash
python start_server.py
```

### 4. Open in Browser
Navigate to `http://localhost:5000` in your web browser.

## 🎮 How to Use

### Starting a Meeting
1. Enter a room name (or use the default "testroom")
2. Click "Join" to start your video/audio
3. Share the room name with other participants
4. Others can join by entering the same room name

### AI Features
- **Live Transcription**: Automatically enabled when you join
- **Generate Summary**: Click the "Generate Summary" button in the Transcript tab
- **View Insights**: Check the Insights tab for sentiment analysis and speaking distribution
- **Download Transcript**: Save the meeting transcript as a text file

### Controls
- **Toggle Video/Audio**: Use the quick action buttons
- **Share Screen**: Click the screen share button
- **View Participants**: See all participants in the Participants tab
- **Meeting Stats**: Monitor engagement and attention scores

## 🏗️ Architecture

### Core Components

1. **server.py** - Main Flask application with Socket.IO
2. **static/main.js** - Frontend WebRTC and UI logic
3. **templates/index.html** - Main application interface
4. **summarizer.py** - AI-powered meeting summarization
5. **transcription.py** - Speech-to-text processing
6. **engagement.py** - Participant engagement tracking
7. **sentiment_analysis.py** - Real-time sentiment analysis
8. **network_adaptation.py** - Network quality adaptation

### WebRTC Flow
```
Client A ←→ Signaling Server ←→ Client B
    ↓                              ↓
Direct P2P Connection (Audio/Video)
```

### AI Processing Pipeline
```
Speech → Web Speech API → Transcript → Gemini AI → Summary + Action Items
                     ↓
               Sentiment Analysis → Real-time Insights
```

## 🔧 Configuration

### Environment Variables
- `PORT` - Server port (default: 5000)
- `FLASK_ENV` - Environment mode (development/production)
- `GEMINI_API_KEY` - Google Gemini AI API key
- `OPENAI_API_KEY` - OpenAI API key (optional)

### Feature Toggles
The platform automatically detects available features:
- **Transcription**: Uses Web Speech API (browser-based)
- **AI Summarization**: Requires Gemini API key
- **Advanced Transcription**: Optional OpenAI integration
- **Attention Detection**: Uses MediaPipe (if available)

## 🧪 Testing

### Run Setup Check
```bash
python check_setup.py
```

### Run Feature Tests
```bash
python test_app.py
```

### Manual Testing
1. Open multiple browser tabs/windows
2. Join the same room from different tabs
3. Test video/audio communication
4. Speak to generate transcripts
5. Generate AI summaries
6. Check engagement metrics

## 📊 API Endpoints

- `GET /health` - Server health and feature status
- `POST /summarize` - Generate AI meeting summary
- `GET /transcript/{room}` - Get room transcript
- `GET /engagement/{room}` - Get engagement metrics
- `GET /sentiment/{room}` - Get sentiment analysis
- `POST /adapt` - Network adaptation recommendations

## 🎨 UI Features

### Responsive Design
- **Desktop**: Full-featured interface with sidebar
- **Mobile**: Optimized layout for smaller screens
- **Dark Theme**: Modern dark UI with accent colors

### Real-time Updates
- **Live participant list** with connection status
- **Real-time transcript** with sentiment indicators
- **Dynamic engagement leaderboard**
- **Live sentiment charts** and analytics

### Accessibility
- **Keyboard navigation** support
- **Screen reader** compatible
- **High contrast** design elements
- **Clear visual indicators** for all states

## 🔒 Security Considerations

- **CORS enabled** for cross-origin requests
- **Input validation** on all endpoints
- **Rate limiting** recommended for production
- **HTTPS required** for WebRTC in production
- **API key protection** via environment variables

## 🚀 Production Deployment

### Quick Deploy to Render (Recommended)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. **Push to GitHub** and connect to Render
2. **Use provided `render.yaml`** for automatic configuration
3. **Set environment variables** (optional):
   ```
   GEMINI_API_KEY=your-gemini-api-key
   OPENAI_API_KEY=your-openai-api-key
   ```
4. **Deploy!** Your app will be live at `https://your-app.onrender.com`

See [DEPLOY.md](DEPLOY.md) for detailed deployment instructions.

### Other Platforms
1. Use **HTTPS** (required for WebRTC)
2. Configure **TURN servers** for NAT traversal
3. Set up **load balancing** for multiple instances
4. Enable **logging** and monitoring
5. Configure **rate limiting**

### Environment Variables for Production
```bash
FLASK_ENV=production
PORT=10000  # Render uses this port
GEMINI_API_KEY=your-production-key
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Google Gemini AI** for meeting summarization
- **WebRTC** for real-time communication
- **MediaPipe** for computer vision features
- **Socket.IO** for real-time signaling
- **Chart.js** for data visualization

---

**Built with ❤️ for better meeting experiences**
