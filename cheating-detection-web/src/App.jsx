import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import Webcam from 'react-webcam';

// Connect to the backend server
const socket = io.connect('http://localhost:3001');

const App = () => {
  const webcamRef = useRef(null);
  const [model, setModel] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [userName, setUserName] = useState('');
  const [students, setStudents] = useState([]);
  const [cheatingLogs, setCheatingLogs] = useState([]); // Log for host view

  // Load the Teachable Machine Pose Model
  useEffect(() => {
    const loadModel = async () => {
      if (!window.tmPose) {
        console.error("tmPose library is not loaded.");
        return;
      }

      const modelURL = 'https://teachablemachine.withgoogle.com/models/_mhssP9in/model.json';  // Your model URL
      const metadataURL = 'https://teachablemachine.withgoogle.com/models/_mhssP9in/metadata.json';  // Your metadata URL

      try {
        const loadedModel = await window.tmPose.load(modelURL, metadataURL);
        setModel(loadedModel);
        console.log("Model loaded successfully");
      } catch (error) {
        console.error("Failed to load the model", error);
      }
    };

    loadModel();
  }, []);

  // Predict cheating behavior using the model and webcam
  useEffect(() => {
    if (model && isJoined && !isHost) {
      const predict = async () => {
        if (webcamRef.current) {
          const { posenetOutput } = await model.estimatePose(webcamRef.current.getCanvas());
          const predictions = await model.predict(posenetOutput);

          // Check predictions for cheating behavior
          predictions.forEach((prediction) => {
            if (prediction.probability > 0.9 && prediction.className === "Cheating") {
              console.warn("Cheating detected!");
              socket.emit('cheating_detected', {
                userName,
                roomCode,
              });
            }
          });
        }
      };

      // Run prediction every 0.5 seconds
      const interval = setInterval(() => {
        predict();
      }, 2000); // 500 ms interval

      return () => clearInterval(interval);
    }
  }, [model, isJoined, isHost]);

  // Event handlers for creating and joining a room
  const createRoom = () => {
    const newRoomCode = Math.random().toString(36).substr(2, 5).toUpperCase();
    setRoomCode(newRoomCode);
    setIsHost(true);
    socket.emit('create_room', { roomCode: newRoomCode });
  };

  const joinRoom = () => {
    if (roomCode && userName) {
      setIsJoined(true);
      socket.emit('join_room', { roomCode, userName });
    } else {
      alert('Please enter your name and a valid room code to join.');
    }
  };

  // Handle new students joining (for host)
  useEffect(() => {
    if (isHost) {
      socket.on('student_joined', (data) => {
        setStudents((prevStudents) => [...prevStudents, data.userName]);
      });
    }

    return () => {
      socket.off('student_joined');
    };
  }, [isHost]);

  // Handle cheating logs
  useEffect(() => {
    if (isHost) {
      // Listen for cheating logs from the server in real-time
      socket.on('cheating_log', (data) => {
        console.log('Cheating log received: ', data.logMessage);  // Logs to console for debugging
        setCheatingLogs((prevLogs) => [...prevLogs, data.logMessage]); // Append new cheating log to state
      });

      // Listen for room closure event
      socket.on('room_closed', () => {
        alert("The room has been closed.");
        resetState();
      });
    }

    // Clean up listeners when component unmounts
    return () => {
      if (isHost) {
        socket.off('cheating_log'); // Stop listening for cheating_log events
        socket.off('room_closed');  // Stop listening for room_closed events
      }
    };
  }, [isHost]);

  // Reset state to go back to home screen
  const resetState = () => {
    setIsJoined(false);
    setIsHost(false);
    setRoomCode('');
    setUserName('');
    setStudents([]);
    setCheatingLogs([]);
  };

  // Handle closing the room
  const closeRoom = () => {
    socket.emit('close_room', { roomCode });
    console.log('Room closed:', roomCode);
    resetState();
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>AI Cheating Detection Exam</h1>
      {!isJoined && !isHost && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <button onClick={createRoom} style={{ marginBottom: '10px' }}>Create Room</button>
            <p style={{ fontSize: 'small' }}>Click to create a new room as the host.</p>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Enter your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              style={{ marginBottom: '10px' }}
            />
            <br />
            <input
              type="text"
              placeholder="Enter Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              style={{ marginBottom: '10px' }}
            />
            <br />
            <button onClick={joinRoom}>Join Room</button>
          </div>
        </>
      )}
      {isJoined && !isHost && (
        <>
          <h2>Welcome, {userName}!</h2>
          <h3>You have joined the room: {roomCode}</h3>
          <div>
            <Webcam ref={webcamRef} style={{ marginTop: '20px', width: '320px', height: '240px' }} />
          </div>
        </>
      )}
      {isHost && (
        <>
          <h2>Room Code: {roomCode}</h2>
          <h3>Share this code with students to join the room.</h3>
          <h4>Students in Room:</h4>
          <ul>
            {students.length > 0 ? (
              students.map((student, index) => (
                <li key={index}>{student}</li>
              ))
            ) : (
              <li>No students have joined yet.</li>
            )}
          </ul>
          <h4>Cheating Logs:</h4>
          <ul>
            {cheatingLogs.length > 0 ? (
              cheatingLogs.map((log, index) => (
                <li key={index}>{log}</li>
              ))
            ) : (
              <li>No cheating detected yet.</li>
            )}
          </ul>
          <button onClick={closeRoom} style={{ marginTop: '20px' }}>Close Room</button>
        </>
      )}
    </div>
  );
};

export default App;
