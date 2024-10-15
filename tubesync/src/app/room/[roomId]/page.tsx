"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Menu, Search, Music, Trash2, Users } from "lucide-react";
import Link from "next/link";
import YouTube from "react-youtube";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { io, Socket } from "socket.io-client";
import { useParams, useRouter } from "next/navigation";
import { debounce } from "lodash";

interface Video {
  id: string;
  title: string;
  thumbnail: string;
}

interface ChatMessage {
  user: string;
  text: string;
}

interface PlayerState {
  videoId: string | null;
  isPlaying: boolean;
  currentTime: number;
}

const HomePage = () => {
  const { roomId } = useParams();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"playlist" | "chat">("playlist");
  const [videoUrl, setVideoUrl] = useState("");
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [playlist, setPlaylist] = useState<Video[]>([]);
  const [searchResult, setSearchResult] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const [userCount, setUserCount] = useState(0);
  const [username, setUsername] = useState("");
  const playerRef = useRef<any>(null);
  const [playerState, setPlayerState] = useState<PlayerState>({
    videoId: null,
    isPlaying: false,
    currentTime: 0,
  });
  const [isLocalChange, setIsLocalChange] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const syncThreshold = 2; // seconds

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSearch = async () => {
    const videoId = extractVideoId(videoUrl);
    if (videoId) {
      try {
        const videoInfo = await fetchVideoInfo(videoId);
        setSearchResult(videoInfo);
        addToPlaylist(videoInfo);
        setError(null);
      } catch (error) {
        console.error("Error fetching video info:", error);
        setError(
          "Failed to fetch video information. Please check the URL and try again."
        );
        setSearchResult(null);
      }
    } else {
      setError("Invalid YouTube URL. Please enter a valid URL.");
      setSearchResult(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVideoUrl(e.target.value);
  };

  useEffect(() => {
    if (videoUrl) {
      handleSearch();
    }
  }, [videoUrl]);

  const addToPlaylist = (video: Video) => {
    if (!playlist.some((v) => v.id === video.id)) {
      const updatedPlaylist = [...playlist, video];
      setPlaylist(updatedPlaylist);
      socketRef.current?.emit("updatePlaylist", {
        roomId,
        playlist: updatedPlaylist,
      });
      if (!currentVideo) {
        setCurrentVideo(video);
        updatePlayerState(video.id, true, 0);
      }
    }
    setSearchResult(null);
    setVideoUrl("");
  };

  const removeFromPlaylist = (videoId: string) => {
    const updatedPlaylist = playlist.filter((video) => video.id !== videoId);
    setPlaylist(updatedPlaylist);
    socketRef.current?.emit("updatePlaylist", {
      roomId,
      playlist: updatedPlaylist,
    });
    if (currentVideo && currentVideo.id === videoId) {
      const newCurrentVideo = updatedPlaylist[0] || null;
      setCurrentVideo(newCurrentVideo);
      updatePlayerState(newCurrentVideo?.id || null, false, 0);
    }
  };

  const extractVideoId = (url: string) => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const fetchVideoInfo = async (videoId: string): Promise<Video> => {
    const apiKey = "AIzaSyDWCZRMn07n-vZ4-yfgbzrb961ujGStUxQ"; // Replace with your actual YouTube API key
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet`
    );
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const video = data.items[0];
      const truncatedTitle =
        video.snippet.title.split(" ").slice(0, 6).join(" ") +
        (video.snippet.title.split(" ").length > 6 ? "..." : "");
      return {
        id: videoId,
        title: truncatedTitle,
        thumbnail: video.snippet.thumbnails.default.url,
      };
    }

    throw new Error("Video not found");
  };

  const handleVideoEnd = () => {
    const currentIndex = playlist.findIndex(
      (video) => video.id === currentVideo?.id
    );
    if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
      const nextVideo = playlist[currentIndex + 1];
      setCurrentVideo(nextVideo);
      updatePlayerState(nextVideo.id, true, 0);
    } else {
      setCurrentVideo(null);
      updatePlayerState(null, false, 0);
    }
  };

  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    } else {
      const usernameInput = prompt("Please enter your username:");
      if (usernameInput) {
        setUsername(usernameInput);
        localStorage.setItem("username", usernameInput);
      }
    }

    if (!roomId) {
      const newRoomId = Math.random().toString(36).substring(7);
      router.push(`/room/${newRoomId}`);
    } else {
      socketRef.current = io("http://localhost:3001");

      socketRef.current.on("connect_error", (err) => {
        console.error("Socket connection error:", err);
        setError("Failed to connect to the server. Please try again later.");
      });

      socketRef.current.emit("joinRoom", roomId);

      socketRef.current.on("chatMessage", (message: ChatMessage) => {
        setMessages((prevMessages) => [...prevMessages, message]);
      });

      socketRef.current.on("userCount", (count: number) => {
        setUserCount(count);
      });

      socketRef.current.on("playlistUpdate", (updatedPlaylist: Video[]) => {
        setPlaylist(updatedPlaylist);
        if (updatedPlaylist.length > 0 && !currentVideo) {
          setCurrentVideo(updatedPlaylist[0]);
          updatePlayerState(updatedPlaylist[0].id, true, 0);
        }
      });

      socketRef.current.on("playerStateUpdate", (state: PlayerState) => {
        console.log("Received playerStateUpdate:", state);
        if (!isLocalChange) {
          const currentTime = playerRef.current?.getCurrentTime() || 0;
          if (
            Math.abs(Math.floor(currentTime) - Math.floor(state.currentTime)) >
            syncThreshold
          ) {
            playerRef.current?.seekTo(state.currentTime);
          }

          setPlayerState(state);
          if (playerRef.current) {
            if (state.isPlaying) {
              playerRef.current.playVideo();
            } else {
              playerRef.current.pauseVideo();
            }
          }
        }
        setIsLocalChange(false);
      });

      return () => {
        socketRef.current?.disconnect();
      };
    }
  }, [roomId, router]);

  //

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && socketRef.current) {
      const message: ChatMessage = {
        user: username || "Anonymous",
        text: inputMessage.trim(),
      };
      socketRef.current.emit("chatMessage", { roomId, message });
      setInputMessage("");
    }
  };
  const test = () => {
    socketRef.current?.on("playerStateUpdate", (state: PlayerState) => {
      console.log("Received playerStateUpdate:", state);
    });
    console.log("Called");
  };

  const debouncedUpdatePlayerState = useCallback(
    debounce((state: PlayerState) => {
      console.log("Debounced player state update:", state);
      socketRef.current?.emit("playerStateChange", { roomId, state });
    }, 300),
    [roomId]
  );

  const updatePlayerState = (
    videoId: string | null,
    isPlaying: boolean,
    currentTime: number
  ) => {
    setIsLocalChange(true);
    const newState: PlayerState = { videoId, isPlaying, currentTime };
    setPlayerState(newState);
    debouncedUpdatePlayerState(newState);
  };

  const onPlayerReady = (event: any) => {
    playerRef.current = event.target;
    console.log("Player ready");
  };

  const onPlayerStateChange = (event: any) => {
    const playerStatus = event.data; // This should be the player state
    const currentTime = event.target.getCurrentTime();
    console.log(
      `Player state changed: ${playerStatus}, Current time: ${currentTime}`
    );

    // Determine if the video is playing or paused
    const isPlaying = playerStatus === YouTube.PlayerState.PLAYING;

    // Emit player state change to the server immediately
    const newState: PlayerState = {
      videoId: currentVideo?.id || null,
      isPlaying: isPlaying, // Set isPlaying based on the player status
      currentTime: currentTime,
    };

    // Emit player state change to the server
    socketRef.current?.emit("playerStateChange", { roomId, state: newState });

    // Update local player state
    setPlayerState((prevState) => ({
      ...prevState,
      isPlaying: isPlaying, // Update local state based on the player status
      currentTime: currentTime,
    }));
  };

  const synchronizeVideo = useCallback(() => {
    if (playerRef.current && socketRef.current) {
      const currentTime = playerRef.current.getCurrentTime();
      const isPlaying =
        playerRef.current.getPlayerState() === YouTube.PlayerState.PLAYING;
      const videoId = currentVideo?.id || null;

      if (Date.now() - lastUpdateTime > 5000) {
        // Only sync every 5 seconds
        console.log(
          `Syncing video. VideoID: ${videoId} Time: ${currentTime}, Playing: ${isPlaying}`
        );
        socketRef.current?.emit("playerStateChange", {
          roomId,
          state: { videoId, isPlaying, currentTime },
        });
        setLastUpdateTime(Date.now());
      }
    }
  }, [roomId, currentVideo, lastUpdateTime]);

  useEffect(() => {
    const syncInterval = setInterval(synchronizeVideo, 2000);
    return () => clearInterval(syncInterval);
  }, [synchronizeVideo]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Navbar */}
      <header className="flex justify-between items-center p-4 bg-gray-800">
        <div className="flex items-center">
          <Link
            href="/"
            className="text-xl font-bold text-white flex items-center"
          >
            <Music className="mr-2" />
            Tube <span className="text-red-500">▶</span>Sync
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative w-full md:w-3/4">
            <input
              type="text"
              placeholder="Paste YouTube URL here"
              value={videoUrl}
              onChange={handleInputChange}
              className="p-2 pl-10 bg-gray-700 rounded w-60 lg:w-[510px]"
            />
            <Search className="absolute left-2 top-1/2 cursor-pointer transform -translate-y-1/2 text-gray-00" />
          </div>
        </div>
        <button onClick={test}>Hello World</button>
        <div className="flex items-center text-gray-400 mr-8">
          <Users className="mr-2" />
          <span>{userCount}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Video section */}
        <div className="w-full md:w-3/4 bg-black flex-grow relative h-[300px] md:h-[600px] lg:h-[620px]">
          {playerState.videoId ? (
            <div className="absolute inset-0">
              <YouTube
                videoId={playerState.videoId || ""}
                opts={{
                  width: "100%",
                  height: "100%",
                  playerVars: {
                    autoplay: 1,
                    controls: 1,
                    modestbranding: 1,
                    rel: 0,
                  },
                }}
                className="w-full h-full"
                onReady={onPlayerReady}
                onStateChange={onPlayerStateChange}
                onPlay={() => console.log("Video started playing")}
                onPause={() => console.log("Video paused")}
                onEnd={handleVideoEnd}
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-2xl">
              <Music className="mr-2 w-8 h-8" /> No Video Playing
            </div>
          )}
        </div>

        {/* Playlist and Chat section */}
        <div className="w-full md:w-1/4 bg-gray-800 p-4 overflow-hidden">
          {/* <div className="mb-4">
            <input
              type="text"
              placeholder="Paste YouTube URL here"
              className="w-full p-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            <button
              onClick={seeMessage}
              className="mt-2 w-full bg-blue-600 text-white px-4 py-2 rounded"
            >
              Add to Playlist
            </button>
          </div> */}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex space-x-2 mb-4">
            <button
              onClick={() => setActiveTab("playlist")}
              className={`${
                activeTab === "playlist" ? "bg-blue-600" : "bg-gray-700"
              } text-white px-4 py-2 rounded flex-grow`}
            >
              Playlist
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`${
                activeTab === "chat" ? "bg-blue-600" : "bg-gray-700"
              } text-white px-4 py-2 rounded flex-grow`}
            >
              Chat
            </button>
          </div>

          {activeTab === "playlist" && (
            <div>
              {playlist.length > 0 ? (
                <ul className="space-y-4">
                  {playlist.map((video, index) => (
                    <li
                      key={index}
                      className="relative flex items-center space-x-2 bg-gray-700 p-2 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors duration-100"
                      onClick={() => {
                        setCurrentVideo(video);
                        updatePlayerState(video.id, true, 0);
                      }}
                    >
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-20 h-auto rounded"
                      />
                      <div className="flex-grow pr-8">
                        <p className="text-sm text-gray-300 truncate">
                          {video.title}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromPlaylist(video.id);
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-red-600 text-white p-1 rounded text-xs hover:bg-red-700 hover:shadow-lg transition-colors duration-200"
                        aria-label="Remove from playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-gray-500">
                  No videos in playlist
                </p>
              )}
            </div>
          )}

          {activeTab === "chat" && (
            <div className="h-full flex flex-col justify-between overflow-hidden">
              <div className="flex-grow overflow-y-auto mb-4">
                {messages.map((msg, index) => (
                  <div key={index} className="text-gray-300 mb-2">
                    <strong>{msg.user}: </strong>
                    {msg.text}
                  </div>
                ))}
              </div>
              <form
                onSubmit={handleSendMessage}
                className="flex items-center mb-14"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type a message"
                  className="flex-grow p-2 bg-gray-700 rounded "
                />
                <button
                  type="submit"
                  className="ml-2 bg-blue-600 text-white px-4 py-2 rounded"
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;
