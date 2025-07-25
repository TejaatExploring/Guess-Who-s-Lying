import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import socket from '../socket';

const Room = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [creator, setCreator] = useState(null);
  const [gameState, setGameState] = useState('waiting');
  const [sentence1, setSentence1] = useState("");
  const [sentence2, setSentence2] = useState("");
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting', 'connected', 'disconnected', 'reconnecting'
  // Voice chat state
  const [callActive, setCallActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const localAudioRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const peerConnections = useRef({});
  const [callUsers, setCallUsers] = useState([]);
  const hasJoinedRef = useRef(false);
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

    // Prevent multiple join emissions using a ref
    if (hasJoinedRef.current) {
      console.log('Already joined room, skipping duplicate join');
      return;
    }

    console.log(`Joining room ${roomId} as ${userName}`);
    
    // Clean up any stale connections before joining
    socket.emit('cleanup-stale-connection', { roomId, userName });
    
    // Small delay to ensure cleanup completes before joining
    setTimeout(() => {
      socket.emit('join-room', { roomId, userName });
      
      // Request fresh room data after a short delay to ensure consistency
      setTimeout(() => {
        socket.emit('get-room-users', { roomId });
      }, 200);
    }, 100);
    
    hasJoinedRef.current = true;

    const handleAllUsers = (payload) => {
      let userList, creatorName, currentGameState;
      if (Array.isArray(payload)) {
        userList = payload;
        creatorName = payload.length > 0 ? payload[0].userName : null;
        currentGameState = 'waiting';
      } else {
        userList = payload.users;
        creatorName = payload.creator;
        currentGameState = payload.gameState || 'waiting';
      }
      
      console.log('Received all-users update:', { userList, creatorName, currentGameState });
      
      setUsers(userList);
      setCreator(creatorName);
      setGameState(currentGameState);
      setCallUsers(userList.map(u => u.socketId));
      setConnectionStatus('connected'); // Mark as connected when we receive user list
      
      // Always restart WebRTC connections when user list changes to ensure stable mesh
      if (callActive && localStream) {
        console.log('Rebuilding WebRTC mesh due to user list change...');
        
        // Get current peer IDs
        const currentPeerIds = Object.keys(peerConnections.current);
        const newUserIds = userList.map(u => u.socketId).filter(id => id !== socket.id);
        
        // Close connections to users no longer in the room
        currentPeerIds.forEach(peerId => {
          if (!newUserIds.includes(peerId)) {
            console.log(`Closing connection to removed user: ${peerId}`);
            if (peerConnections.current[peerId]) {
              peerConnections.current[peerId].close();
              delete peerConnections.current[peerId];
            }
          }
        });
        
        // Remove remote streams for users no longer in the room
        setRemoteStreams(prev => prev.filter(stream => 
          newUserIds.includes(stream.peerId)
        ));
        
        // Establish connections to all users (new and existing)
        // This ensures robust mesh even when someone refreshes
        userList.forEach(user => {
          if (user.socketId !== socket.id) {
            if (!peerConnections.current[user.socketId]) {
              console.log(`Creating new connection to user: ${user.userName} (${user.socketId})`);
              const pc = createPeerConnection(user.socketId);
              localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
              pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                socket.emit('webrtc-offer', { to: user.socketId, offer });
              });
            } else {
              console.log(`Connection already exists to user: ${user.userName} (${user.socketId})`);
              // Ensure the existing connection has our tracks
              const pc = peerConnections.current[user.socketId];
              const senders = pc.getSenders();
              localStream.getTracks().forEach(track => {
                const sender = senders.find(s => s.track === track);
                if (!sender) {
                  console.log(`Adding missing track to existing connection: ${user.socketId}`);
                  pc.addTrack(track, localStream);
                }
              });
            }
          }
        });
      }
    };

    const handleError = (data) => {
      alert(data.message);
      navigate('/');
    };

    const handleGameStateChanged = ({ gameState: newGameState }) => {
      setGameState(newGameState);
    };

    const handleSentence1 = ({ sentence }) => {
      setSentence1(sentence);
    };

    const handleSentence2 = ({ sentence }) => {
      setSentence2(sentence);
    };

    const handleUserJoined = (data) => {
      setUsers((prev) => [...prev, data]);
    };

    const handleUserLeft = ({ userName: leftUserName }) => {
      // Always request latest users from server after a user leaves
      socket.emit('get-room-users', { roomId });
      
      // Find and remove the user's socket ID for WebRTC cleanup
      const leftUser = users.find(u => u.userName === leftUserName);
      if (leftUser) {
        setRemoteStreams(prev => prev.filter(s => s.peerId !== leftUser.socketId));
        if (peerConnections.current[leftUser.socketId]) {
          peerConnections.current[leftUser.socketId].close();
          delete peerConnections.current[leftUser.socketId];
        }
      }
    };

    const handleCreatorReconnected = ({ creatorName, shouldRebuildConnections }) => {
      console.log(`Creator ${creatorName} has reconnected`);
      setMessages(prev => [...prev, {
        userName: 'System',
        text: `${creatorName} (Creator) has reconnected`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        self: false
      }]);
      
      // Force refresh room data
      setTimeout(() => {
        socket.emit('get-room-users', { roomId });
      }, 500);
    };

    const handleCreatorDisconnected = ({ creatorName, message }) => {
      console.log(`Creator ${creatorName} disconnected: ${message}`);
      setConnectionStatus('reconnecting'); // Set status to reconnecting when creator disconnects
      setMessages(prev => [...prev, {
        userName: 'System',
        text: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        self: false
      }]);
    };

    const handleCreatorChanged = ({ newCreator, message }) => {
      console.log(`Creator changed to ${newCreator}: ${message}`);
      setCreator(newCreator);
      setMessages(prev => [...prev, {
        userName: 'System',
        text: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        self: false
      }]);
      
      // Refresh room data
      socket.emit('get-room-users', { roomId });
    };

    const handleGameEnded = ({ message }) => {
      console.log(`Game ended: ${message}`);
      alert(message);
      navigate('/');
    };

    const handleRoomUsers = ({ users: latestUsers, creator: latestCreator }) => {
      setUsers(latestUsers);
      setCreator(latestCreator);
      setCallUsers(latestUsers.map(u => u.socketId));
    };

    const handleChatMessage = (data) => {
      const isSelf = data.userName === userName;
      const now = new Date();
      const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, { ...data, self: isSelf, time }]);
    };

    const handleWebRTCOffer = async ({ from, offer }) => {
      if (from === socket.id) return;
      if (!localStream) {
        console.log('Received WebRTC offer but no local stream available, starting call...');
        await startCall();
        if (!localStream) return;
      }
      
      console.log(`Received WebRTC offer from ${from}`);
      
      // If we already have a connection to this peer, close it first
      if (peerConnections.current[from]) {
        console.log(`Closing existing connection to ${from} before accepting new offer`);
        peerConnections.current[from].close();
        delete peerConnections.current[from];
      }
      
      const pc = createPeerConnection(from);
      
      // Add local stream tracks to the peer connection
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      
      await pc.setRemoteDescription(new window.RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { to: from, answer });
    };

    const handleWebRTCAnswer = async ({ from, answer }) => {
      const pc = peerConnections.current[from];
      if (pc) {
        await pc.setRemoteDescription(new window.RTCSessionDescription(answer));
      }
    };

    const handleWebRTCIceCandidate = ({ from, candidate }) => {
      const pc = peerConnections.current[from];
      if (pc && candidate) {
        pc.addIceCandidate(new window.RTCIceCandidate(candidate));
      }
    };

    const handleWebRTCMeshRefresh = ({ rejoinedUser, isCreatorReconnecting }) => {
      console.log(`WebRTC mesh refresh triggered by ${rejoinedUser} (creator: ${isCreatorReconnecting})`);
      if (callActive && localStream) {
        // Force rebuild all connections after a delay, longer for creator reconnection
        setTimeout(() => {
          console.log('Force rebuilding WebRTC mesh...');
          users.forEach(user => {
            if (user.socketId !== socket.id) {
              // Close existing connection if it exists
              if (peerConnections.current[user.socketId]) {
                peerConnections.current[user.socketId].close();
                delete peerConnections.current[user.socketId];
              }
              
              // Create new connection
              const pc = createPeerConnection(user.socketId);
              localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
              pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                socket.emit('webrtc-offer', { to: user.socketId, offer });
              });
            }
          });
        }, isCreatorReconnecting ? 1500 : 200);
      }
    };

    socket.on('all-users', handleAllUsers);
    socket.on('error', handleError);
    socket.on('game-state-changed', handleGameStateChanged);
    socket.on('sentence-1', handleSentence1);
    socket.on('sentence-2', handleSentence2);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('creator-reconnected', handleCreatorReconnected);
    socket.on('creator-disconnected', handleCreatorDisconnected);
    socket.on('creator-changed', handleCreatorChanged);
    socket.on('game-ended', handleGameEnded);
    socket.on('room-users', handleRoomUsers);
    socket.on('chat-message', handleChatMessage);
    socket.on('webrtc-offer', handleWebRTCOffer);
    socket.on('webrtc-answer', handleWebRTCAnswer);
    socket.on('webrtc-ice-candidate', handleWebRTCIceCandidate);
    socket.on('webrtc-mesh-refresh', handleWebRTCMeshRefresh);

    // Socket connection status events
    socket.on('connect', () => {
      console.log('Socket connected');
      setConnectionStatus('connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnectionStatus('disconnected');
      
      // Try to reconnect automatically
      setTimeout(() => {
        if (!socket.connected) {
          setConnectionStatus('reconnecting');
          socket.connect();
        }
      }, 2000);
    });

    socket.on('reconnect', () => {
      console.log('Socket reconnected');
      setConnectionStatus('connected');
      
      // Rejoin the room after reconnection
      if (hasJoinedRef.current) {
        socket.emit('join-room', { roomId, userName });
        socket.emit('get-room-users', { roomId });
      }
    });

    if (!callActive) {
      startCall();
    }

    // Send heartbeat every 10 seconds to maintain connection
    const heartbeatInterval = setInterval(() => {
      if (socket.connected && hasJoinedRef.current) {
        socket.emit('heartbeat', { roomId, userName });
      }
    }, 10000);

    return () => {
      // Clear heartbeat interval
      clearInterval(heartbeatInterval);
      
      // Reset join flag when component unmounts
      hasJoinedRef.current = false;
      
      socket.off('all-users', handleAllUsers);
      socket.off('error', handleError);
      socket.off('game-state-changed', handleGameStateChanged);
      socket.off('sentence-1', handleSentence1);
      socket.off('sentence-2', handleSentence2);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('creator-reconnected', handleCreatorReconnected);
      socket.off('creator-disconnected', handleCreatorDisconnected);
      socket.off('creator-changed', handleCreatorChanged);
      socket.off('game-ended', handleGameEnded);
      socket.off('room-users', handleRoomUsers);
      socket.off('chat-message', handleChatMessage);
      socket.off('webrtc-offer', handleWebRTCOffer);
      socket.off('webrtc-answer', handleWebRTCAnswer);
      socket.off('webrtc-ice-candidate', handleWebRTCIceCandidate);
      socket.off('webrtc-mesh-refresh', handleWebRTCMeshRefresh);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reconnect');
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
    // If connection already exists and is in a good state, reuse it
    if (peerConnections.current[peerId]) {
      const existingPc = peerConnections.current[peerId];
      if (existingPc.connectionState === 'connected' || existingPc.connectionState === 'connecting') {
        console.log(`Reusing existing peer connection for ${peerId} (state: ${existingPc.connectionState})`);
        return existingPc;
      } else {
        console.log(`Closing existing peer connection for ${peerId} (state: ${existingPc.connectionState})`);
        existingPc.close();
        delete peerConnections.current[peerId];
      }
    }
    
    console.log(`Creating new peer connection for ${peerId}`);
    const pc = new window.RTCPeerConnection({ 
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ] 
    });
    peerConnections.current[peerId] = pc;
    
    pc.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', { to: peerId, candidate: event.candidate });
      }
    };
    
    pc.ontrack = event => {
      console.log(`Received remote stream from ${peerId}`);
      setRemoteStreams(prev => {
        // Remove any existing streams from this peer first
        const filtered = prev.filter(s => s.peerId !== peerId);
        // Add the new stream
        const newStream = { ...event.streams[0], peerId };
        return [...filtered, newStream];
      });
    };
    
    pc.onconnectionstatechange = () => {
      console.log(`Connection state changed for ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.log(`Cleaning up failed connection for ${peerId}`);
        pc.close();
        delete peerConnections.current[peerId];
        // Remove remote stream for this peer
        setRemoteStreams(prev => prev.filter(s => s.peerId !== peerId));
        
        // Try to reestablish connection if the user is still in the room
        setTimeout(() => {
          if (users.some(u => u.socketId === peerId) && localStream) {
            console.log(`Attempting to reestablish connection to ${peerId}`);
            const newPc = createPeerConnection(peerId);
            localStream.getTracks().forEach(track => newPc.addTrack(track, localStream));
            newPc.createOffer().then(offer => {
              newPc.setLocalDescription(offer);
              socket.emit('webrtc-offer', { to: peerId, offer });
            });
          }
        }, 1000);
      } else if (pc.connectionState === 'connected') {
        console.log(`Successfully connected to ${peerId}`);
      }
    };
    
    return pc;
  }

  const handleExit = () => {
    // Reset join flag to allow rejoining
    hasJoinedRef.current = false;
    
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
          Game : <span style={{ color: '#222', fontWeight: 'bold' }}>{roomId}</span>
          <div style={{ fontSize: '16px', marginTop: '8px', color: '#666' }}>
            Status: <span style={{ 
              color: gameState === 'waiting' ? '#f39c12' : gameState === 'active' ? '#27ae60' : '#e74c3c',
              fontWeight: 'bold'
            }}>
              {gameState === 'waiting' ? 'Waiting for players' : 
               gameState === 'active' ? 'Game in progress' : 
               gameState.charAt(0).toUpperCase() + gameState.slice(1)}
            </span>
            {gameState === 'waiting' && (
              <span style={{ marginLeft: '10px', fontSize: '14px' }}>
                ({users.length}/6 players)
              </span>
            )}
          </div>
          <div style={{ fontSize: '14px', marginTop: '4px' }}>
            Connection: <span style={{ 
              color: connectionStatus === 'connected' ? '#27ae60' : 
                     connectionStatus === 'connecting' ? '#f39c12' :
                     connectionStatus === 'reconnecting' ? '#e67e22' : '#e74c3c',
              fontWeight: 'bold'
            }}>
              {connectionStatus === 'connected' ? '🟢 Connected' :
               connectionStatus === 'connecting' ? '🟡 Connecting...' :
               connectionStatus === 'reconnecting' ? '🟠 Reconnecting...' : '🔴 Disconnected'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '32px', justifyContent: 'center' }}>
          {/* Users Section */}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'serif', fontSize: '18px', marginBottom: '12px' }}>Players in the game :</div>
            <div style={{ background: '#d6d6d6', borderRadius: '12px', padding: '32px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', minHeight: '340px', alignItems: 'center', justifyItems: 'center' }}>
              {users.length === 0 ? (
                <div style={{ gridColumn: 'span 2', color: '#888', fontSize: '20px' }}>No players</div>
              ) : (
                users.map((user, idx) => (
                  <div key={user.userName + idx} style={{ background: '#111', color: '#fff', fontFamily: 'serif', fontSize: '24px', borderRadius: '10px', padding: '18px 0', width: '220px', textAlign: 'center', letterSpacing: '2px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', position: 'relative' }}>
                    {user.userName}
                    {creator === user.userName && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '-8px', 
                        right: '-8px', 
                        background: '#f39c12', 
                        color: '#fff', 
                        borderRadius: '50%', 
                        width: '20px', 
                        height: '20px', 
                        fontSize: '12px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}>
                        ★
                      </div>
                    )}
                  </div>
                ))
                )}
            </div>
            <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', marginTop: '32px' }}>
              <button onClick={handleExit} style={{ background: '#d6d6d6', border: 'none', borderRadius: '8px', padding: '12px 36px', fontFamily: 'serif', fontSize: '20px', cursor: 'pointer' }}>exit</button>
              {creator === userName && gameState === 'waiting' && (
                <button 
                  onClick={handleStartSentences} 
                  disabled={users.length < 2}
                  style={{ 
                    background: users.length >= 2 ? '#d6d6d6' : '#999', 
                    border: 'none', 
                    borderRadius: '8px', 
                    padding: '12px 36px', 
                    fontFamily: 'serif', 
                    fontSize: '20px', 
                    cursor: users.length >= 2 ? 'pointer' : 'not-allowed',
                    opacity: users.length >= 2 ? 1 : 0.6
                  }}
                >
                  Start Game {users.length >= 2 ? '' : `(Need ${2 - users.length} more players)`}
                </button>
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
