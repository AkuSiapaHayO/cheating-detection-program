// Backend code in index.js

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const { Room, Student, CheatingLog } = require('./models'); // Assuming Room, Student, and CheatingLog models are defined

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// MongoDB connection
mongoose.connect('mongodb+srv://lmariowijaya:Sh%40dowMon4rch@cluster0.fl3a5.mongodb.net/cheating-detection?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Failed to connect to MongoDB', err));

io.on('connection', (socket) => {
  console.log('User connected: ' + socket.id);

  // Event for creating a room
  socket.on('create_room', async (data) => {
    const { roomCode } = data;
    console.log('Room created with code: ' + roomCode);
    socket.join(roomCode);

    try {
      const room = new Room({ roomCode, hostSocketId: socket.id });
      await room.save();
      console.log(`Room saved: ${roomCode}`);
    } catch (error) {
      console.error('Error saving room:', error);
    }
  });

  // Event for a student joining a room
  socket.on('join_room', async (data) => {
    const { roomCode, userName } = data;
    console.log('User joined room: ' + roomCode);
    socket.join(roomCode);

    try {
      const student = new Student({ name: userName, socketId: socket.id, roomCode });
      await student.save();

      const room = await Room.findOne({ roomCode });
      if (room) {
        room.students.push(student._id);
        await room.save();
        io.to(room.hostSocketId).emit('student_joined', { userName });
        console.log(`User ${userName} joined room ${roomCode}`);
      }
    } catch (error) {
      console.error('Error saving student or updating room:', error);
    }
  });

  // Event for cheating detection
  socket.on('cheating_detected', async (data) => {
    console.log(`Cheating detected! Student: ${data.userName}, Room: ${data.roomCode}`);
    
    try {
      const student = await Student.findOne({ name: data.userName, roomCode: data.roomCode });
      if (student) {
        const cheatingLog = new CheatingLog({
          student: student._id,
          roomCode: data.roomCode,
          behavior: 'Cheating detected'
        });
        await cheatingLog.save();
  
        // Find the room and emit the cheating log to the host
        const room = await Room.findOne({ roomCode: data.roomCode });
        if (room) {
          io.to(room.hostSocketId).emit('cheating_log', { logMessage: `Cheating detected for student: ${data.userName}` });
          console.log(`Cheating log emitted to host for room ${data.roomCode}`);
        }
      } else {
        console.error('Student not found in the database.');
      }
    } catch (error) {
      console.error('Error saving cheating incident:', error);
    }
  });
  
  

  // Handle room closure
  socket.on('close_room', async (data) => {
    const { roomCode } = data;

    try {
      // Delete room from the database
      await Room.deleteOne({ roomCode });

      // Notify all clients to leave the room
      io.in(roomCode).emit('room_closed');
      io.in(roomCode).socketsLeave(roomCode);
      console.log(`Room ${roomCode} closed and all clients disconnected.`);
    } catch (error) {
      console.error('Error closing room:', error);
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected: ' + socket.id);
  });
});

server.listen(3001, () => {
  console.log('Server is running on port 3001');
});
