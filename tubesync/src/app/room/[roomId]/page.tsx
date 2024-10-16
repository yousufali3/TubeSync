"use client";
import React, { useState, useEffect, useRef } from "react";
import { Menu, Search, Music, Trash2, Users } from "lucide-react";
import Link from "next/link";
import YouTube from "react-youtube";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { io, Socket } from "socket.io-client";
import { useParams, useRouter } from "next/navigation";

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
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    const storedUsername = sessionStorage.getItem("username");
    let uniqueId = sessionStorage.getItem("creatorId");

    if (storedUsername) {
      setUsername(storedUsername);
    } else {
      const usernameInput = prompt("Please enter your username:");
      if (usernameInput) {
        setUsername(usernameInput);
        sessionStorage.setItem("username", usernameInput);
      }
    }

    if (!uniqueId) {
      uniqueId = Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem("creatorId", uniqueId);
    }

    if (!roomId) {
      const newRoomId = Math.random().toString(36).substring(7);
      router.push(`/room/${newRoomId}`);
    } else {
      socketRef.current = io("http://localhost:3001");

      socketRef.current.on("connect", () => {
        socketRef.current?.emit("joinRoom", {
          roomId,
          username,
          userId: uniqueId,
        });
      });

      socketRef.current.on("roomJoined", (data: { isCreator: boolean }) => {
        setIsCreator(data.isCreator);
      });

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
        }
      });

      socketRef.current.on("playerStateUpdate", (state: PlayerState) => {
        setPlayerState(state);
        if (playerRef.current) {
          if (state.isPlaying) {
            playerRef.current.playVideo();
          } else {
            playerRef.current.pauseVideo();
          }
          if (
            Math.abs(playerRef.current.getCurrentTime() - state.currentTime) > 2
          ) {
            playerRef.current.seekTo(state.currentTime);
          }
        }
      });

      socketRef.current.on("creatorChanged", ({ newCreator }) => {
        setIsCreator(sessionStorage.getItem("creatorId") === newCreator);
      });

      // Request initial sync
      socketRef.current.emit("requestSync", { roomId });

      return () => {
        socketRef.current?.disconnect();
      };
    }
  }, [roomId, router, username]);

  const handleSearch = async () => {
    if (!isCreator) {
      setError("Only the room creator can add videos to the playlist.");
      return;
    }

    const videoId = extractVideoId(videoUrl);
    console.log(videoId);

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

  const addToPlaylist = (video: Video) => {
    if (!isCreator) return;
    if (!playlist.some((v) => v.id === video.id)) {
      const updatedPlaylist = [...playlist, video];
      setPlaylist(updatedPlaylist);
      socketRef.current?.emit("updatePlaylist", {
        roomId,
        playlist: updatedPlaylist,
        userId: sessionStorage.getItem("creatorId"),
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
    if (!isCreator) return;
    const updatedPlaylist = playlist.filter((video) => video.id !== videoId);
    setPlaylist(updatedPlaylist);
    socketRef.current?.emit("updatePlaylist", {
      roomId,
      playlist: updatedPlaylist,
      userId: sessionStorage.getItem("creatorId"),
    });
    if (currentVideo && currentVideo.id === videoId) {
      const newCurrentVideo = updatedPlaylist[0] || null;
      setCurrentVideo(newCurrentVideo);
      updatePlayerState(newCurrentVideo?.id || null, false, 0);
    }
  };

  const updatePlayerState = (
    videoId: string | null,
    isPlaying: boolean,
    currentTime: number
  ) => {
    if (!isCreator) return;
    const newState: PlayerState = { videoId, isPlaying, currentTime };
    setPlayerState(newState);
    socketRef.current?.emit("playerStateChange", {
      roomId,
      state: newState,
      userId: sessionStorage.getItem("creatorId"),
    });
  };

  const onPlayerReady = (event: any) => {
    playerRef.current = event.target;
  };

  const onPlayerStateChange = (event: any) => {
    if (!isCreator) return;
    const playerStatus = event.data;
    const currentTime = event.target.getCurrentTime();
    const isPlaying = playerStatus === YouTube.PlayerState.PLAYING;
    updatePlayerState(currentVideo?.id || null, isPlaying, currentTime);
  };

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

  const extractVideoId = (url: string) => {
    console.log(url);

    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const fetchVideoInfo = async (videoId: string): Promise<Video> => {
    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet`
    );
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const video = data.items[0];
      return {
        id: videoId,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails.default.url,
      };
    }

    throw new Error("Video not found");
  };

  const handleVideoEnd = () => {
    if (!isCreator) return;
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
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVideoUrl(e.target.value);
  };

  useEffect(() => {
    if (videoUrl) {
      handleSearch();
    }
  }, [videoUrl]);

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
          {/* Conditionally render the search input only for creators */}
          {isCreator && (
            <div className="relative w-full md:w-3/4">
              <input
                type="text"
                placeholder="Paste YouTube URL here"
                value={videoUrl}
                onChange={handleInputChange}
                className="p-2 pl-10 bg-gray-700 rounded w-60 lg:w-[510px]"
              />
              <Search
                className="absolute left-2 top-1/2 cursor-pointer transform -translate-y-1/2 text-gray-400"
                onClick={handleSearch} // Optional: still allow clicking the icon to search
              />
            </div>
          )}
        </div>
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
                    controls: isCreator ? 1 : 0, // Show controls only for creators
                    modestbranding: 1,
                    rel: 0,
                    cc_load_policy: 0, // Turn off captions for everyone
                  },
                }}
                className="w-full h-full"
                onReady={onPlayerReady}
                onStateChange={onPlayerStateChange}
                onPlay={() => {
                  if (isCreator) {
                    updatePlayerState(
                      playerState.videoId,
                      true,
                      playerRef.current?.getCurrentTime() || 0
                    );
                  }
                }}
                onPause={() => {
                  if (isCreator) {
                    updatePlayerState(
                      playerState.videoId,
                      false,
                      playerRef.current?.getCurrentTime() || 0
                    );
                  }
                }}
                onEnd={() => {
                  if (isCreator) {
                    handleVideoEnd();
                  }
                }}
              />
              {/* Removed the video title display */}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-2xl">
              <Music className="mr-2 w-8 h-8" /> No Video Playing
            </div>
          )}
        </div>

        {/* Playlist and Chat section */}
        <div className="w-full md:w-1/4 bg-gray-800 p-4 overflow-hidden">
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
                        // Allow all users to select a video
                        setCurrentVideo(video);
                        // Only update player state if the user is the creator
                        if (isCreator) {
                          updatePlayerState(video.id, true, 0);
                        }
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
                      {isCreator && (
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
                      )}
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
