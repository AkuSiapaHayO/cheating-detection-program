const mongoose = require('mongoose');

// Schema for Room
const RoomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true },
  hostSocketId: { type: String, required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }]
});

// Schema for Student
const StudentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  socketId: { type: String, required: true },
  roomCode: { type: String, required: true }
});

// Schema for Cheating Logs
const CheatingLogSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  roomCode: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  behavior: { type: String, required: true }  // Description of detected cheating behavior
});

// Export models
const Room = mongoose.model('Room', RoomSchema);
const Student = mongoose.model('Student', StudentSchema);
const CheatingLog = mongoose.model('CheatingLog', CheatingLogSchema);

module.exports = { Room, Student, CheatingLog };
