import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import JoinRoom from './components/JoinRoom';
import Room from './components/Room';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<JoinRoom />} />
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </Router>
  );
};

export default App;
