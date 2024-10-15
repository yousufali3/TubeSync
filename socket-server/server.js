// socket-server/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Specify the client URL
    methods: ["GET", "POST"],
  },
});

// Serve a simple HTML page for testing
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Store users in rooms
const roomUsers = {};

// Socket.io connection
io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id);

  // Join room event
  socket.on("joinRoom", (roomId) => {
    console.log(`User ${socket.id} joined room: ${roomId}`);
    socket.join(roomId);

    // Add user to the room
    if (!roomUsers[roomId]) {
      roomUsers[roomId] = [];
    }
    roomUsers[roomId].push(socket.id);

    // Notify other users in the room
    const usersInRoom = roomUsers[roomId];
    socket.to(roomId).emit("userJoined", {
      message: `User ${socket.id} has joined the room.`,
      users: usersInRoom,
    });

    // Emit the current user count to the room
    io.to(roomId).emit("userCount", usersInRoom.length);
  });

  // Chat message event
  socket.on("chatMessage", ({ roomId, message }) => {
    console.log(`Chat message in room ${roomId}:`, message);
    io.to(roomId).emit("chatMessage", message);
  });

  // Video playlist update event
  socket.on("updatePlaylist", ({ roomId, playlist }) => {
    console.log(`Received updatePlaylist for room: ${roomId}`);
    console.log("New Playlist:", playlist);
    io.to(roomId).emit("playlistUpdate", playlist);
  });

  // Player state change event
  socket.on("playerStateChange", ({ roomId, state }) => {
    console.log("hello World");
    console.log(`Player state change received for room ${roomId}:`, state);
    // Emit the player state update to all users in the room except the sender
    socket.to(roomId).emit("playerStateUpdate", state);
  });

  // Leave room event
  socket.on("leaveRoom", (roomId) => {
    socket.leave(roomId);
    console.log(`User left room: ${roomId}`);

    // Remove user from the room
    if (roomUsers[roomId]) {
      roomUsers[roomId] = roomUsers[roomId].filter((id) => id !== socket.id);
      socket.to(roomId).emit("userLeft", {
        message: `User ${socket.id} has left the room.`,
        users: roomUsers[roomId],
      });
      io.to(roomId).emit("userCount", roomUsers[roomId].length);
    }
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected");

    // Remove user from all rooms
    for (const roomId in roomUsers) {
      roomUsers[roomId] = roomUsers[roomId].filter((id) => id !== socket.id);
      if (roomUsers[roomId].length) {
        socket.to(roomId).emit("userLeft", {
          message: `User ${socket.id} has disconnected.`,
          users: roomUsers[roomId],
        });
        io.to(roomId).emit("userCount", roomUsers[roomId].length);
      }
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});
