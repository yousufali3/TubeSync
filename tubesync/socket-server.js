const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Store room data
const rooms = new Map();

io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id);

  socket.on("joinRoom", ({ roomId, username, userId }) => {
    console.log(`User ${username} (${userId}) joined room: ${roomId}`);
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      // New room, set up room data
      rooms.set(roomId, {
        creator: userId,
        users: new Map([[userId, { socketId: socket.id, username }]]),
        playlist: [],
        playerState: {
          videoId: null,
          isPlaying: false,
          currentTime: 0,
        },
      });
      socket.emit("roomJoined", { isCreator: true });
    } else {
      // Existing room, add user
      const room = rooms.get(roomId);
      room.users.set(userId, { socketId: socket.id, username });
      const isCreator = room.creator === userId;
      socket.emit("roomJoined", { isCreator });
    }

    const room = rooms.get(roomId);
    io.to(roomId).emit("userCount", room.users.size);
    socket.emit("playlistUpdate", room.playlist);
    socket.emit("playerStateUpdate", room.playerState);
  });

  socket.on("chatMessage", ({ roomId, message }) => {
    console.log(`Chat message in room ${roomId}:`, message);
    io.to(roomId).emit("chatMessage", message);
  });

  socket.on("updatePlaylist", ({ roomId, playlist, userId }) => {
    const room = rooms.get(roomId);
    if (room && room.creator === userId) {
      console.log(`Updating playlist for room: ${roomId}`);
      room.playlist = playlist;
      io.to(roomId).emit("playlistUpdate", playlist);

      if (playlist.length > 0 && !room.playerState.videoId) {
        room.playerState.videoId = playlist[0].id;
        io.to(roomId).emit("playerStateUpdate", room.playerState);
      }
    } else {
      console.log(`Unauthorized playlist update attempt in room: ${roomId}`);
    }
  });

  socket.on("playerStateChange", ({ roomId, state, userId }) => {
    const room = rooms.get(roomId);
    if (room && room.creator === userId) {
      console.log(`Updating player state for room ${roomId}:`, state);
      room.playerState = state;
      socket.to(roomId).emit("playerStateUpdate", state);
    } else {
      console.log(
        `Unauthorized player state change attempt in room: ${roomId}`
      );
    }
  });

  socket.on("requestSync", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      socket.emit("playerStateUpdate", room.playerState);
    }
  });

  const handleDisconnect = () => {
    console.log("User disconnected:", socket.id);
    for (const [roomId, room] of rooms.entries()) {
      const disconnectedUserId = Array.from(room.users.entries()).find(
        ([_, user]) => user.socketId === socket.id
      )?.[0];

      if (disconnectedUserId) {
        room.users.delete(disconnectedUserId);
        io.to(roomId).emit("userCount", room.users.size);

        if (room.creator === disconnectedUserId) {
          // Creator left, transfer creator privileges
          const newCreator = room.users.keys().next().value;
          if (newCreator) {
            room.creator = newCreator;
            console.log(`New creator for room ${roomId}: ${newCreator}`);
            io.to(roomId).emit("creatorChanged", { newCreator });
          }
        }

        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} closed due to no users`);
        }
      }
    }
  };

  socket.on("leaveRoom", handleDisconnect);
  socket.on("disconnect", handleDisconnect);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});
