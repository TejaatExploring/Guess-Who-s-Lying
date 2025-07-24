import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const JoinRoom = () => {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();

  const handleJoin = () => {
    if (!roomId || !userName) return alert('Enter Room ID and Name');
    navigate(`/room/${roomId}?name=${encodeURIComponent(userName)}`);
  };

  const handleCreate = () => {
    const newRoomId = crypto.randomUUID().slice(0, 6);
    if (!userName) return alert('Enter Name');
    navigate(`/room/${newRoomId}?name=${encodeURIComponent(userName)}`);
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '40px' }}>
      <input
        type="text"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        placeholder="Your Name"
        style={{ padding: '8px', width: '200px' }}
      />
      <br /><br />
      <input
        type="text"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder="Enter Room ID"
        style={{ padding: '8px', width: '200px' }}
      />
      <br /><br />
      <button onClick={handleJoin} style={{ marginRight: '10px' }}>Join Room</button>
      <button onClick={handleCreate}>Create Room</button>
    </div>
  );
};

export default JoinRoom;
