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
  const localAudioRef = useRef(null);
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
      // Always request latest users from server after a user leaves
      socket.emit('get-room-users', { roomId });
      setRemoteStreams(prev => prev.filter(s => s.peerId !== socketId));
      if (peerConnections.current[socketId]) {
        peerConnections.current[socketId].close();
        delete peerConnections.current[socketId];
      }
      // Do NOT stop localStream or reset callActive here; only remove remote stream and peer connection for the exited user
    });

    // Listen for server response to get-room-users
    socket.on('room-users', ({ users: latestUsers, creator: latestCreator }) => {
      setUsers(latestUsers);
      setCreator(latestCreator);
      setCallUsers(latestUsers.map(u => u.socketId));
    });

    socket.on('chat-message', (data) => {
      const isSelf = data.userName === userName;
      const now = new Date();
      const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, { ...data, self: isSelf, time }]);
    });

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

    if (!callActive) {
      startCall();
    }

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

  // Attach localStream to audio element only when localStream changes
  useEffect(() => {
    if (localAudioRef.current && localStream) {
      localAudioRef.current.srcObject = localStream;
    }
  }, [localStream]);
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
    // Stop only local media tracks and close peer connections for this user
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
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
    <div style={{ background: '#222', minHeight: '100vh', padding: '32px' }}>
      <div style={{ background: '#fff', borderRadius: '8px', maxWidth: '1100px', margin: '0 auto', padding: '32px', boxShadow: '0 2px 16px rgba(0,0,0,0.12)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px', fontFamily: 'serif', fontWeight: 'bold', fontSize: '22px' }}>
          Room : <span style={{ color: '#222', fontWeight: 'bold' }}>{roomId}</span>
        </div>
        <div style={{ display: 'flex', gap: '32px', justifyContent: 'center' }}>
          {/* Users Section */}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'serif', fontSize: '18px', marginBottom: '12px' }}>Users in the room :</div>
            <div style={{ background: '#d6d6d6', borderRadius: '12px', padding: '32px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', minHeight: '340px', alignItems: 'center', justifyItems: 'center' }}>
              {users.length === 0 ? (
                <div style={{ gridColumn: 'span 2', color: '#888', fontSize: '20px' }}>No users</div>
              ) : (
                users.map((user, idx) => (
                  <div key={user.userName + idx} style={{ background: '#111', color: '#fff', fontFamily: 'serif', fontSize: '24px', borderRadius: '10px', padding: '18px 0', width: '220px', textAlign: 'center', letterSpacing: '2px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                    {user.userName}
                  </div>
                ))
                )}
            </div>
            <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', marginTop: '32px' }}>
              <button onClick={handleExit} style={{ background: '#d6d6d6', border: 'none', borderRadius: '8px', padding: '12px 36px', fontFamily: 'serif', fontSize: '20px', cursor: 'pointer' }}>exit</button>
              {creator === userName && (
                <button onClick={handleStartSentences} style={{ background: '#d6d6d6', border: 'none', borderRadius: '8px', padding: '12px 36px', fontFamily: 'serif', fontSize: '20px', cursor: 'pointer' }}>Start</button>
              )}
              {callActive && (
                <button
                  onClick={() => {
                    if (localStream) {
                      const newMuted = !micMuted;
                      localStream.getAudioTracks().forEach(track => {
                        track.enabled = !newMuted;
                      });
                      setMicMuted(newMuted);
                    }
                  }}
                  style={{ background: '#d6d6d6', border: 'none', borderRadius: '50%', padding: '12px 0', width: '70px', fontFamily: 'serif', fontSize: '20px', cursor: 'pointer', textAlign: 'center' }}
                >
                  {micMuted ? 'unmute' : 'mute'}
                </button>
              )}
            </div>
            {callActive && (
              <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'serif', fontSize: '18px', marginBottom: '8px' }}>Voice Call:</div>
                <audio autoPlay controls style={{ display: localStream ? 'block' : 'none', margin: '0 auto' }} ref={localAudioRef} />
                {remoteStreams.map((stream, idx) => (
                  <audio key={stream.id} autoPlay controls style={{ display: 'block', margin: '10px auto' }} ref={audio => { if (audio && stream) audio.srcObject = stream; }} />
                ))}
              </div>
            )}
            {sentence1 && (
              <div style={{marginTop:'24px',fontWeight:'bold',color:'#333',fontFamily:'serif',fontSize:'18px'}}>Sentence 1: {sentence1}</div>
            )}
            {sentence2 && (
              <div style={{marginTop:'12px',fontWeight:'bold',color:'#d9534f',fontFamily:'serif',fontSize:'18px'}}>Your secret sentence: {sentence2}</div>
            )}
          </div>
          {/* Chat Section */}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'serif', fontSize: '18px', marginBottom: '12px', textAlign: 'center' }}>Chat</div>
            <div style={{ background: '#d6d6d6', borderRadius: '12px', minHeight: '340px', padding: '18px', marginBottom: '18px', maxHeight: '340px', overflowY: 'auto' }}>
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
                      background: msg.self ? '#fff' : '#222',
                      color: msg.self ? '#222' : '#fff',
                      borderRadius: '10px',
                      padding: '10px 18px',
                      minWidth: '80px',
                      fontFamily: 'serif',
                      fontSize: '17px',
                      wordBreak: 'break-word',
                      textAlign: 'left',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                      border: '1px solid #e0e0e0',
                      position: 'relative',
                    }}
                  >
                    {!msg.self && (
                      <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '15px', color: '#075e54' }}>{msg.userName}</div>
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
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
              <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="type a message..."
                style={{ width: '220px', padding: '10px', borderRadius: '8px', border: 'none', background: '#d6d6d6', fontFamily: 'serif', fontSize: '16px' }}
              />
              <button type="submit" style={{ background: '#d6d6d6', border: 'none', borderRadius: '8px', padding: '10px 18px', fontFamily: 'serif', fontSize: '16px', cursor: 'pointer' }}>send</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;
