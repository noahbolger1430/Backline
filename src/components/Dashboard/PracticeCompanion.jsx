import React, { useState, useEffect, useRef, useCallback } from "react";
import { setlistService } from "../../services/setlistService";
import { youtubeService } from "../../services/youtubeService";
import "./PracticeCompanion.css";

const PracticeCompanion = ({ bandId, bandName, onBack }) => {
  const [setlists, setSetlists] = useState([]);
  const [selectedSetlistId, setSelectedSetlistId] = useState("");
  const [selectedSetlist, setSelectedSetlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [practicedSongs, setPracticedSongs] = useState(new Set());
  
  // YouTube state
  const [youtubeApiConfigured, setYoutubeApiConfigured] = useState(null);
  const [youtubeVideos, setYoutubeVideos] = useState([]);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);

  useEffect(() => {
    fetchSetlists();
    loadPracticedSongs();
    checkYoutubeStatus();
  }, [bandId]);

  // Initialize YouTube IFrame API
  useEffect(() => {
    // Load YouTube IFrame API script if not already loaded
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
    
    // Set up callback for when API is ready
    window.onYouTubeIframeAPIReady = () => {
      setPlayerReady(true);
    };
    
    // If API already loaded
    if (window.YT && window.YT.Player) {
      setPlayerReady(true);
    }
    
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []);

  // Initialize player when videos are loaded and API is ready
  useEffect(() => {
    if (playerReady && youtubeVideos.length > 0 && playerContainerRef.current) {
      initializePlayer();
    }
  }, [playerReady, youtubeVideos]);

  const initializePlayer = useCallback(() => {
    const foundVideos = youtubeVideos.filter(v => v.found && v.video_id);
    if (foundVideos.length === 0) return;

    // Destroy existing player
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    const firstVideo = foundVideos[0];
    
    playerRef.current = new window.YT.Player("youtube-player", {
      height: "100%",
      width: "100%",
      videoId: firstVideo.video_id,
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        enablejsapi: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  }, [youtubeVideos]);

  const onPlayerReady = (event) => {
    console.log("YouTube player ready");
  };

  const onPlayerStateChange = (event) => {
    // YT.PlayerState: ENDED=0, PLAYING=1, PAUSED=2, BUFFERING=3, CUED=5
    if (event.data === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      setIsPlaying(false);
    } else if (event.data === window.YT.PlayerState.ENDED) {
      setIsPlaying(false);
      // Auto-play next video
      playNextVideo();
    }
  };

  const playNextVideo = () => {
    const foundVideos = youtubeVideos.filter(v => v.found && v.video_id);
    if (currentVideoIndex < foundVideos.length - 1) {
      const nextIndex = currentVideoIndex + 1;
      setCurrentVideoIndex(nextIndex);
      if (playerRef.current && playerRef.current.loadVideoById) {
        playerRef.current.loadVideoById(foundVideos[nextIndex].video_id);
      }
    }
  };

  const playVideoAtIndex = (index) => {
    const foundVideos = youtubeVideos.filter(v => v.found && v.video_id);
    if (index >= 0 && index < foundVideos.length) {
      setCurrentVideoIndex(index);
      if (playerRef.current && playerRef.current.loadVideoById) {
        playerRef.current.loadVideoById(foundVideos[index].video_id);
      }
    }
  };

  const checkYoutubeStatus = async () => {
    try {
      const status = await youtubeService.getStatus();
      setYoutubeApiConfigured(status.configured);
    } catch (err) {
      console.error("Failed to check YouTube status:", err);
      setYoutubeApiConfigured(false);
    }
  };

  // Load practiced songs from localStorage
  const loadPracticedSongs = () => {
    const key = `practiced_songs_${bandId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const practicedSet = new Set(JSON.parse(saved));
        setPracticedSongs(practicedSet);
      } catch (err) {
        console.error("Failed to load practiced songs:", err);
      }
    }
  };

  // Save practiced songs to localStorage
  const savePracticedSongs = (songSet) => {
    const key = `practiced_songs_${bandId}`;
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(songSet)));
    } catch (err) {
      console.error("Failed to save practiced songs:", err);
    }
  };

  const fetchSetlists = async () => {
    try {
      setLoading(true);
      const lists = await setlistService.getBandSetlists(bandId);
      setSetlists(lists);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch setlists:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetlistChange = async (e) => {
    const setlistId = e.target.value;
    setSelectedSetlistId(setlistId);
    setYoutubeVideos([]);
    setCurrentVideoIndex(0);

    if (setlistId) {
      try {
        const setlist = await setlistService.getSetlist(setlistId);
        setSelectedSetlist(setlist);
        setError(null);
        
        // Automatically search for YouTube videos
        if (youtubeApiConfigured) {
          searchYoutubeVideos(setlistId);
        }
      } catch (err) {
        console.error("Failed to fetch setlist:", err);
        setError(err.message);
        setSelectedSetlist(null);
      }
    } else {
      setSelectedSetlist(null);
    }
  };

  const searchYoutubeVideos = async (setlistId) => {
    try {
      setYoutubeLoading(true);
      setYoutubeError(null);
      
      const response = await youtubeService.searchSetlistSongs(setlistId, bandName);
      setYoutubeVideos(response.results);
      setYoutubeApiConfigured(response.api_configured);
    } catch (err) {
      console.error("Failed to search YouTube videos:", err);
      setYoutubeError(err.message);
    } finally {
      setYoutubeLoading(false);
    }
  };

  // Normalize song to object format
  const normalizeSong = (song) => {
    if (typeof song === 'string') {
      return { title: song, artist: "" };
    } else if (song && typeof song === 'object') {
      return {
        title: song.title || song.name || "",
        artist: song.artist || ""
      };
    }
    return { title: "", artist: "" };
  };

  // Get song display name
  const getSongDisplayName = (song) => {
    const normalized = normalizeSong(song);
    if (normalized.artist) {
      return `${normalized.artist} - ${normalized.title}`;
    }
    return normalized.title;
  };

  // Get song key for practiced songs tracking
  const getSongKey = (song) => {
    const normalized = normalizeSong(song);
    return `${selectedSetlistId}_${normalized.title}_${normalized.artist}`;
  };

  const handleTogglePracticed = (song) => {
    const newPracticedSongs = new Set(practicedSongs);
    const songKey = getSongKey(song);
    
    if (newPracticedSongs.has(songKey)) {
      newPracticedSongs.delete(songKey);
    } else {
      newPracticedSongs.add(songKey);
    }
    
    setPracticedSongs(newPracticedSongs);
    savePracticedSongs(newPracticedSongs);
  };

  // Get the currently playing song
  const getCurrentlyPlayingSong = () => {
    const foundVideos = youtubeVideos.filter(v => v.found && v.video_id);
    if (foundVideos.length > 0 && currentVideoIndex < foundVideos.length) {
      const video = foundVideos[currentVideoIndex];
      // Match by song_title if available, otherwise by song_name
      return video.song_title || video.song_name;
    }
    return null;
  };

  // Sort songs: practiced songs go to the bottom
  const getSortedSongs = () => {
    if (!selectedSetlist || !selectedSetlist.songs) return [];
    
    const unpracticed = [];
    const practiced = [];
    
    selectedSetlist.songs.forEach((song) => {
      const songKey = getSongKey(song);
      if (practicedSongs.has(songKey)) {
        practiced.push(song);
      } else {
        unpracticed.push(song);
      }
    });
    
    return [...unpracticed, ...practiced];
  };

  // Get YouTube video index for a song
  const getVideoIndexForSong = (song) => {
    const foundVideos = youtubeVideos.filter(v => v.found && v.video_id);
    const normalized = normalizeSong(song);
    // Try to match by song_title first, then by song_name
    return foundVideos.findIndex(v => 
      (v.song_title && v.song_title === normalized.title) ||
      v.song_name === getSongDisplayName(song)
    );
  };

  // Check if a song has a YouTube video
  const hasYoutubeVideo = (song) => {
    const normalized = normalizeSong(song);
    return youtubeVideos.some(v => 
      v.found && v.video_id && (
        (v.song_title && v.song_title === normalized.title) ||
        v.song_name === getSongDisplayName(song)
      )
    );
  };

  const currentlyPlayingSong = getCurrentlyPlayingSong();
  const foundVideosCount = youtubeVideos.filter(v => v.found && v.video_id).length;

  if (loading) {
    return (
      <div className="practice-companion-container">
        <div className="practice-companion-loading">Loading setlists...</div>
      </div>
    );
  }

  return (
    <div className="practice-companion-container">
      <div className="practice-companion-header">
        <button className="practice-companion-back-button" onClick={onBack}>
          <span className="practice-companion-back-arrow">←</span>
          Back to Tools
        </button>
        <h2 className="practice-companion-title">Practice Companion</h2>
        <div style={{ width: "150px" }}></div>
      </div>

      <div className="practice-companion-main">
        {/* Left Panel - Songs List */}
        <div className="practice-companion-left-panel">
          <div className="practice-companion-content">
            {error && (
              <div className="practice-companion-error-message">{error}</div>
            )}

            <div className="setlist-selector-section">
              <label htmlFor="setlist-select" className="setlist-selector-label">
                Select a Setlist
              </label>
              <select
                id="setlist-select"
                value={selectedSetlistId}
                onChange={handleSetlistChange}
                className="setlist-selector"
              >
                <option value="">-- Choose a setlist --</option>
                {setlists.map((setlist) => (
                  <option key={setlist.id} value={setlist.id}>
                    {setlist.name} ({setlist.song_count} {setlist.song_count === 1 ? "song" : "songs"})
                  </option>
                ))}
              </select>
            </div>

            {selectedSetlist && (
              <div className="songs-list-section">
                <div className="songs-list-header">
                  <h3 className="songs-list-title">{selectedSetlist.name}</h3>
                  {youtubeLoading && (
                    <div className="youtube-loading-badge">
                      <span className="loading-spinner"></span>
                      Finding songs...
                    </div>
                  )}
                  {!youtubeLoading && foundVideosCount > 0 && (
                    <div className="youtube-found-badge">
                      🎵 {foundVideosCount} songs found
                    </div>
                  )}
                </div>
                <div className="songs-list">
                  {selectedSetlist.songs && selectedSetlist.songs.length > 0 ? (
                    (() => {
                      const sortedSongs = getSortedSongs();
                      const songKeyPrefix = `${selectedSetlistId}_`;
                      
                      return sortedSongs.map((song, displayIndex) => {
                        const normalized = normalizeSong(song);
                        const songKey = getSongKey(song);
                        const isPracticed = practicedSongs.has(songKey);
                        const originalIndex = selectedSetlist.songs.indexOf(song);
                        const isCurrentlyPlaying = currentlyPlayingSong === normalized.title && isPlaying;
                        const isCurrentSong = currentlyPlayingSong === normalized.title;
                        const videoIndex = getVideoIndexForSong(song);
                        const hasVideo = hasYoutubeVideo(song);
                        
                        return (
                          <div 
                            key={`${originalIndex}_${normalized.title}_${normalized.artist}`} 
                            className={`song-item ${isPracticed ? 'practiced' : ''} ${isCurrentlyPlaying ? 'playing' : ''} ${isCurrentSong ? 'current' : ''}`}
                          >
                            <div className={`song-number ${isCurrentSong ? 'current' : ''}`}>
                              {isCurrentlyPlaying ? (
                                <span className="playing-indicator">▶</span>
                              ) : (
                                originalIndex + 1
                              )}
                            </div>
                            <div className={`song-name ${isPracticed ? 'practiced-name' : ''}`}>
                              <div className="song-title">{normalized.title}</div>
                              {normalized.artist && (
                                <div className="song-artist">{normalized.artist}</div>
                              )}
                            </div>
                            <div className="song-actions">
                              {hasVideo && (
                                <button
                                  className={`play-song-button ${isCurrentSong ? 'active' : ''}`}
                                  onClick={() => playVideoAtIndex(videoIndex)}
                                  title="Play this song"
                                >
                                  {isCurrentSong ? "♪" : "▶"}
                                </button>
                              )}
                              <button
                                className={`practice-toggle-button ${isPracticed ? 'practiced' : ''}`}
                                onClick={() => handleTogglePracticed(song)}
                                title={isPracticed ? "Mark as needs practice" : "Mark as practiced"}
                              >
                                {isPracticed ? "✓" : "○"}
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()
                  ) : (
                    <div className="no-songs-message">No songs in this setlist</div>
                  )}
                </div>
              </div>
            )}

            {!selectedSetlistId && setlists.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🎸</div>
                <h3 className="empty-state-title">No Setlists Available</h3>
                <p className="empty-state-description">
                  Create a setlist in the Setlist Builder to get started with practice
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - YouTube Player */}
        <div className="practice-companion-right-panel">
          <div className="youtube-panel">
            <div className="youtube-panel-header">
              <h3 className="youtube-panel-title">
                <svg className="youtube-logo-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                YouTube Player
              </h3>
            </div>
            
            {!selectedSetlist && (
              <div className="youtube-empty-state">
                <div className="youtube-empty-icon">📺</div>
                <p>Select a setlist to start practicing</p>
              </div>
            )}

            {selectedSetlist && youtubeApiConfigured === false && (
              <div className="youtube-not-configured">
                <div className="youtube-warning-icon">⚠️</div>
                <h4>YouTube API Not Configured</h4>
                <p>
                  To use the YouTube player, add your YouTube API key to the .env file:
                </p>
                <code>YOUTUBE_API_KEY=your_api_key_here</code>
                <p className="youtube-api-hint">
                  Get your API key from the{" "}
                  <a 
                    href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    Google Cloud Console
                  </a>
                </p>
              </div>
            )}

            {selectedSetlist && youtubeApiConfigured && (
              <>
                {youtubeLoading && (
                  <div className="youtube-loading">
                    <div className="youtube-loading-spinner"></div>
                    <p>Searching for songs on YouTube...</p>
                  </div>
                )}

                {youtubeError && (
                  <div className="youtube-error">
                    <div className="youtube-error-icon">❌</div>
                    <p>{youtubeError}</p>
                  </div>
                )}

                {!youtubeLoading && !youtubeError && foundVideosCount === 0 && (
                  <div className="youtube-no-results">
                    <div className="youtube-no-results-icon">🔍</div>
                    <p>No YouTube videos found for this setlist</p>
                  </div>
                )}

                {!youtubeLoading && !youtubeError && foundVideosCount > 0 && (
                  <div className="youtube-player-wrapper">
                    <div className="youtube-player-container">
                      <div id="youtube-player" ref={playerContainerRef}></div>
                    </div>
                    
                    <div className="youtube-playlist">
                      <div className="youtube-playlist-header">
                        <span className="youtube-playlist-title">Queue</span>
                        <span className="youtube-playlist-count">
                          {currentVideoIndex + 1} / {foundVideosCount}
                        </span>
                      </div>
                      <div className="youtube-playlist-items">
                        {youtubeVideos
                          .filter(v => v.found && v.video_id)
                          .map((video, index) => (
                            <div
                              key={video.video_id}
                              className={`youtube-playlist-item ${index === currentVideoIndex ? 'active' : ''}`}
                              onClick={() => playVideoAtIndex(index)}
                            >
                              <div className="youtube-playlist-item-number">
                                {index === currentVideoIndex && isPlaying ? (
                                  <span className="mini-playing-indicator">▶</span>
                                ) : (
                                  index + 1
                                )}
                              </div>
                              <img 
                                src={video.thumbnail_url} 
                                alt={video.title}
                                className="youtube-playlist-item-thumb"
                              />
                              <div className="youtube-playlist-item-info">
                                <div className="youtube-playlist-item-song">{video.song_name}</div>
                                <div className="youtube-playlist-item-channel">{video.channel_title}</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeCompanion;
