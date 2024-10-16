const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://tube-sync-g2c3asqxq-yousufali839203s-projects.vercel.app",
    methods: ["GET", "POST"],
  },
});

// Serve the index.html file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Store users and video states for each room
const roomUsers = {};
const roomVideoStates = {};
const roomCreators = {}; // Track room creators

io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id);

  socket.on("joinRoom", (roomId, isCreator) => {
    console.log(`User ${socket.id} joined room: ${roomId}`);
    socket.join(roomId);

    if (!roomUsers[roomId]) {
      roomUsers[roomId] = [];
      roomVideoStates[roomId] = {
        videoId: null,
        isPlaying: false,
        currentTime: 0,
      };
      console.log(`Room created: ${roomId}`);
    }

    roomUsers[roomId].push(socket.id);

    // Set the creator of the room
    if (isCreator) {
      roomCreators[roomId] = socket.id;
    }

    socket.to(roomId).emit("userJoined", {
      message: `User ${socket.id} has joined the room.`,
      users: roomUsers[roomId],
    });

    io.to(roomId).emit("userCount", roomUsers[roomId].length);
    socket.emit("playerStateUpdate", roomVideoStates[roomId]);
  });

  socket.on("chatMessage", ({ roomId, message }) => {
    console.log(`Chat message in room ${roomId}:`, message);
    io.to(roomId).emit("chatMessage", message);
  });

  socket.on("updatePlaylist", ({ roomId, playlist }) => {
    if (roomCreators[roomId] !== socket.id) {
      console.log(
        `User ${socket.id} attempted to update playlist without permission.`
      );
      return; // Prevent non-creators from updating the playlist
    }

    console.log(`Received updatePlaylist for room: ${roomId}`);
    console.log("New Playlist:", playlist);
    io.to(roomId).emit("playlistUpdate", playlist);

    if (playlist.length > 0 && !roomVideoStates[roomId].videoId) {
      roomVideoStates[roomId].videoId = playlist[0].id;
      io.to(roomId).emit("playerStateUpdate", roomVideoStates[roomId]);
    }
  });

  socket.on("playerStateChange", ({ roomId, state }) => {
    if (roomCreators[roomId] !== socket.id) {
      console.log(
        `User ${socket.id} attempted to change player state without permission.`
      );
      return; // Prevent non-creators from changing player state
    }

    console.log(`Player state change received for room ${roomId}:`, state);
    roomVideoStates[roomId] = state;
    io.to(roomId).emit("playerStateUpdate", state); // Emit to all clients
  });

  socket.on("leaveRoom", (roomId) => {
    handleUserLeaving(socket, roomId);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (const roomId in roomUsers) {
      if (roomUsers[roomId].includes(socket.id)) {
        handleUserLeaving(socket, roomId);
      }
    }
  });
});

function handleUserLeaving(socket, roomId) {
  console.log(`User ${socket.id} left room: ${roomId}`);

  if (roomUsers[roomId]) {
    roomUsers[roomId] = roomUsers[roomId].filter((id) => id !== socket.id);

    socket.to(roomId).emit("userLeft", {
      message: `User ${socket.id} has left the room.`,
      users: roomUsers[roomId],
    });
    io.to(roomId).emit("userCount", roomUsers[roomId].length);

    if (roomUsers[roomId].length === 0) {
      delete roomUsers[roomId];
      delete roomVideoStates[roomId]; // Clean up video states as well
      delete roomCreators[roomId]; // Clean up creator as well
      console.log(`Room ${roomId} is now empty and has been cleaned up.`);
    }
  }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});
