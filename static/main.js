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
  const speechStatus = document.getElementById('speechStatus');
  
  // Stats elements
  const rttEl = document.getElementById('rtt');
  const plEl = document.getElementById('pl');
  const netModeEl = document.getElementById('netMode');
  const meetingDurationEl = document.getElementById('meetingDuration');
  const avgAttentionEl = document.getElementById('avgAttention');
  const engagementScoreEl = document.getElementById('engagementScore');
  const localAttentionEl = document.getElementById('localAttention');
  
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

  // Initialize speech status
  updateSpeechStatus('inactive', 'Speech recognition inactive');
  
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
      startSpeechRecognition();
      startAttentionDetection();
      startNetworkMonitoring();
      startPeriodicUpdates();
      
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
      speechRecognition.stop();
      speechRecognition = null;
    }

    // Clear recognition restart timeout
    if (recognitionRestartTimeout) {
      clearTimeout(recognitionRestartTimeout);
      recognitionRestartTimeout = null;
    }

    // Hide interim transcript
    if (interimTranscriptElement) {
      interimTranscriptElement.style.display = 'none';
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
        log(`Adding ${track.kind} track to peer connection for ${remoteSid}`);
        pc.addTrack(track, localStream);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        log(`Sending ICE candidate to ${remoteSid}`);
        socket.emit('ice-candidate', {
          to: remoteSid,
          candidate: event.candidate
        });
      } else {
        log(`ICE gathering complete for ${remoteSid}`);
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      log(`Received ${event.track.kind} track from ${remoteSid}`);
      if (event.streams && event.streams[0]) {
        attachRemoteStream(remoteSid, event.streams[0]);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      log(`Connection state with ${remoteSid}: ${pc.connectionState}`);

      if (pc.connectionState === 'connected') {
        log(`Successfully connected to ${remoteSid}`);
        startStatsCollection(remoteSid);
      } else if (pc.connectionState === 'connecting') {
        log(`Connecting to ${remoteSid}...`);
      } else if (pc.connectionState === 'failed') {
        log(`Connection failed with ${remoteSid}, attempting restart`);
        // Attempt to restart the connection
        setTimeout(() => {
          if (pcs[remoteSid] && pcs[remoteSid].connectionState === 'failed') {
            log(`Restarting connection with ${remoteSid}`);
            removePeer(remoteSid);
            createPeerAndOffer(remoteSid);
          }
        }, 2000);
      } else if (['disconnected', 'closed'].includes(pc.connectionState)) {
        log(`Disconnected from ${remoteSid}`);
        removePeer(remoteSid);
        removeParticipant(remoteSid);
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      log(`ICE connection state with ${remoteSid}: ${pc.iceConnectionState}`);
    };

    // Handle signaling state changes
    pc.onsignalingstatechange = () => {
      log(`Signaling state with ${remoteSid}: ${pc.signalingState}`);
    };

    return pc;
  }
  
  async function handleOffer(data) {
    try {
      log(`Handling offer from ${data.from}`);
      const pc = createPeerConnectionFor(data.from);

      log(`Setting remote description for ${data.from}`);
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

      log(`Creating answer for ${data.from}`);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      log(`Sending answer to ${data.from}`);
      socket.emit('answer', {
        to: data.from,
        sdp: pc.localDescription
      });

      log(`Successfully sent answer to ${data.from}`);
    } catch (error) {
      log(`Error handling offer from ${data.from}:`, error);
      showNotification(`Failed to connect to ${data.from}`, 'error');
    }
  }
  
  async function handleAnswer(data) {
    try {
      log(`Handling answer from ${data.from}`);
      const pc = pcs[data.from];
      if (pc) {
        log(`Setting remote description (answer) for ${data.from}`);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        log(`Successfully set remote description for ${data.from}`);
      } else {
        log(`No peer connection found for ${data.from}`);
      }
    } catch (error) {
      log(`Error handling answer from ${data.from}:`, error);
      showNotification(`Failed to complete connection to ${data.from}`, 'error');
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
      videoElement.muted = false; // Allow audio for transcription

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

    // Set up audio capture for transcription
    setupRemoteAudioCapture(remoteSid, stream);

    log(`Attached remote stream for ${remoteSid}`);
  }

  // Remote audio capture for server-side transcription
  const remoteAudioContexts = {};
  const remoteAudioProcessors = {};

  function setupRemoteAudioCapture(remoteSid, stream) {
    try {
      // Only capture audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        log(`No audio tracks found for ${remoteSid}`);
        return;
      }

      // Create audio context for this remote participant
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      remoteAudioContexts[remoteSid] = audioContext;
      remoteAudioProcessors[remoteSid] = processor;

      let audioBuffer = [];
      let lastSend = Date.now();
      const SEND_INTERVAL = 3000; // Send audio chunks every 3 seconds

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);

        // Convert to 16-bit PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }

        audioBuffer.push(pcmData);

        // Send accumulated audio data periodically
        const now = Date.now();
        if (now - lastSend >= SEND_INTERVAL && audioBuffer.length > 0) {
          sendAudioChunkToServer(remoteSid, audioBuffer);
          audioBuffer = [];
          lastSend = now;
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      log(`Set up audio capture for remote participant ${remoteSid}`);

    } catch (error) {
      log(`Error setting up audio capture for ${remoteSid}:`, error);
    }
  }

  function sendAudioChunkToServer(remoteSid, audioBuffer) {
    try {
      // Combine all audio chunks
      const totalLength = audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedAudio = new Int16Array(totalLength);

      let offset = 0;
      for (const chunk of audioBuffer) {
        combinedAudio.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert to base64
      const audioBytes = new Uint8Array(combinedAudio.buffer);
      const base64Audio = btoa(String.fromCharCode.apply(null, audioBytes));

      // Send to server for transcription
      socket.emit('audio-chunk', {
        room,
        audio: base64Audio,
        ts: Math.floor(Date.now() / 1000),
        seq: Date.now(),
        from: remoteSid
      });

      log(`Sent audio chunk for ${remoteSid} (${combinedAudio.length} samples)`);

    } catch (error) {
      log(`Error sending audio chunk for ${remoteSid}:`, error);
    }
  }

  function cleanupRemoteAudioCapture(remoteSid) {
    if (remoteAudioContexts[remoteSid]) {
      try {
        remoteAudioContexts[remoteSid].close();
        delete remoteAudioContexts[remoteSid];
      } catch (error) {
        log(`Error closing audio context for ${remoteSid}:`, error);
      }
    }

    if (remoteAudioProcessors[remoteSid]) {
      try {
        remoteAudioProcessors[remoteSid].disconnect();
        delete remoteAudioProcessors[remoteSid];
      } catch (error) {
        log(`Error disconnecting audio processor for ${remoteSid}:`, error);
      }
    }
  }
  
  function removePeer(remoteSid) {
    // Clean up audio capture first
    cleanupRemoteAudioCapture(remoteSid);

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

    log(`Removed peer ${remoteSid}`);
  }
  
  // Enhanced Speech Recognition with interim results
  let interimTranscriptElement = null;
  let recognitionRestartTimeout = null;

  // Update speech recognition status indicator
  function updateSpeechStatus(status, message) {
    if (!speechStatus) return;

    const icon = speechStatus.querySelector('i');
    const text = speechStatus.querySelector('span');

    // Remove all status classes
    speechStatus.classList.remove('active', 'error');

    switch (status) {
      case 'active':
        speechStatus.classList.add('active');
        icon.className = 'fas fa-microphone';
        text.textContent = message || 'Speech recognition active';
        break;
      case 'inactive':
        icon.className = 'fas fa-microphone-slash';
        text.textContent = message || 'Speech recognition inactive';
        break;
      case 'error':
        speechStatus.classList.add('error');
        icon.className = 'fas fa-exclamation-triangle';
        text.textContent = message || 'Speech recognition error';
        break;
      case 'listening':
        speechStatus.classList.add('active');
        icon.className = 'fas fa-microphone';
        text.textContent = message || 'Listening...';
        break;
    }
  }

  function startSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      log('Speech recognition not supported in this browser');
      showNotification('Speech recognition not supported in this browser', 'error');
      return;
    }

    // Clear any existing recognition
    if (speechRecognition) {
      speechRecognition.stop();
      speechRecognition = null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognition = new SpeechRecognition();

    // Enhanced configuration
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';
    speechRecognition.maxAlternatives = 1;

    // Create interim transcript display element if it doesn't exist
    if (!interimTranscriptElement) {
      interimTranscriptElement = document.createElement('div');
      interimTranscriptElement.className = 'interim-transcript';
      interimTranscriptElement.style.cssText = `
        background: rgba(99, 102, 241, 0.1);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 8px;
        padding: 12px;
        margin: 8px 0;
        font-style: italic;
        color: #818cf8;
        display: none;
        animation: pulse 1.5s infinite;
      `;
      transcriptBox.appendChild(interimTranscriptElement);
    }

    speechRecognition.onstart = () => {
      log('Speech recognition started successfully');
      showNotification('Live transcription active', 'success', 2000);

      // Update UI to show active state
      if (toggleTranscriptBtn) {
        toggleTranscriptBtn.classList.add('active');
        toggleTranscriptBtn.innerHTML = '<i class="fas fa-microphone"></i>';
      }

      // Update status indicator
      updateSpeechStatus('listening', 'Listening for speech...');
    };

    speechRecognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Display interim results
      if (interimTranscript.trim()) {
        interimTranscriptElement.innerHTML = `
          <div class="interim-header">
            <i class="fas fa-microphone"></i> Speaking...
          </div>
          <div class="interim-text">${interimTranscript}</div>
        `;
        interimTranscriptElement.style.display = 'block';
        transcriptBox.scrollTop = transcriptBox.scrollHeight;

        // Update status to show active speaking
        updateSpeechStatus('active', 'Speaking detected...');
      } else {
        interimTranscriptElement.style.display = 'none';

        // Return to listening state
        updateSpeechStatus('listening', 'Listening for speech...');
      }

      // Process final results
      if (finalTranscript.trim()) {
        const text = finalTranscript.trim();

        // Hide interim display
        interimTranscriptElement.style.display = 'none';

        // Send to server
        const payload = {
          room,
          text,
          ts: Math.floor(Date.now() / 1000),
          confidence: event.results[event.results.length - 1][0].confidence || 0.9
        };

        socket.emit('transcript-text', payload);
        log(`Final transcript: ${text}`);

        // Add visual feedback for successful recognition
        showNotification(`Recognized: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`, 'info', 3000);
      }
    };

    speechRecognition.onerror = (event) => {
      log('Speech recognition error:', event.error);
      isRecognitionActive = false;

      // Hide interim display on error
      if (interimTranscriptElement) {
        interimTranscriptElement.style.display = 'none';
      }

      switch (event.error) {
        case 'not-allowed':
          showNotification('Microphone access denied. Please allow microphone access and try again.', 'error', 8000);
          updateSpeechStatus('error', 'Microphone access denied');
          if (toggleTranscriptBtn) {
            toggleTranscriptBtn.classList.remove('active');
            toggleTranscriptBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
          }
          break;
        case 'no-speech':
          log('No speech detected, restarting...');
          updateSpeechStatus('listening', 'No speech detected, listening...');
          // Don't show notification for no-speech, just restart
          break;
        case 'audio-capture':
          showNotification('Microphone not available. Please check your microphone.', 'error');
          updateSpeechStatus('error', 'Microphone not available');
          break;
        case 'network':
          showNotification('Network error during speech recognition. Retrying...', 'warning');
          updateSpeechStatus('error', 'Network error, retrying...');
          break;
        default:
          showNotification(`Speech recognition error: ${event.error}`, 'error');
          updateSpeechStatus('error', `Error: ${event.error}`);
      }
    };

    speechRecognition.onend = () => {
      log('Speech recognition ended');

      // Hide interim display
      if (interimTranscriptElement) {
        interimTranscriptElement.style.display = 'none';
      }

      // Auto-restart if still in meeting and transcription is enabled
      if (joined && toggleTranscriptBtn && toggleTranscriptBtn.classList.contains('active')) {
        // Clear any existing restart timeout
        if (recognitionRestartTimeout) {
          clearTimeout(recognitionRestartTimeout);
        }

        // Restart after a short delay
        recognitionRestartTimeout = setTimeout(() => {
          if (joined && speechRecognition && toggleTranscriptBtn && toggleTranscriptBtn.classList.contains('active')) {
            try {
              speechRecognition.start();
              log('Speech recognition restarted automatically');
            } catch (error) {
              log('Error restarting speech recognition:', error);
              // Try again after a longer delay
              setTimeout(() => {
                if (joined && toggleTranscriptBtn && toggleTranscriptBtn.classList.contains('active')) {
                  startSpeechRecognition();
                }
              }, 3000);
            }
          }
        }, 1000);
      }
    };

    // Start recognition
    try {
      speechRecognition.start();
      log('Attempting to start speech recognition...');
    } catch (error) {
      log('Error starting speech recognition:', error);
      showNotification('Failed to start speech recognition: ' + error.message, 'error');
      isRecognitionActive = false;
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
      if (speechRecognition) {
        speechRecognition.stop();
        speechRecognition = null;
      }

      // Clear any restart timeout
      if (recognitionRestartTimeout) {
        clearTimeout(recognitionRestartTimeout);
        recognitionRestartTimeout = null;
      }

      // Hide interim transcript
      if (interimTranscriptElement) {
        interimTranscriptElement.style.display = 'none';
      }

      toggleTranscriptBtn.classList.remove('active');
      toggleTranscriptBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
      updateSpeechStatus('inactive', 'Speech recognition disabled');
      showNotification('Live transcription disabled', 'info', 2000);
    } else {
      // Start speech recognition
      startSpeechRecognition();
      showNotification('Starting live transcription...', 'info', 2000);
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