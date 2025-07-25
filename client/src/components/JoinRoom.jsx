import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const JoinRoom = () => {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validateInput = () => {
    if (!userName || !userName.trim()) {
      alert('Please enter your name');
      return false;
    }
    if (userName.trim().length < 2) {
      alert('Name must be at least 2 characters long');
      return false;
    }
    if (userName.trim().length > 20) {
      alert('Name must be less than 20 characters');
      return false;
    }
    // Check for alphanumeric characters only
    if (!/^[a-zA-Z0-9\s]+$/.test(userName.trim())) {
      alert('Name can only contain letters, numbers, and spaces');
      return false;
    }
    return true;
  };

  const handleJoin = () => {
    if (!validateInput()) return;
    
    if (!roomId || !roomId.trim()) {
      alert('Please enter a Room ID');
      return;
    }
    
    if (!/^\d{6}$/.test(roomId.trim())) {
      alert('Room ID must be a 6-digit number');
      return;
    }

    setLoading(true);
    
    // Navigate to room
    setTimeout(() => {
      navigate(`/room/${roomId.trim()}?name=${encodeURIComponent(userName.trim())}`);
      setLoading(false);
    }, 500);
  };

  const handleCreate = () => {
    if (!validateInput()) return;

    setLoading(true);
    
    // Generate a unique 6-digit room ID
    const newRoomId = Math.floor(100000 + Math.random() * 900000);
    
    setTimeout(() => {
      navigate(`/room/${newRoomId}?name=${encodeURIComponent(userName.trim())}`);
      setLoading(false);
    }, 500);
  };

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  return (
    <div style={{ 
      textAlign: 'center', 
      marginTop: '50px', 
      padding: '20px',
      maxWidth: '400px',
      margin: '50px auto',
      backgroundColor: '#f5f5f5',
      borderRadius: '10px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <h1 style={{ marginBottom: '30px', color: '#333' }}>Voice Chat Game</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          onKeyPress={(e) => handleKeyPress(e, roomId ? handleJoin : handleCreate)}
          placeholder="Your Name"
          maxLength={20}
          style={{ 
            padding: '12px', 
            width: '250px', 
            border: '2px solid #ddd',
            borderRadius: '5px',
            fontSize: '16px'
          }}
          disabled={loading}
        />
      </div>
      
      <div style={{ marginBottom: '25px' }}>
        <input
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyPress={(e) => handleKeyPress(e, handleJoin)}
          placeholder="Enter 6-digit Room ID (optional)"
          maxLength={6}
          style={{ 
            padding: '12px', 
            width: '250px',
            border: '2px solid #ddd',
            borderRadius: '5px',
            fontSize: '16px'
          }}
          disabled={loading}
        />
        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          Leave empty to create a new game
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button 
          onClick={handleJoin} 
          disabled={!roomId || loading}
          style={{ 
            padding: '12px 20px',
            backgroundColor: roomId ? '#007bff' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            cursor: roomId && !loading ? 'pointer' : 'not-allowed',
            opacity: roomId && !loading ? 1 : 0.6
          }}
        >
          {loading ? 'Joining...' : 'Join Game'}
        </button>
        
        <button 
          onClick={handleCreate}
          disabled={loading}
          style={{ 
            padding: '12px 20px',
            backgroundColor: loading ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Creating...' : 'Create Game'}
        </button>
      </div>
      
      <div style={{ 
        marginTop: '20px', 
        fontSize: '14px', 
        color: '#666',
        lineHeight: '1.5'
      }}>
        <div><strong>Game Rules:</strong></div>
        <div>• Maximum 6 players per game</div>
        <div>• Creator starts the sentences</div>
        <div>• Voice chat available during game</div>
      </div>
    </div>
  );
};

export default JoinRoom;
