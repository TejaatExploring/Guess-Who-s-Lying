import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import socket from '../socket';

const Room = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
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

    return () => {
      socket.off('all-users');
      socket.off('user-joined');
      socket.off('user-left');
    };
  }, [roomId, userName]);

  const handleExit = () => {
    socket.disconnect();
    navigate('/');
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
    </div>
  );
};

export default Room;
