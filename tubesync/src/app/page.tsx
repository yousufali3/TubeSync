"use client";
import { useRouter } from "next/navigation"; // Import useRouter for navigation
import { Play } from "lucide-react"; // Importing the required icons
import Navbar from "./components/Navbar";
import { useState } from "react"; // Import useState for managing state

const LandingPage = () => {
  const router = useRouter(); // Initialize the router
  const [roomIdInput, setRoomIdInput] = useState(""); // New state for room ID input

  const handleCreateRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 10); // Generate a random room ID
    router.push(`/room/${newRoomId}`); // Navigate to the new room
  };

  const handleJoinRoom = () => {
    if (roomIdInput) {
      router.push(`/room/${roomIdInput}`); // Navigate to the specified room
    }
  };

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      {/* Main content */}
      <Navbar />
      <main className="flex-1 p-5 md:p-7 max-w-[550px] mx-auto">
        <div className="bg-gray-800 rounded-lg overflow-hidden mb-7">
          <div className="h-40 md:h-64 bg-gray-700 flex items-center justify-center">
            <Play className="text-red-500 w-14 h-14 md:w-22 md:h-22" />
          </div>
          <div className="p-4">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>

        <h2 className="text-lg md:text-2xl text-center mb-5">
          A simple platform to watch
          <br />
          YouTube videos together.
        </h2>

        <div className="text-center mb-4">
          <input
            type="text"
            placeholder="Enter Room ID to Join"
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value)}
            className="p-2 bg-gray-700 rounded mb-2 mr-2"
          />
          <button
            onClick={handleJoinRoom}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Join Room
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={handleCreateRoom} // Add onClick handler
            className="bg-gray-800 text-white px-5 py-2 md:px-7 md:py-3 rounded-full text-lg font-semibold"
          >
            Create Room
          </button>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
