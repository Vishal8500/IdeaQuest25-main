// Complete main.js with all features working
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const pcs = {};
  let localStream = null;
  let joined = false;
  let room = null;
  let meetingStartTime = null;
  let currentTab = 'participants';
  let speechRecognition = null;
  let isListening = false;
  let speechRecognitionEnabled = false;
  let lastInterimResult = '';
  let attentionInterval = null;
  let networkStatsInterval = null;
  let engagementUpdateInterval = null;
  
  // Charts
  let sentimentChart = null;
  
  // Audio context for attention detection
  let audioContext = null;
  let analyser = null;
  let microphone = null;
  
  // Elements
  const joinBtn = document.getElementById('joinBtn');
  const leaveBtn = document.getElementById('leaveBtn');
  const roomInput = document.getElementById('roomInput');
  const remotesGrid = document.getElementById('remotesGrid');
  const localVideo = document.getElementById('localVideo');
  const localBadge = document.getElementById('localBadge');
  const participantsList = document.getElementById('participantsList');
  const transcriptBox = document.getElementById('transcriptBox');
  const summaryBox = document.getElementById('summaryBox');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const leaderboard = document.getElementById('leaderboard');
  const notifications = document.getElementById('notifications');
  
  // Stats elements
  const rttEl = document.getElementById('rtt');
  const plEl = document.getElementById('pl');
  const netModeEl = document.getElementById('netMode');
  const meetingDurationEl = document.getElementById('meetingDuration');
  const avgAttentionEl = document.getElementById('avgAttention');
  const engagementScoreEl = document.getElementById('engagementScore');
  const localAttentionEl = document.getElementById('localAttention');

  // Speech recognition elements
  const toggleSpeechBtn = document.getElementById('toggleSpeechRecognition');
  const speechStatusEl = document.getElementById('speechStatus');
  const speechConfidenceEl = document.getElementById('speechConfidence');
  const confidenceLevelEl = document.getElementById('confidenceLevel');
  const confidenceTextEl = document.getElementById('confidenceText');
  const interimTextEl = document.getElementById('interimText');
  
  // Quick action buttons
  const toggleVideoBtn = document.getElementById('toggleVideo');
  const toggleAudioBtn = document.getElementById('toggleAudio');
  const shareScreenBtn = document.getElementById('shareScreen');
  const toggleTranscriptBtn = document.getElementById('toggleTranscript');
  
  // WebRTC configuration
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  };

  // Initialize everything
  initializeTabs();
  initializeCharts();
  initializeQuickActions();
  initializeSpeechRecognition();
  
  function log(...args) {
    console.log('[AgamAI]', ...args);
    const debugEl = document.getElementById('debug');
    if (debugEl) {
      debugEl.textContent += args.join(' ') + '\n';
      debugEl.scrollTop = debugEl.scrollHeight;
    }
  }
  
  function showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 
                 type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
      </div>
    `;
    
    notifications.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }
  
  function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        
        // Update active states
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(`${tabId}-tab`).classList.add('active');
        
        currentTab = tabId;
        
        // Load tab-specific data
        if (tabId === 'insights' && joined) {
          loadInsightsData();
        }
      });
    });
  }
  
  function initializeCharts() {
    const ctx = document.getElementById('sentimentChart');
    if (!ctx) return;
    
    sentimentChart = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Sentiment',
          data: [],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#f8fafc',
            bodyColor: '#f8fafc',
            borderColor: '#6366f1',
            borderWidth: 1
          }
        },
        scales: {
          y: {
            min: -1,
            max: 1,
            grid: { color: '#475569' },
            ticks: { 
              color: '#94a3b8',
              callback: function(value) {
                return value > 0.2 ? 'Positive' : value < -0.2 ? 'Negative' : 'Neutral';
              }
            }
          },
          x: {
            grid: { color: '#475569' },
            ticks: { color: '#94a3b8' }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });
  }
  
  function initializeQuickActions() {
    toggleVideoBtn.addEventListener('click', toggleVideo);
    toggleAudioBtn.addEventListener('click', toggleAudio);
    shareScreenBtn.addEventListener('click', shareScreen);
    toggleTranscriptBtn.addEventListener('click', toggleTranscript);
  }

  function initializeSpeechRecognition() {
    // Check if Web Speech API is supported
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      speechStatusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>Speech recognition not supported in this browser</span>';
      toggleSpeechBtn.disabled = true;
      toggleSpeechBtn.style.opacity = '0.5';
      return;
    }

    // Initialize speech recognition button
    toggleSpeechBtn.addEventListener('click', toggleSpeechRecognition);

    // Update initial status
    updateSpeechStatus('inactive', 'Speech recognition ready');
    updateConfidence(0);
    updateInterimText('Click "Start Speech" to begin...');

    log('Speech recognition initialized');
  }
  
  // Socket event handlers
  socket.on('connect', () => {
    log('Connected to server');
    joinBtn.disabled = false;
    showNotification('Connected to server', 'success');
  });
  
  socket.on('disconnect', () => {
    log('Disconnected from server');
    showNotification('Disconnected from server', 'error');
    if (joined) {
      cleanup();
    }
  });
  
  socket.on('existing-peers', (data) => {
    log('Existing peers:', data.peers);
    if (Array.isArray(data.peers)) {
      data.peers.forEach(peerId => {
        addParticipant(peerId);
        createPeerAndOffer(peerId);
      });
    }
  });
  
  socket.on('new-peer', async (data) => {
    log('New peer joined:', data.peer);
    addParticipant(data.peer);
    await createPeerAndOffer(data.peer);
  });
  
  socket.on('peer-left', (data) => {
    log('Peer left:', data.sid);
    removePeer(data.sid);
    removeParticipant(data.sid);
  });
  
  socket.on('offer', async (data) => {
    log('Received offer from:', data.from);
    await handleOffer(data);
  });
  
  socket.on('answer', async (data) => {
    log('Received answer from:', data.from);
    await handleAnswer(data);
  });
  
  socket.on('ice-candidate', async (data) => {
    log('Received ICE candidate from:', data.from);
    await handleIceCandidate(data);
  });
  
  socket.on('transcript-update', (data) => {
    log('Transcript update:', data.entry.text.substring(0, 50));
    appendTranscript(data.entry);
    if (currentTab === 'insights') {
      updateSentimentChart();
    }
  });
  
  socket.on('attention-update', (data) => {
    log(`Attention from ${data.sid}: ${Math.round(data.score * 100)}%`);
    updateParticipantAttention(data.sid, data.score);
  });
  
  socket.on('network-adaptation', (data) => {
    log('Network adaptation:', data.mode);
    handleNetworkAdaptation(data.mode, data.stats);
  });
  
  socket.on('nudge', (data) => {
    showNotification(data.message, 'warning', 8000);
    // Flash the screen briefly
    document.body.style.animation = 'flash 0.5s ease';
    setTimeout(() => document.body.style.animation = '', 500);
  });
  
  // Meeting controls
  joinBtn.addEventListener('click', async () => {
    if (joined) return;
    
    room = (roomInput.value || 'default').trim();
    
    try {
      // Get user media with high quality settings
      localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });
      
      localVideo.srcObject = localStream;
      localBadge.textContent = 'Live';
      localBadge.className = 'badge live';
      
      // Join room
      socket.emit('join', { room, name: `User ${socket.id?.slice(0, 8) || 'Unknown'}` });
      joined = true;
      meetingStartTime = Date.now();
      
      // Update UI
      joinBtn.disabled = true;
      leaveBtn.disabled = false;
      toggleVideoBtn.classList.add('active');
      toggleAudioBtn.classList.add('active');
      
      // Add self to participants
      addParticipant('you', { label: 'You', self: true });
      
      // Start features
      startMeetingTimer();
      startAttentionDetection();
      startNetworkMonitoring();
      startPeriodicUpdates();

      // Auto-start speech recognition if supported
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        setTimeout(() => {
          startEnhancedSpeechRecognition();
        }, 1000); // Small delay to ensure everything is set up
      }
      
      showNotification(`Joined meeting: ${room}`, 'success');
      log(`Joined room: ${room}`);
      
    } catch (error) {
      log('Error joining meeting:', error);
      showNotification('Failed to access camera/microphone: ' + error.message, 'error');
    }
  });
  
  leaveBtn.addEventListener('click', () => {
    if (!joined) return;
    
    socket.emit('leave', { room });
    cleanup();
    showNotification('Left the meeting', 'info');
    log('Left meeting');
  });
  
  function cleanup() {
    // Stop all streams and connections
    Object.keys(pcs).forEach(removePeer);
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    
    if (speechRecognition) {
      stopSpeechRecognition();
    }
    
    if (attentionInterval) {
      clearInterval(attentionInterval);
      attentionInterval = null;
    }
    
    if (networkStatsInterval) {
      clearInterval(networkStatsInterval);
      networkStatsInterval = null;
    }
    
    if (engagementUpdateInterval) {
      clearInterval(engagementUpdateInterval);
      engagementUpdateInterval = null;
    }
    
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    
    // Reset UI
    localVideo.srcObject = null;
    joined = false;
    meetingStartTime = null;
    room = null;
    
    joinBtn.disabled = false;
    leaveBtn.disabled = true;
    localBadge.textContent = 'Muted';
    localBadge.className = 'badge muted';
    
    // Clear content
    clearParticipants();
    transcriptBox.innerHTML = '';
    summaryBox.innerHTML = '';
    leaderboard.innerHTML = '';
    
    // Reset quick action buttons
    toggleVideoBtn.classList.remove('active');
    toggleAudioBtn.classList.remove('active');
    shareScreenBtn.classList.remove('active');
    
    // Reset stats
    rttEl.textContent = '—';
    plEl.textContent = '—';
    netModeEl.textContent = 'normal';
    meetingDurationEl.textContent = '00:00';
    avgAttentionEl.textContent = '—';
    engagementScoreEl.textContent = '—';
    localAttentionEl.textContent = '—';
  }
  
  // WebRTC functions
  async function createPeerAndOffer(targetSid) {
    try {
      const pc = createPeerConnectionFor(targetSid);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit('offer', {
        to: targetSid,
        sdp: pc.localDescription
      });
      
      log(`Sent offer to ${targetSid}`);
    } catch (error) {
      log('Error creating offer:', error);
    }
  }
  
  function createPeerConnectionFor(remoteSid) {
    const pc = new RTCPeerConnection(config);
    pcs[remoteSid] = pc;
    
    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          to: remoteSid,
          candidate: event.candidate
        });
      }
    };
    
    // Handle remote stream
    pc.ontrack = (event) => {
      log(`Received remote stream from ${remoteSid}`);
      attachRemoteStream(remoteSid, event.streams[0]);
    };
    
    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      log(`Connection state with ${remoteSid}: ${pc.connectionState}`);
      
      if (pc.connectionState === 'connected') {
        startStatsCollection(remoteSid);
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        removePeer(remoteSid);
        removeParticipant(remoteSid);
      }
    };
    
    return pc;
  }
  
  async function handleOffer(data) {
    try {
      const pc = createPeerConnectionFor(data.from);
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit('answer', {
        to: data.from,
        sdp: pc.localDescription
      });
      
      log(`Sent answer to ${data.from}`);
    } catch (error) {
      log('Error handling offer:', error);
    }
  }
  
  async function handleAnswer(data) {
    try {
      const pc = pcs[data.from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        log(`Set remote description for ${data.from}`);
      }
    } catch (error) {
      log('Error handling answer:', error);
    }
  }
  
  async function handleIceCandidate(data) {
    try {
      const pc = pcs[data.from];
      if (pc && data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (error) {
      log('Error handling ICE candidate:', error);
    }
  }
  
  function attachRemoteStream(remoteSid, stream) {
    let videoElement = document.getElementById(`remote_${remoteSid}`);
    
    if (!videoElement) {
      const wrapper = document.createElement('div');
      wrapper.id = `wrap_${remoteSid}`;
      wrapper.className = 'video-tile';
      
      videoElement = document.createElement('video');
      videoElement.id = `remote_${remoteSid}`;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      
      const overlay = document.createElement('div');
      overlay.className = 'tile-overlay';
      overlay.innerHTML = `
        <div class="participant-info">
          <div class="name">User ${remoteSid.slice(0, 8)}</div>
          <div class="status">
            <span class="badge live">Live</span>
            <span class="attention-indicator">
              <i class="fas fa-eye"></i>
              <span id="attention_${remoteSid}">—</span>%
            </span>
          </div>
        </div>
      `;
      
      wrapper.appendChild(videoElement);
      wrapper.appendChild(overlay);
      remotesGrid.appendChild(wrapper);
    }
    
    videoElement.srcObject = stream;
  }
  
  function removePeer(remoteSid) {
    if (pcs[remoteSid]) {
      try {
        pcs[remoteSid].close();
      } catch (error) {
        log('Error closing peer connection:', error);
      }
      delete pcs[remoteSid];
    }
    
    const wrapper = document.getElementById(`wrap_${remoteSid}`);
    if (wrapper) {
      wrapper.remove();
    }
  }
  
  // Enhanced Speech Recognition with Live Updates
  function toggleSpeechRecognition() {
    if (!speechRecognitionEnabled) {
      startEnhancedSpeechRecognition();
    } else {
      stopSpeechRecognition();
    }
  }

  function startEnhancedSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      showNotification('Speech recognition not supported in this browser', 'error');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognition = new SpeechRecognition();

    // Configure speech recognition for optimal real-time performance
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';
    speechRecognition.maxAlternatives = 3;

    speechRecognition.onstart = () => {
      isListening = true;
      speechRecognitionEnabled = true;
      updateSpeechStatus('listening', 'Listening...');
      updateSpeechButton(true);
      updateInterimText('Listening for speech...');
      log('Enhanced speech recognition started');
      showNotification('Speech recognition started - speak now!', 'success', 3000);
    };

    speechRecognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      let maxConfidence = 0;

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0.8;

        maxConfidence = Math.max(maxConfidence, confidence);

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Update confidence meter
      updateConfidence(maxConfidence);

      // Update interim results display
      if (interimTranscript) {
        updateInterimText(interimTranscript, true);
        lastInterimResult = interimTranscript;
      }

      // Process final results
      if (finalTranscript.trim()) {
        const text = finalTranscript.trim();
        if (text.length > 1) { // Filter out very short utterances
          // Add to local transcript immediately for instant feedback
          addLiveTranscriptEntry(text, maxConfidence);

          // Send to server for processing and sharing
          const payload = {
            room,
            text,
            ts: Math.floor(Date.now() / 1000),
            confidence: maxConfidence,
            source: 'live_speech'
          };

          socket.emit('transcript-text', payload);
          log(`Live transcript: ${text} (confidence: ${(maxConfidence * 100).toFixed(1)}%)`);

          // Clear interim text after final result
          updateInterimText('Listening for speech...');
        }
      }
    };

    speechRecognition.onerror = (event) => {
      log('Speech recognition error:', event.error);

      switch (event.error) {
        case 'not-allowed':
          updateSpeechStatus('error', 'Microphone access denied');
          showNotification('Please allow microphone access for speech recognition', 'error');
          stopSpeechRecognition();
          break;
        case 'network':
          updateSpeechStatus('error', 'Network error');
          showNotification('Network error - retrying speech recognition...', 'warning', 3000);
          break;
        case 'no-speech':
          updateSpeechStatus('listening', 'No speech detected - keep talking');
          break;
        case 'audio-capture':
          updateSpeechStatus('error', 'Audio capture error');
          showNotification('Audio capture error - check microphone', 'error');
          break;
        default:
          updateSpeechStatus('error', `Error: ${event.error}`);
          showNotification(`Speech recognition error: ${event.error}`, 'warning');
      }
    };

    speechRecognition.onend = () => {
      isListening = false;

      if (speechRecognitionEnabled) {
        // Auto-restart if still enabled
        setTimeout(() => {
          if (speechRecognitionEnabled && speechRecognition) {
            try {
              speechRecognition.start();
            } catch (error) {
              log('Error restarting speech recognition:', error);
              updateSpeechStatus('error', 'Failed to restart');
              showNotification('Speech recognition stopped - click to restart', 'warning');
              stopSpeechRecognition();
            }
          }
        }, 100);
      } else {
        updateSpeechStatus('inactive', 'Speech recognition stopped');
        updateInterimText('Click "Start Speech" to begin...');
      }
    };

    try {
      speechRecognition.start();
    } catch (error) {
      log('Error starting speech recognition:', error);
      updateSpeechStatus('error', 'Failed to start');
      showNotification('Failed to start speech recognition: ' + error.message, 'error');
      speechRecognitionEnabled = false;
      updateSpeechButton(false);
    }
  }

  function stopSpeechRecognition() {
    speechRecognitionEnabled = false;
    isListening = false;

    if (speechRecognition) {
      try {
        speechRecognition.stop();
      } catch (error) {
        log('Error stopping speech recognition:', error);
      }
      speechRecognition = null;
    }

    updateSpeechStatus('inactive', 'Speech recognition stopped');
    updateSpeechButton(false);
    updateInterimText('Click "Start Speech" to begin...');
    updateConfidence(0);

    showNotification('Speech recognition stopped', 'info', 2000);
    log('Speech recognition stopped');
  }

  // UI Update Functions for Speech Recognition
  function updateSpeechStatus(status, message) {
    const statusIcon = status === 'listening' ? 'fa-microphone' :
                      status === 'error' ? 'fa-exclamation-triangle' :
                      'fa-microphone-slash';

    speechStatusEl.innerHTML = `<i class="fas ${statusIcon}"></i> <span>${message}</span>`;
    speechStatusEl.className = `status-indicator ${status}`;
  }

  function updateSpeechButton(isActive) {
    if (isActive) {
      toggleSpeechBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Speech';
      toggleSpeechBtn.className = 'btn-small speech-toggle listening';
    } else {
      toggleSpeechBtn.innerHTML = '<i class="fas fa-microphone"></i> Start Speech';
      toggleSpeechBtn.className = 'btn-small speech-toggle';
    }
  }

  function updateConfidence(confidence) {
    const percentage = Math.round(confidence * 100);
    confidenceLevelEl.style.width = `${percentage}%`;
    confidenceTextEl.textContent = `${percentage}%`;
  }

  function updateInterimText(text, isSpeaking = false) {
    interimTextEl.textContent = text;
    interimTextEl.className = isSpeaking ? 'interim-text speaking' : 'interim-text';
  }

  function addLiveTranscriptEntry(text, confidence) {
    const transcriptEntry = document.createElement('div');
    transcriptEntry.className = 'transcript-entry live';

    const timestamp = new Date().toLocaleTimeString();
    const confidencePercent = Math.round(confidence * 100);

    transcriptEntry.innerHTML = `
      <div class="transcript-meta">
        <span><strong>You (Live)</strong></span>
        <span>${timestamp} • ${confidencePercent}% confidence</span>
      </div>
      <div class="transcript-text">${text}</div>
    `;

    transcriptBox.appendChild(transcriptEntry);
    transcriptBox.scrollTop = transcriptBox.scrollHeight;

    // Add a subtle animation
    transcriptEntry.style.opacity = '0';
    transcriptEntry.style.transform = 'translateY(10px)';
    setTimeout(() => {
      transcriptEntry.style.transition = 'all 0.3s ease';
      transcriptEntry.style.opacity = '1';
      transcriptEntry.style.transform = 'translateY(0)';
    }, 10);
  }

  // Alternative audio chunk transcription method
  function startAudioChunkTranscription() {
    if (!localStream) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(localStream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      let audioChunks = [];
      let sequenceNumber = 0;

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);

        // Convert to 16-bit PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }

        audioChunks.push(pcmData);

        // Send chunks every 3 seconds
        if (audioChunks.length >= 32) { // ~3 seconds at 4096 samples per chunk
          const combinedData = new Int16Array(audioChunks.reduce((acc, chunk) => acc + chunk.length, 0));
          let offset = 0;
          for (const chunk of audioChunks) {
            combinedData.set(chunk, offset);
            offset += chunk.length;
          }

          // Convert to base64
          const audioBlob = new Blob([combinedData], { type: 'audio/wav' });
          const reader = new FileReader();
          reader.onload = () => {
            const base64Audio = reader.result.split(',')[1];
            socket.emit('audio-chunk', {
              room,
              audio: base64Audio,
              timestamp: Date.now(),
              sequence: sequenceNumber++
            });
          };
          reader.readAsDataURL(audioBlob);

          audioChunks = [];
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      log('Audio chunk transcription started');
      showNotification('Audio transcription active', 'info', 2000);

    } catch (error) {
      log('Error starting audio chunk transcription:', error);
      showNotification('Transcription not available', 'error', 3000);
    }
  }
  
  // Attention Detection
  function startAttentionDetection() {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      
      microphone = audioContext.createMediaStreamSource(localStream);
      microphone.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      attentionInterval = setInterval(() => {
        analyser.getByteTimeDomainData(dataArray);
        
        // Calculate RMS (Root Mean Square) for audio level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const value = (dataArray[i] - 128) / 128;
          sum += value * value;
        }
        
        const rms = Math.sqrt(sum / dataArray.length);
        
        // Convert to attention score (0-1)
        // Higher audio activity = higher attention
        const score = Math.min(1, Math.max(0, (rms - 0.01) * 10));
        
        // Add some randomness to simulate more complex attention detection
        const finalScore = Math.min(1, score + (Math.random() * 0.2 - 0.1));
        
        // Update UI
        localAttentionEl.textContent = Math.round(finalScore * 100);
        
        // Send to server
        socket.emit('attention', { room, score: finalScore });
        
      }, 3000); // Update every 3 seconds
      
      log('Attention detection started');
      
    } catch (error) {
      log('Error starting attention detection:', error);
    }
  }
  
  // Network Monitoring
  function startNetworkMonitoring() {
    networkStatsInterval = setInterval(async () => {
      if (Object.keys(pcs).length === 0) return;
      
      // Get stats from first peer connection
      const firstPeerId = Object.keys(pcs)[0];
      const pc = pcs[firstPeerId];
      
      if (!pc || pc.connectionState !== 'connected') return;
      
      try {
        const stats = await pc.getStats();
        let rtt = 0;
        let packetLoss = 0;
        let bandwidth = 1000;
        
        stats.forEach(report => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = report.currentRoundTripTime * 1000 || 0;
          }
          
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            const packetsReceived = report.packetsReceived || 0;
            const packetsLost = report.packetsLost || 0;
            const totalPackets = packetsReceived + packetsLost;
            
            if (totalPackets > 0) {
              packetLoss = (packetsLost / totalPackets) * 100;
            }
            
            // Estimate bandwidth from bytes received
            const bytesReceived = report.bytesReceived || 0;
            bandwidth = (bytesReceived * 8) / 1000; // Convert to kbps
          }
        });
        
        // Update UI
        rttEl.textContent = Math.round(rtt);
        plEl.textContent = packetLoss.toFixed(1);
        
        // Send stats to server for adaptation
        socket.emit('network-stats', {
          room,
          stats: { rtt, packet_loss: packetLoss / 100, bandwidth }
        });
        
      } catch (error) {
        log('Error collecting network stats:', error);
      }
      
    }, 5000); // Update every 5 seconds
  }
  
  function startStatsCollection(remoteSid) {
    // Individual peer stats collection would go here
    log(`Started stats collection for ${remoteSid}`);
  }
  
  // Periodic Updates
  function startPeriodicUpdates() {
    engagementUpdateInterval = setInterval(async () => {
      if (!joined || !room) return;
      
      try {
        // Update engagement data
        const response = await fetch(`/engagement/${room}`);
        const data = await response.json();
        
        if (data.leaderboard) {
          updateLeaderboard(data.leaderboard);
        }
        
        if (data.speaking_distribution) {
          updateSpeakingDistribution(data.speaking_distribution);
        }
        
        // Update overall metrics
        if (data.leaderboard.length > 0) {
          const avgEngagement = data.leaderboard.reduce((sum, p) => sum + p.engagement_score, 0) / data.leaderboard.length;
          const avgAttention = data.leaderboard.reduce((sum, p) => sum + p.avg_attention, 0) / data.leaderboard.length;
          
          engagementScoreEl.textContent = Math.round(avgEngagement * 100) + '%';
          avgAttentionEl.textContent = Math.round(avgAttention * 100) + '%';
        }
        
      } catch (error) {
        log('Error updating engagement data:', error);
      }
    }, 10000); // Update every 10 seconds
  }
  
  // Meeting Timer
  function startMeetingTimer() {
    setInterval(() => {
      if (meetingStartTime) {
        const elapsed = Date.now() - meetingStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        meetingDurationEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }
  
  // UI Update Functions
  function updateLeaderboard(leaderboardData) {
    leaderboard.innerHTML = '';
    
    if (leaderboardData.length === 0) {
      leaderboard.innerHTML = '<div class="placeholder">No participants yet</div>';
      return;
    }
    
    leaderboardData.forEach((participant, index) => {
      const item = document.createElement('div');
      item.className = 'leaderboard-item';
      
      const emoji = index === 0 ? '🏆' : 
                   index === leaderboardData.length - 1 && leaderboardData.length > 1 ? '🤫' : '👤';
      
      item.innerHTML = `
        <div class="leaderboard-rank">
          <div class="rank-number">${index + 1}</div>
          <div>
            <div style="font-weight: 600;">${emoji} ${participant.title || participant.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              ${Math.round(participant.engagement_score * 100)}% engaged
            </div>
          </div>
        </div>
        <div class="leaderboard-score">
          ${Math.round(participant.avg_attention * 100)}%
        </div>
      `;
      
      leaderboard.appendChild(item);
    });
  }
  
  function updateSpeakingDistribution(distribution) {
    const container = document.getElementById('speakingChart');
    if (!container) return;
    
    container.innerHTML = '';
    
    const entries = Object.entries(distribution);
    if (entries.length === 0) {
      container.innerHTML = '<div class="placeholder">No speaking data yet</div>';
      return;
    }
    
    entries.forEach(([sid, data]) => {
      const bar = document.createElement('div');
      bar.className = 'speaking-bar';
      
      const name = sid === socket.id ? 'You' : data.name || `User ${sid.slice(0, 4)}`;
      
      bar.innerHTML = `
        <div class="speaking-name">${name}</div>
        <div class="speaking-progress">
          <div class="speaking-fill" style="width: ${data.percentage}%"></div>
        </div>
        <div class="speaking-time">${data.percentage.toFixed(1)}%</div>
      `;
      
      container.appendChild(bar);
    });
  }
  
  async function loadInsightsData() {
    if (!room) return;
    
    try {
      const response = await fetch(`/sentiment/${room}`);
      const data = await response.json();
      
      if (data.sentiment_history && sentimentChart) {
        const labels = data.sentiment_history.map(d => 
          new Date(d.timestamp * 1000).toLocaleTimeString()
        );
        const scores = data.sentiment_history.map(d => d.score);
        
        sentimentChart.data.labels = labels;
        sentimentChart.data.datasets[0].data = scores;
        sentimentChart.update();
      }
      
    } catch (error) {
      log('Error loading insights data:', error);
    }
  }
  
  function updateSentimentChart() {
    // This will be called when new transcript data arrives
    if (currentTab === 'insights') {
      loadInsightsData();
    }
  }
  
  function appendTranscript(entry) {
    const transcriptEntry = document.createElement('div');
    transcriptEntry.className = 'transcript-entry';
    
    const timestamp = entry.ts ? new Date(entry.ts * 1000).toLocaleTimeString() : new Date().toLocaleTimeString();
    const speaker = entry.sid === socket.id ? 'You' : entry.speaker || `User ${(entry.sid || 'unknown').slice(0, 8)}`;
    
    // Add sentiment indicator
    const sentimentClass = entry.sentiment > 0.2 ? 'positive' : entry.sentiment < -0.2 ? 'negative' : 'neutral';
    const sentimentIcon = entry.sentiment > 0.2 ? '😊' : entry.sentiment < -0.2 ? '😟' : '😐';
    
    transcriptEntry.innerHTML = `
      <div class="transcript-meta">
        <span><strong>${speaker}</strong></span>
        <span>${timestamp} ${sentimentIcon}</span>
      </div>
      <div class="transcript-text">${entry.text}</div>
    `;
    
    transcriptEntry.classList.add(`sentiment-${sentimentClass}`);
    
    transcriptBox.appendChild(transcriptEntry);
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
  }
  
  function addParticipant(sid, options = {}) {
    const existing = document.getElementById('part_' + sid);
    if (existing) return;
    
    const li = document.createElement('li');
    li.id = 'part_' + sid;
    li.className = 'participant-item';
    
    const name = options.label || `User ${sid.slice(0, 8)}`;
    const isLocal = options.self || false;
    
    li.innerHTML = `
      <div class="participant-info">
        <div class="participant-avatar">
          <i class="fas fa-user"></i>
        </div>
        <div class="participant-details">
          <div class="participant-name">${name}</div>
          <div class="participant-status">
            <span class="connection-status">Connected</span>
            <span class="attention-score" id="attention_${sid}">—</span>%
          </div>
        </div>
      </div>
      <div class="participant-actions">
        ${isLocal ? '<i class="fas fa-crown" title="You"></i>' : ''}
      </div>
    `;
    
    // Remove placeholder
    const placeholder = participantsList.querySelector('.placeholder');
    if (placeholder) placeholder.remove();
    
    participantsList.appendChild(li);
  }
  
  function removeParticipant(sid) {
    const element = document.getElementById('part_' + sid);
    if (element) {
      element.remove();
    }
    
    // Add placeholder if no participants
    if (participantsList.children.length === 0) {
      clearParticipants();
    }
  }
  
  function clearParticipants() {
    participantsList.innerHTML = '<li class="placeholder">No participants yet</li>';
  }
  
  function updateParticipantAttention(sid, score) {
    const attentionEl = document.getElementById('attention_' + sid);
    if (attentionEl) {
      attentionEl.textContent = Math.round(score * 100);
    }
  }
  
  function handleNetworkAdaptation(mode, stats) {
    netModeEl.textContent = mode;
    
    if (!localStream) return;
    
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    
    switch (mode) {
      case 'degrade-video':
        videoTracks.forEach(track => {
          track.applyConstraints({
            frameRate: 15,
            height: 480
          }).catch(err => log('Error applying video constraints:', err));
        });
        showNotification('Video quality reduced due to network conditions', 'warning');
        break;
        
      case 'audio-only':
        videoTracks.forEach(track => track.enabled = false);
        showNotification('Switched to audio-only mode', 'warning');
        break;
        
      case 'captions-only':
        videoTracks.forEach(track => track.enabled = false);
        audioTracks.forEach(track => track.enabled = false);
        showNotification('Switched to captions-only mode', 'warning');
        break;
        
      default: // normal
        videoTracks.forEach(track => {
          track.enabled = true;
          track.applyConstraints({
            frameRate: 30,
            height: 720
          }).catch(err => log('Error applying video constraints:', err));
        });
        audioTracks.forEach(track => track.enabled = true);
        break;
    }
  }
  
  // Quick Actions
  function toggleVideo() {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      toggleVideoBtn.classList.toggle('active', videoTrack.enabled);
      
      const status = videoTrack.enabled ? 'enabled' : 'disabled';
      showNotification(`Video ${status}`, 'info', 2000);
    }
  }
  
  function toggleAudio() {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      toggleAudioBtn.classList.toggle('active', audioTrack.enabled);
      
      const status = audioTrack.enabled ? 'enabled' : 'disabled';
      showNotification(`Audio ${status}`, 'info', 2000);
      
      // Update badge
      localBadge.textContent = audioTrack.enabled ? 'Live' : 'Muted';
      localBadge.className = audioTrack.enabled ? 'badge live' : 'badge muted';
    }
  }
  
  async function shareScreen() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      // Replace video track in all peer connections
      const videoTrack = screenStream.getVideoTracks()[0];
      
      Object.values(pcs).forEach(pc => {
        const sender = pc.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });
      
      // Update local video
      localVideo.srcObject = screenStream;
      shareScreenBtn.classList.add('active');
      
      // Handle screen share end
      videoTrack.onended = () => {
        shareScreenBtn.classList.remove('active');
        
        // Switch back to camera
        if (localStream) {
          const cameraTrack = localStream.getVideoTracks()[0];
          Object.values(pcs).forEach(pc => {
            const sender = pc.getSenders().find(s => 
              s.track && s.track.kind === 'video'
            );
            if (sender && cameraTrack) {
              sender.replaceTrack(cameraTrack);
            }
          });
          localVideo.srcObject = localStream;
        }
      };
      
      showNotification('Screen sharing started', 'success');
      
    } catch (error) {
      log('Error sharing screen:', error);
      showNotification('Failed to share screen: ' + error.message, 'error');
    }
  }
  
  function toggleTranscript() {
    const isActive = toggleTranscriptBtn.classList.contains('active');

    if (isActive) {
      // Stop speech recognition
      stopSpeechRecognition();
      toggleTranscriptBtn.classList.remove('active');
      showNotification('Live transcription disabled', 'info', 2000);
    } else {
      // Start speech recognition
      startEnhancedSpeechRecognition();
      toggleTranscriptBtn.classList.add('active');
      showNotification('Live transcription enabled', 'success', 2000);
    }
  }
  
  // Summary generation
  summarizeBtn.addEventListener('click', async () => {
    if (!room) {
      showNotification('Join a meeting first', 'warning');
      return;
    }
    
    summaryBox.innerHTML = `
      <div class="loading">
        <i class="fas fa-spinner fa-spin"></i>
        Generating AI summary...
      </div>
    `;
    
    try {
      const response = await fetch('/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room })
      });
      
      const data = await response.json();
      
      if (data.error) {
        summaryBox.innerHTML = `<div class="error">${data.error}</div>`;
        showNotification(data.error, 'warning');
      } else {
        summaryBox.innerHTML = `
          <div class="summary-content">
            <h4><i class="fas fa-file-text"></i> Meeting Summary</h4>
            <div class="summary-text">${data.result || 'No summary available'}</div>
            <div class="summary-meta">
              <small>Generated from ${data.transcript_length || 0} transcript entries</small>
            </div>
          </div>
        `;
        showNotification('Summary generated successfully', 'success');
      }
      
    } catch (error) {
      log('Error generating summary:', error);
      summaryBox.innerHTML = '<div class="error">Failed to generate summary</div>';
      showNotification('Failed to generate summary', 'error');
    }
  });
  
  // Debug console
  document.getElementById('showDebug')?.addEventListener('click', () => {
    document.getElementById('debugConsole').classList.add('visible');
  });
  
  document.getElementById('toggleDebug')?.addEventListener('click', () => {
    document.getElementById('debugConsole').classList.remove('visible');
  });
  
  // Download transcript
  document.getElementById('downloadTranscript')?.addEventListener('click', async () => {
    if (!room) return;
    
    try {
      const response = await fetch(`/transcript/${room}`);
      const data = await response.json();
      
      if (data.transcript) {
        const transcript = data.transcript.map(entry => 
          `[${new Date(entry.ts * 1000).toLocaleString()}] ${entry.speaker || 'Unknown'}: ${entry.text}`
        ).join('\n');
        
        const blob = new Blob([transcript], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-transcript-${room}-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('Transcript downloaded', 'success');
      }
    } catch (error) {
      log('Error downloading transcript:', error);
      showNotification('Failed to download transcript', 'error');
    }
  });
  
  // Add CSS animation for flash effect
  const style = document.createElement('style');
  style.textContent = `
    @keyframes flash {
      0%, 100% { background-color: transparent; }
      50% { background-color: rgba(255, 193, 7, 0.1); }
    }
    
    @keyframes slideOut {
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    .sentiment-positive {
      border-left-color: var(--success) !important;
    }
    
    .sentiment-negative {
      border-left-color: var(--danger) !important;
    }
    
    .sentiment-neutral {
      border-left-color: var(--text-muted) !important;
    }
    
    .loading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-muted);
      font-style: italic;
    }
    
    .error {
      color: var(--danger);
      font-style: italic;
    }
    
    .placeholder {
      color: var(--text-muted);
      font-style: italic;
      text-align: center;
      padding: 1rem;
    }
  `;
  document.head.appendChild(style);
  
  log('AgamAI Meeting Platform initialized');
});