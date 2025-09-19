# Deployment Guide for Render

## 🚀 Quick Deploy to Render

### 1. Prerequisites
- GitHub repository with your code
- Render account (free tier available)

### 2. Deploy Steps

#### Option A: One-Click Deploy
1. Push your code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Use these settings:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python server.py`
   - **Environment**: `Python 3`

#### Option B: Using render.yaml (Recommended)
1. The `render.yaml` file is already configured
2. Push to GitHub
3. In Render, create a new "Blueprint" and connect your repo
4. Render will automatically use the `render.yaml` configuration

### 3. Environment Variables (Optional)
Set these in Render Dashboard → Environment:

```
GEMINI_API_KEY=your-gemini-api-key-here
OPENAI_API_KEY=your-openai-api-key-here
FLASK_ENV=production
```

### 4. Important Notes

#### ✅ What Works on Render:
- **Core WebRTC functionality** (Track A)
- **Real-time video/audio calls** between multiple peers
- **AI summarization** with Gemini API (if API key provided)
- **Live transcription** using Web Speech API
- **Sentiment analysis** and engagement tracking
- **All UI features** and responsive design

#### ⚠️ Limitations on Render:
- **Computer vision features** (MediaPipe/OpenCV) are disabled for compatibility
- **Attention detection** uses fallback mode (audio-based only)
- **Heavy ML dependencies** removed to ensure deployment success

### 5. Testing Your Deployment

1. **Health Check**: Visit `https://your-app.onrender.com/health`
2. **Main App**: Visit `https://your-app.onrender.com`
3. **Multi-peer Test**: 
   - Open multiple browser tabs
   - Join the same room from different tabs/devices
   - Test video/audio communication

### 6. Production Considerations

#### Performance:
- Render free tier has some limitations
- For production use, consider upgrading to paid tier
- Enable auto-scaling for high traffic

#### Security:
- Set strong `SECRET_KEY` environment variable
- Use HTTPS (automatically provided by Render)
- Consider rate limiting for production

#### Monitoring:
- Use Render's built-in logs and metrics
- Monitor the `/health` endpoint
- Set up alerts for downtime

### 7. Troubleshooting

#### Common Issues:

**Build Fails with MediaPipe Error:**
- ✅ Fixed: Heavy dependencies removed from requirements.txt
- The app now uses lightweight alternatives

**Eventlet Python 3.13 Compatibility Error:**
- ✅ Fixed: Switched from eventlet to gevent for better Python compatibility
- ✅ Fixed: Using Python 3.11.9 runtime for stability

**Port Issues:**
- ✅ Fixed: Server automatically uses Render's PORT environment variable

**WebRTC Not Working:**
- Ensure you're using HTTPS (Render provides this automatically)
- Test with multiple browser tabs first
- For production, consider adding TURN servers

**AI Features Not Working:**
- Add `GEMINI_API_KEY` environment variable in Render dashboard
- Check logs for API key validation errors

### 8. Scaling for Production

#### For High Traffic:
1. **Upgrade Render Plan**: Move from free to paid tier
2. **Add TURN Servers**: For better WebRTC connectivity
3. **Database**: Consider adding Redis for session management
4. **CDN**: Use Render's CDN for static assets
5. **Load Balancing**: Enable auto-scaling

#### Example Production Environment Variables:
```
FLASK_ENV=production
GEMINI_API_KEY=your-production-gemini-key
SECRET_KEY=your-super-secret-production-key
REDIS_URL=your-redis-url (if using Redis)
```

### 9. Cost Optimization

#### Free Tier Limits:
- 750 hours/month (enough for testing)
- Sleeps after 15 minutes of inactivity
- Limited bandwidth and compute

#### Paid Tier Benefits:
- No sleep mode
- Better performance
- More bandwidth
- Custom domains

### 10. Support

#### If You Need Help:
1. Check Render logs in dashboard
2. Visit `/health` endpoint to see feature status
3. Test locally first with `python server.py`
4. Check GitHub issues for common problems

---

## 🎉 Your AgamAI Meeting Platform is Now Live!

After deployment, your platform will be accessible at:
`https://your-app-name.onrender.com`

**Features Available:**
- ✅ Multi-peer video calling
- ✅ Real-time transcription
- ✅ AI meeting summaries
- ✅ Sentiment analysis
- ✅ Engagement tracking
- ✅ Mobile-responsive design

**Perfect for:**
- Remote team meetings
- Online education
- Virtual conferences
- Client presentations
- Collaborative sessions

---

**Built with ❤️ for seamless remote collaboration**
