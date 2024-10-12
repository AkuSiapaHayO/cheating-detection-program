import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Webcam from "react-webcam";

// Connect to the backend server
const socket = io.connect("http://localhost:3001");

const App = () => {
  const webcamRef = useRef(null);
  const [model, setModel] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [userName, setUserName] = useState("");
  const [students, setStudents] = useState([]);
  const [cheatingLogs, setCheatingLogs] = useState([]); // Log for host view
  const [consecutiveCheating, setConsecutiveCheating] = useState(0); // New state to track consecutive cheating predictions
  const [consecutiveCameraBlocked, setConsecutiveCameraBlocked] = useState(0); // New state to track consecutive blocked camera predictions

  // Load the Teachable Machine Pose Model
  useEffect(() => {
    const loadModel = async () => {
      if (!window.tmPose) {
        console.error("tmPose library is not loaded.");
        return;
      }

      const modelURL =
        "https://teachablemachine.withgoogle.com/models/edwVJ2M6V/model.json"; // Your model URL
      const metadataURL =
        "https://teachablemachine.withgoogle.com/models/edwVJ2M6V/metadata.json"; // Your metadata URL

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
          const { posenetOutput } = await model.estimatePose(
            webcamRef.current.getCanvas()
          );
          const predictions = await model.predict(posenetOutput);

          let isCheatingDetected = false;
          let isCameraBlockedDetected = false;

          predictions.forEach((prediction) => {
            if (
              prediction.probability > 0.9 &&
              prediction.className === "Cheating"
            ) {
              isCheatingDetected = true;
            }

            if (
              prediction.probability > 0.9 &&
              prediction.className === "Camera Blocked"
            ) {
              isCameraBlockedDetected = true;
            }
          });

          // Handle cheating detection
          if (isCheatingDetected) {
            setConsecutiveCheating((prev) => prev + 1); // Increment cheating counter
            console.log(
              `Cheating detected. Consecutive count: ${consecutiveCheating + 1}`
            );
          } else {
            setConsecutiveCheating(0); // Reset if no cheating detected
            console.log("Cheating not detected, resetting counter.");
          }

          // Emit cheating event after 6 seconds of continuous cheating detection
          if (consecutiveCheating >= 3) {
            console.warn(
              "Cheating detected for 6 seconds. Logging cheating event."
            );
            socket.emit("cheating_detected", {
              userName,
              roomCode,
            });
            setConsecutiveCheating(0); // Reset the cheating counter
          }

          // Handle camera blocked detection
          if (isCameraBlockedDetected) {
            setConsecutiveCameraBlocked((prev) => prev + 1); // Increment camera block counter
            console.log(
              `Camera blocked detected. Consecutive count: ${
                consecutiveCameraBlocked + 1
              }`
            );
          } else {
            setConsecutiveCameraBlocked(0); // Reset if camera is no longer blocked
            console.log("Camera is not blocked, resetting counter.");
          }

          // Emit camera blocked event after 6 seconds of continuous camera block detection
          if (consecutiveCameraBlocked >= 3) {
            console.warn(
              "Camera blocked for 6 seconds. Logging camera block event."
            );
            socket.emit("camera_blocked", {
              userName,
              roomCode,
            });
            setConsecutiveCameraBlocked(0); // Reset the camera block counter
          }
        }
      };

      const interval = setInterval(() => {
        predict();
      }, 2000); // Run prediction every 2 seconds

      return () => clearInterval(interval); // Clear the interval on unmount
    }
  }, [model, isJoined, isHost, consecutiveCheating, consecutiveCameraBlocked]);

  // Event handlers for creating and joining a room
  const createRoom = () => {
    const newRoomCode = Math.random().toString(36).substr(2, 5).toUpperCase();
    setRoomCode(newRoomCode);
    setIsHost(true);
    socket.emit("create_room", { roomCode: newRoomCode });
  };

  const joinRoom = () => {
    if (roomCode && userName) {
      setIsJoined(true);
      socket.emit("join_room", { roomCode, userName });
    } else {
      alert("Please enter your name and a valid room code to join.");
    }
  };

  const downloadLogs = () => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString(); // Format the current date

    // Prepare the header and formatted log entries
    const header = `Cheating Logs\nDate: ${formattedDate}\n\n`; // Custom header with date
    const logEntries = cheatingLogs
      .map((log, index) => `Log ${index + 1}: ${log}`) // Prefix logs with "Log 1", "Log 2", etc.
      .join("\n"); // Join all logs with new lines

    // Combine header and log entries
    const logs = header + logEntries;

    // Create the Blob and download the file
    const blob = new Blob([logs], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cheating_logs_${formattedDate}.txt`; // Include date in the file name
    link.click();
  };

  const handleFinished = () => {
    // Trigger download with custom formatting
    downloadLogs();

    closeRoom();
  };

  // Handle new students joining (for host)
  useEffect(() => {
    if (isHost) {
      socket.on("student_joined", (data) => {
        setStudents((prevStudents) => [...prevStudents, data.userName]);
      });
    }

    return () => {
      socket.off("student_joined");
    };
  }, [isHost]);

  // Handle cheating logs and room closure for both host and student
  useEffect(() => {
    // Listen for cheating logs (for host)
    if (isHost) {
      socket.on("cheating_log", (data) => {
        console.log("Cheating log received: ", data.logMessage); // Logs to console for debugging
        setCheatingLogs((prevLogs) => [...prevLogs, data.logMessage]); // Append new cheating log to state
      });

      // Listen for camera block logs (for host)
      socket.on("camera_blocked_log", (data) => {
        console.log("Camera block log received: ", data.logMessage); // Logs to console for debugging
        setCheatingLogs((prevLogs) => [...prevLogs, data.logMessage]); // Append new camera block log to state
      });
    }

    // Listen for room closure event for both host and student
    socket.on("room_closed", () => {
      alert("The room has been closed by the host.");
      resetState(); // Reset state for both host and student
    });

    // Clean up listeners when component unmounts
    return () => {
      socket.off("cheating_log"); // Stop listening for cheating_log events
      socket.off("camera_blocked_log"); // Stop listening for camera_blocked_log events
      socket.off("room_closed"); // Stop listening for room_closed events
    };
  }, [isHost]);

  // Add the room_error listener
  useEffect(() => {
    socket.on("room_error", (data) => {
      alert(data.message); // Show error message to the user
      setIsJoined(false); // Reset joined state
    });

    return () => {
      socket.off("room_error"); // Clean up listener
    };
  }, []);

  // Reset state to go back to home screen
  const resetState = () => {
    setIsJoined(false);
    setIsHost(false);
    setRoomCode("");
    setUserName("");
    setStudents([]);
    setCheatingLogs([]);
  };

  // Handle closing the room
  const closeRoom = () => {
    socket.emit("close_room", { roomCode });
    console.log("Room closed:", roomCode);
    resetState();
  };

  return (
    <div className="w-screen h-screen flex flex-row justify-between bg-primary-light p-6">
      <div className="flex flex-col items-center justify-center flex-grow">
        <h1 className="text-3xl font-extrabold mb-8 text-secondary text-center">
          AI Cheating Detection Exam
        </h1>
        {isHost && (
          <>
            <h2 className="text-2xl font-semibold mb-6 text-secondary text-center">
              Room Code: {roomCode}
            </h2>
            <h3 className="text-lg mb-4 text-accent text-center">
              Share this code with students to join the room.
            </h3>
          </>
        )}
        {!isJoined && !isHost && (
          <>
            <div className="mb-4 flex flex-col items-center">
              <input
                type="text"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="border border-accent rounded-lg p-3 mb-4 w-72 bg-primary text-secondary placeholder-accent focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary-light"
              />
              <input
                type="text"
                placeholder="Enter Room Code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="border border-accent rounded-lg p-3 mb-4 w-72 bg-primary text-secondary placeholder-accent focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary-light"
              />
              <button
                onClick={joinRoom}
                className="bg-secondary-light hover:bg-secondary text-primary font-semibold p-3 w-72 rounded-lg shadow-md transition-all duration-300"
              >
                Join Room
              </button>
            </div>

            <div className="mb-8 flex flex-col items-center">
              <button
                onClick={createRoom}
                className="bg-secondary hover:bg-secondary-light text-primary font-semibold p-3 w-72 rounded-lg shadow-md transition-all duration-300 mb-4"
              >
                Create Room
              </button>
              <p className="text-sm text-accent">
                Click to create a new room as the host.
              </p>
            </div>
          </>
        )}

        {isJoined && !isHost && (
          <>
            <h2 className="text-2xl font-semibold mb-4 text-secondary">
              Welcome, {userName}!
            </h2>
            <h3 className="text-lg mb-6 text-accent">
              You have joined the room: {roomCode}
            </h3>
            <div className="flex justify-center">
              <Webcam
                ref={webcamRef}
                className="mt-4 w-[320px] h-[240px] border-2 border-accent rounded-lg shadow-md"
              />
            </div>
          </>
        )}
      </div>

      {isHost && (
        <div className="w-1/2 md:w-1/3 flex flex-col items-start p-4">
          <h4 className="text-lg font-semibold mb-4 text-accent">
            Students in Room:
          </h4>
          <ul className="list-inside mb-6 text-secondary overflow-y-auto h-48 w-full border border-accent-light p-2 rounded-lg">
            {students.length > 0 ? (
              students.map((student, index) => <li key={index}>{student}</li>)
            ) : (
              <li>No students have joined yet.</li>
            )}
          </ul>

          <h4 className="text-lg font-semibold mb-4 text-accent">
            Cheating and Camera Block Logs:
          </h4>
          <ul className="list-inside mb-6 text-secondary overflow-y-auto h-48 w-full border border-accent-light p-2 rounded-lg">
            {cheatingLogs.length > 0 ? (
              cheatingLogs.map((log, index) => <li key={index}>{log}</li>)
            ) : (
              <li>No events detected yet.</li>
            )}
          </ul>

          <button
            onClick={handleFinished}
            className="bg-red-500 text-white font-semibold px-6 py-3 rounded-lg shadow-md hover:bg-red-600 transition-all duration-300 w-full"
          >
            Close Room
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
