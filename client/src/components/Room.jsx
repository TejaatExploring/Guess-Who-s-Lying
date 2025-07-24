import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import socket from '../socket';

const Room = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const userName = searchParams.get('name');

  useEffect(() => {
    if (!userName) {
      navigate('/');
      return;
    }

    socket.emit('join-room', { roomId, userName });

    socket.on('all-users', (userList) => {
      setUsers(userList);
    });

    socket.on('user-joined', (data) => {
      setUsers((prev) => [...prev, data]);
    });

    socket.on('user-left', ({ socketId }) => {
      setUsers((prev) => prev.filter(user => user.socketId !== socketId));
    });

    socket.on('chat-message', (data) => {
      // Mark message as 'self' if sent by this user, add timestamp
      const isSelf = data.userName === userName;
      const now = new Date();
      const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, { ...data, self: isSelf, time }]);
    });

    return () => {
      socket.off('all-users');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('chat-message');
    };
  }, [roomId, userName]);

  const handleExit = () => {
    socket.disconnect();
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
      <h2>Room: {roomId}</h2>
      <h3>Welcome, {userName}</h3>
      <button onClick={handleExit}>Exit</button>
      <h4>Users in room:</h4>
      <ul>
        {users.map(user => (
          <li key={user.socketId}>{user.userName}</li>
        ))}
      </ul>
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
