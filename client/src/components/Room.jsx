import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import socket from '../socket';

const Room = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [creator, setCreator] = useState(null);
  const [sentence1, setSentence1] = useState("");
  const [sentence2, setSentence2] = useState("");
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  // Voice chat state
  const [callActive, setCallActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const peerConnections = useRef({});
  const [callUsers, setCallUsers] = useState([]);
  const navigate = useNavigate();

  const userName = searchParams.get('name');

  // Handler for creator's start button
  const handleStartSentences = () => {
    socket.emit('start-sentences', { roomId });
    setSentence1("");
    setSentence2("");
  };

  useEffect(() => {
    if (!userName) {
      navigate('/');
      return;
    }

    socket.emit('join-room', { roomId, userName });

    socket.on('all-users', (payload) => {
      // Support both old and new payloads
      let userList, creatorName;
      if (Array.isArray(payload)) {
        userList = payload;
        creatorName = payload.length > 0 ? payload[0].userName : null;
      } else {
        userList = payload.users;
        creatorName = payload.creator;
      }
      setUsers(userList);
      setCreator(creatorName);
      setCallUsers(userList.map(u => u.socketId));
      // If call is active, connect to new users
      if (callActive && localStream) {
        userList.forEach(user => {
          if (user.socketId !== socket.id && !peerConnections.current[user.socketId]) {
            const pc = createPeerConnection(user.socketId);
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
            pc.createOffer().then(offer => {
              pc.setLocalDescription(offer);
              socket.emit('webrtc-offer', { to: user.socketId, offer });
            });
          }
        });
      }
    });
    socket.on('sentence-1', ({ sentence }) => {
      setSentence1(sentence);
    });
    socket.on('sentence-2', ({ sentence }) => {
      setSentence2(sentence);
    });

    socket.on('user-joined', (data) => {
      setUsers((prev) => [...prev, data]);
    });

    socket.on('user-left', ({ socketId }) => {
      setUsers((prev) => prev.filter(user => user.socketId !== socketId));
      setRemoteStreams(prev => prev.filter(s => s.peerId !== socketId));
      if (peerConnections.current[socketId]) {
        peerConnections.current[socketId].close();
        delete peerConnections.current[socketId];
      }
    });

    socket.on('chat-message', (data) => {
      // Mark message as 'self' if sent by this user, add timestamp
      const isSelf = data.userName === userName;
      const now = new Date();
      const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, { ...data, self: isSelf, time }]);
    });

    // WebRTC signaling handlers
    socket.on('webrtc-offer', async ({ from, offer }) => {
      if (from === socket.id) return;
      if (!localStream) return;
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new window.RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { to: from, answer });
    });

    socket.on('webrtc-answer', async ({ from, answer }) => {
      const pc = peerConnections.current[from];
      if (pc) {
        await pc.setRemoteDescription(new window.RTCSessionDescription(answer));
      }
    });

    socket.on('webrtc-ice-candidate', ({ from, candidate }) => {
      const pc = peerConnections.current[from];
      if (pc && candidate) {
        pc.addIceCandidate(new window.RTCIceCandidate(candidate));
      }
    });

    // Start call automatically when entering room
    (async () => {
      if (!callActive) {
        await startCall();
      }
    })();

    return () => {
      socket.off('all-users');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('chat-message');
      socket.off('sentence-1');
      socket.off('sentence-2');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
    };
  }, [roomId, userName]);
  // --- WebRTC logic ---
  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      setCallActive(true);
      // Call all other users in the room
      callUsers.forEach(peerId => {
        if (peerId !== socket.id) {
          const pc = createPeerConnection(peerId);
          stream.getTracks().forEach(track => pc.addTrack(track, stream));
          pc.createOffer().then(offer => {
            pc.setLocalDescription(offer);
            socket.emit('webrtc-offer', { to: peerId, offer });
          });
        }
      });
    } catch (err) {
      alert('Could not access microphone: ' + err.message);
    }
  };

  function createPeerConnection(peerId) {
    if (peerConnections.current[peerId]) return peerConnections.current[peerId];
    const pc = new window.RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peerConnections.current[peerId] = pc;
    pc.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', { to: peerId, candidate: event.candidate });
      }
    };
    pc.ontrack = event => {
      setRemoteStreams(prev => {
        // Prevent duplicate streams
        const already = prev.find(s => s.id === event.streams[0].id);
        if (already) return prev;
        // Attach peerId for cleanup
        return [...prev, { ...event.streams[0], peerId }];
      });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        pc.close();
        delete peerConnections.current[peerId];
      }
    };
    return pc;
  }

  const handleExit = () => {
    // Stop all media tracks and close peer connections
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    Object.values(peerConnections.current).forEach(pc => pc.close());
    setCallActive(false);
    setLocalStream(null);
    setRemoteStreams([]);
    // Emit exit-room event to server
    socket.emit('exit-room', { roomId, userName });
    navigate('/');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() === "") return;
    socket.emit('chat-message', { roomId, userName, text: message });
    setMessage("");
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '30px' }}>
      <div style={{ marginBottom: '20px' }}>
        {callActive && (
          <button
            onClick={() => {
              if (localStream) {
                // Toggle mute state
                const newMuted = !micMuted;
                localStream.getAudioTracks().forEach(track => {
                  track.enabled = !newMuted;
                });
                setMicMuted(newMuted);
                // Replace audio track in all peer connections
                Object.values(peerConnections.current).forEach(pc => {
                  const senders = pc.getSenders().filter(s => s.track && s.track.kind === 'audio');
                  senders.forEach(sender => {
                    if (newMuted) {
                      sender.replaceTrack(null);
                    } else {
                      const audioTrack = localStream.getAudioTracks()[0];
                      if (audioTrack) sender.replaceTrack(audioTrack);
                    }
                  });
                });
              }
            }}
            style={{
              padding: '8px 16px',
              fontWeight: 'bold',
              background: micMuted ? '#888' : '#075e54',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              marginRight: '10px',
            }}
          >
            {micMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          </button>
        )}
      </div>
      {callActive && (
        <div style={{ marginBottom: '20px' }}>
          <h4>Voice Call:</h4>
          <audio autoPlay controls style={{ display: localStream ? 'block' : 'none', margin: '0 auto' }} ref={audio => { if (audio && localStream) audio.srcObject = localStream; }} />
          {remoteStreams.map((stream, idx) => (
            <audio key={stream.id} autoPlay controls style={{ display: 'block', margin: '10px auto' }} ref={audio => { if (audio && stream) audio.srcObject = stream; }} />
          ))}
        </div>
      )}
      <h2>Room: {roomId}</h2>
      <h3>Welcome, {userName}</h3>
      <button onClick={handleExit}>Exit</button>
      <h4>Users in room:</h4>
      {creator === userName && (
        <button onClick={handleStartSentences} style={{marginBottom:'10px',padding:'8px 16px',background:'#007bff',color:'#fff',border:'none',borderRadius:'6px',cursor:'pointer'}}>Start</button>
      )}
      <ul>
        {users.map(user => (
          <li key={user.socketId}>{user.userName}</li>
        ))}
      </ul>
      {sentence1 && (
        <div style={{marginTop:'20px',fontWeight:'bold',color:'#333'}}>Sentence 1: {sentence1}</div>
      )}
      {sentence2 && (
        <div style={{marginTop:'10px',fontWeight:'bold',color:'#d9534f'}}>Your secret sentence: {sentence2}</div>
      )}
      <div style={{ marginTop: '30px' }}>
        <h4>Chat:</h4>
        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ccc', marginBottom: '10px', padding: '10px', width: '300px', margin: '0 auto' }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: msg.self ? 'flex-end' : 'flex-start',
                margin: '8px 0',
              }}
            >
              <div
                style={{
                  background: msg.self ? '#dcf8c6' : '#fff',
                  color: '#222',
                  borderRadius: msg.self ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '8px 14px',
                  maxWidth: '70%',
                  minWidth: '60px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  border: '1px solid #e0e0e0',
                  position: 'relative',
                  fontSize: '15px',
                  wordBreak: 'break-word',
                  textAlign: 'left',
                }}
              >
                {!msg.self && (
                  <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '13px', color: '#075e54' }}>{msg.userName}</div>
                )}
                <span>{msg.text}</span>
                <span style={{
                  fontSize: '11px',
                  color: '#888',
                  position: 'absolute',
                  right: msg.self ? '8px' : 'auto',
                  left: !msg.self ? '8px' : 'auto',
                  bottom: '4px',
                }}>{msg.time}</span>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleSendMessage} style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type a message..."
            style={{ width: '200px' }}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
};

export default Room;
