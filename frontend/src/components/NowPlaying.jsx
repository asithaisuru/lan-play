import { useCallback, useEffect, useRef, useState } from 'react';

const YOUTUBE_HOST_ID = 'lan-play-youtube-host';
const YOUTUBE_MOUNT_ID = 'lan-play-youtube-player';

const ensureYouTubeMount = () => {
  if (typeof document === 'undefined') return null;

  let host = document.getElementById(YOUTUBE_HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = YOUTUBE_HOST_ID;
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = [
      'position:fixed',
      'left:-9999px',
      'top:0',
      'width:1px',
      'height:1px',
      'overflow:hidden',
      'opacity:0',
      'pointer-events:none'
    ].join(';');
    document.body.appendChild(host);
  }

  let mount = document.getElementById(YOUTUBE_MOUNT_ID);
  if (!mount) {
    mount = document.createElement('div');
    mount.id = YOUTUBE_MOUNT_ID;
    host.replaceChildren(mount);
  }

  return mount;
};

const NowPlaying = ({ 
  currentSong, 
  currentSource,
  isPlaying, 
  syncedCurrentTime = 0,
  isHost, 
  isAudioDevice,
  playAnnouncement,
  playlist,
  socket,
  visiblePlayer = false,
  audioActivated = false,
  onAudioActivated
}) => {
  const visiblePlayerHostRef = useRef(null);
  const playerRef = useRef(null);
  const playerReadyRef = useRef(false);
  const hasAnnouncedRef = useRef(false);
  const playerSongIdRef = useRef(null);
  const playerVideoIdRef = useRef(null);
  const announcementTimerRef = useRef(null);
  const latestStateRef = useRef({
    currentSong,
    currentSource,
    isHost,
    isAudioDevice,
    isPlaying,
    playlist,
    socket
  });
  const songSwitchTokenRef = useRef(0);
  const fadeIntervalsRef = useRef(new Set());
  const [player, setPlayer] = useState(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isYouTubeReady, setIsYouTubeReady] = useState(Boolean(window.YT?.Player));
  const [elapsedTime, setElapsedTime] = useState(syncedCurrentTime || 0);
  const [knownDuration, setKnownDuration] = useState(currentSong?.duration || 0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const roomVolume = Math.max(0, Math.min(100, Number(playlist?.volume ?? 100)));
  const effectiveAudioReady = !isAudioDevice || audioReady || audioActivated;
  const canUseAudioPlayer = Boolean(isAudioDevice && effectiveAudioReady);

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const safeSeconds = Math.floor(seconds);
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fadeVolume = useCallback((youtubePlayer, targetVolume, duration = 1200) => {
    if (!youtubePlayer?.setVolume || !youtubePlayer?.getVolume) {
      return Promise.resolve();
    }

    try {
      const iframe = youtubePlayer.getIframe?.();
      if (iframe && !iframe.isConnected) {
        return Promise.resolve();
      }
    } catch {
      return Promise.resolve();
    }

    let startVolume = 100;
    try {
      startVolume = youtubePlayer.getVolume();
    } catch (error) {
      console.warn('Player volume read failed:', error);
      return Promise.resolve();
    }

    const steps = 12;
    const stepMs = duration / steps;
    const volumeStep = (targetVolume - startVolume) / steps;
    let currentStep = 0;

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        try {
          const activeIframe = youtubePlayer.getIframe?.();
          if (activeIframe && !activeIframe.isConnected) {
            clearInterval(interval);
            fadeIntervalsRef.current.delete(interval);
            resolve();
            return;
          }
        } catch {
          clearInterval(interval);
          fadeIntervalsRef.current.delete(interval);
          resolve();
          return;
        }

        currentStep += 1;
        try {
          youtubePlayer.setVolume(Math.max(0, Math.min(100, startVolume + (volumeStep * currentStep))));
        } catch (error) {
          clearInterval(interval);
          fadeIntervalsRef.current.delete(interval);
          console.warn('Player volume fade stopped:', error);
          resolve();
          return;
        }

        if (currentStep >= steps) {
          clearInterval(interval);
          fadeIntervalsRef.current.delete(interval);
          try {
            youtubePlayer.setVolume(targetVolume);
          } catch (error) {
            console.warn('Player final volume set failed:', error);
          }
          resolve();
        }
      }, stepMs);
      fadeIntervalsRef.current.add(interval);
    });
  }, []);

  const clearFadeIntervals = useCallback(() => {
    fadeIntervalsRef.current.forEach((interval) => clearInterval(interval));
    fadeIntervalsRef.current.clear();
  }, []);

  const isReadyPlayer = useCallback((youtubePlayer) => (
    Boolean(
      youtubePlayer
      && typeof youtubePlayer.playVideo === 'function'
      && typeof youtubePlayer.pauseVideo === 'function'
      && typeof youtubePlayer.loadVideoById === 'function'
      && typeof youtubePlayer.cueVideoById === 'function'
    )
  ), []);

  const getPlayerMount = useCallback(() => {
    if (visiblePlayer && visiblePlayerHostRef.current) {
      let mount = visiblePlayerHostRef.current.querySelector('[data-waveio-youtube-mount="true"]');
      if (!mount) {
        mount = document.createElement('div');
        mount.dataset.waveioYoutubeMount = 'true';
        mount.style.width = '100%';
        mount.style.height = '100%';
        visiblePlayerHostRef.current.replaceChildren(mount);
      }
      return mount;
    }

    return ensureYouTubeMount();
  }, [visiblePlayer]);

  const handleActivateAudio = useCallback((e) => {
    if (e?.preventDefault) e.preventDefault();
    if (e?.stopPropagation) e.stopPropagation();
    setAudioReady(true);
    onAudioActivated?.();

    const activePlayer = playerRef.current;
    if (!isReadyPlayer(activePlayer) || !currentSong) return;

    try {
      const targetTime = Number(syncedCurrentTime || 0);
      if (targetTime > 0 && typeof activePlayer.seekTo === 'function') {
        activePlayer.seekTo(targetTime, true);
        setElapsedTime(targetTime);
      }
      activePlayer.setVolume?.(roomVolume);
      if (isPlaying) {
        activePlayer.playVideo();
      }
    } catch (error) {
      console.warn('Audio activation play attempt failed:', error);
    }
  }, [currentSong, isPlaying, isReadyPlayer, onAudioActivated, roomVolume, syncedCurrentTime]);

  useEffect(() => {
    latestStateRef.current = {
      currentSong,
      currentSource,
      isHost,
      isAudioDevice,
      isPlaying,
      playlist,
      socket,
      audioReady: effectiveAudioReady
    };
  }, [currentSong, currentSource, effectiveAudioReady, isAudioDevice, isHost, isPlaying, playlist, socket]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT?.Player) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = () => setIsYouTubeReady(true);
    } else {
      setIsYouTubeReady(true);
    }
  }, []);

  const stopHostPlayer = useCallback(() => {
    const existingPlayer = playerRef.current;
    if (!existingPlayer) return;

    clearFadeIntervals();

    try {
      existingPlayer.stopVideo?.();
      existingPlayer.destroy?.();
    } catch (error) {
      console.warn('YouTube player stop failed:', error);
    }

    playerRef.current = null;
    playerSongIdRef.current = null;
    playerVideoIdRef.current = null;
    playerReadyRef.current = false;
    hasAnnouncedRef.current = false;
    clearTimeout(announcementTimerRef.current);
    visiblePlayerHostRef.current?.replaceChildren();
    setPlayer(null);
    setIsPlayerReady(false);
  }, [clearFadeIntervals]);

  // Initialize a single YouTube player and reuse it for all song changes.
  const initializePlayer = useCallback(() => {
    const mountNode = getPlayerMount();
    if (!currentSong || !canUseAudioPlayer || !window.YT?.Player || !mountNode) return;
    if (playerRef.current) {
      if (isReadyPlayer(playerRef.current)) {
        setPlayer(playerRef.current);
        setIsPlayerReady(true);
      }
      return;
    }

    playerRef.current = new window.YT.Player(mountNode, {
      height: visiblePlayer ? '360' : '1',
      width: visiblePlayer ? '640' : '1',
      videoId: currentSong.youtubeId,
      playerVars: {
        'autoplay': 0,
        'controls': visiblePlayer ? 1 : 0,
        'disablekb': 1,
        'fs': 0,
        'modestbranding': 1,
        'playsinline': 1
        },
        events: {
          'onReady': (event) => {
          const latest = latestStateRef.current;
          const activeSong = latest.currentSong;
          try {
            event.target.setVolume(0);
          } catch (error) {
            console.warn('Player initial volume set failed:', error);
          }
          setPlayer(event.target);
          playerRef.current = event.target;
          playerReadyRef.current = true;
          setIsPlayerReady(true);
          if (visiblePlayer) {
            try {
              const iframe = event.target.getIframe?.();
              if (iframe) {
                iframe.style.width = '100%';
                iframe.style.height = '100%';
              }
            } catch (error) {
              console.warn('Visible player sizing failed:', error);
            }
          }
          playerSongIdRef.current = activeSong?._id || null;
          playerVideoIdRef.current = activeSong?.youtubeId || null;
          const duration = event.target.getDuration?.() || activeSong?.duration || 0;
          setKnownDuration(duration);
          if (latest.audioReady && latest.isPlaying && typeof event.target.playVideo === 'function') {
            try {
              const resumeTime = Number(latest.playlist?.currentTime || 0);
              if (resumeTime > 0 && typeof event.target.seekTo === 'function') {
                event.target.seekTo(resumeTime, true);
                setElapsedTime(resumeTime);
              }
              event.target.playVideo();
            } catch (error) {
              console.warn('Player initial play failed:', error);
            }
          }
          fadeVolume(event.target, roomVolume);
          if (latest.socket && duration > 0) {
            latest.socket.emit('playback-progress', {
              currentTime: event.target.getCurrentTime?.() || 0,
              duration
            });
          }
        },
        'onStateChange': (event) => {
          const latest = latestStateRef.current;
          const activeSong = latest.currentSong;
          
          // Song started playing
          if (event.data === window.YT.PlayerState.PLAYING && !hasAnnouncedRef.current) {
            // Schedule announcement after 5 seconds
            clearTimeout(announcementTimerRef.current);
            announcementTimerRef.current = setTimeout(() => {
              const announcementState = latestStateRef.current;
              const announcementSong = announcementState.currentSong;
              if (announcementState.playlist?.announcementEnabled && announcementState.currentSource === 'queue' && announcementSong?.message) {
                playAnnouncement(
                  `This song was added by ${announcementSong.addedBy}. They say: ${announcementSong.message}`,
                  event.target
                );
                hasAnnouncedRef.current = true;
              }
            }, 5000);
          }
          
          // Song ended - play next song
          if (event.data === window.YT.PlayerState.ENDED) {
            hasAnnouncedRef.current = false;
            
            // Automatically play next song
            if (latest.socket && latest.isAudioDevice && activeSong?._id === playerSongIdRef.current) {
              latest.socket.emit('next-song');
            }
          }
          
          // Reset announcement flag when song is paused
          if (event.data === window.YT.PlayerState.PAUSED) {
            hasAnnouncedRef.current = false;
          }
        },
        'onError': (error) => {
          console.error('YouTube player error:', error);
          setIsPlayerReady(false);
          const latest = latestStateRef.current;
          
          // If there's an error with the current song, skip to next
          if (latest.socket && latest.isAudioDevice) {
            latest.socket.emit('next-song');
          }
        }
      }
    });

    hasAnnouncedRef.current = false;
    setIsPlayerReady(false);
  }, [canUseAudioPlayer, currentSong, fadeVolume, getPlayerMount, isReadyPlayer, playAnnouncement, roomVolume, visiblePlayer]);

  // Re-initialize player when song changes
  useEffect(() => {
    if (canUseAudioPlayer && isYouTubeReady) {
      initializePlayer();
    }
  }, [canUseAudioPlayer, currentSong, isYouTubeReady, initializePlayer]);

  useEffect(() => {
    if (!canUseAudioPlayer) {
      stopHostPlayer();
    }
  }, [canUseAudioPlayer, stopHostPlayer]);

  useEffect(() => {
    if (canUseAudioPlayer && player && !currentSong) {
      stopHostPlayer();
    }
  }, [canUseAudioPlayer, currentSong, player, stopHostPlayer]);

  useEffect(() => {
    if (!canUseAudioPlayer || !isPlayerReady || !isReadyPlayer(player) || !currentSong) return;
    if (playerSongIdRef.current === currentSong._id && playerVideoIdRef.current === currentSong.youtubeId) return;

    const switchToken = songSwitchTokenRef.current + 1;
    songSwitchTokenRef.current = switchToken;
    hasAnnouncedRef.current = false;
    clearTimeout(announcementTimerRef.current);
    playerSongIdRef.current = currentSong._id;
    playerVideoIdRef.current = currentSong.youtubeId;
    setKnownDuration(currentSong.duration || 0);
    const resumeTime = Number(syncedCurrentTime || 0);
    setElapsedTime(resumeTime);

    const switchSong = async () => {
      try {
        await fadeVolume(player, 0, 500);
        if (songSwitchTokenRef.current !== switchToken) return;

        if (isPlaying) {
          player.loadVideoById({ videoId: currentSong.youtubeId, startSeconds: resumeTime });
        } else {
          player.cueVideoById({ videoId: currentSong.youtubeId, startSeconds: resumeTime });
        }

        if (isPlaying) {
          await fadeVolume(player, roomVolume, 900);
        }
      } catch (error) {
        console.error('Player song switch error:', error);
      }
    };

    switchSong();
  }, [canUseAudioPlayer, currentSong, fadeVolume, isPlayerReady, isPlaying, isReadyPlayer, player, roomVolume, syncedCurrentTime]);

  useEffect(() => {
    if (!canUseAudioPlayer || !isPlayerReady || !isReadyPlayer(player)) return;

    try {
      player.setVolume?.(roomVolume);
    } catch (error) {
      console.warn('Player volume update failed:', error);
    }
  }, [canUseAudioPlayer, isPlayerReady, isReadyPlayer, player, roomVolume]);

  useEffect(() => {
    setElapsedTime(syncedCurrentTime || 0);
    setKnownDuration(currentSong?.duration || 0);
  }, [currentSong?._id, currentSong?.duration, syncedCurrentTime]);

  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!canUseAudioPlayer || !isPlayerReady || !isReadyPlayer(player) || !currentSong) return;

    let tick = 0;
    const interval = setInterval(() => {
      const current = player.getCurrentTime?.() || 0;
      const duration = player.getDuration?.() || currentSong.duration || 0;
      setElapsedTime(current);
      setKnownDuration(duration);

      tick += 1;
      if (socket && tick % 5 === 0) {
        socket.emit('playback-progress', {
          currentTime: current,
          duration
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [canUseAudioPlayer, currentSong, isPlayerReady, isReadyPlayer, player, socket]);

  useEffect(() => {
    if (isAudioDevice || !isPlaying || !currentSong) return;

    const interval = setInterval(() => {
      setElapsedTime((time) => {
        const nextTime = time + 1;
        if (knownDuration > 0) {
          return Math.min(nextTime, knownDuration);
        }
        return nextTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSong, isAudioDevice, isPlaying, knownDuration]);

  // Handle play/pause controls (host only)
  useEffect(() => {
    if (isPlayerReady && isReadyPlayer(player) && canUseAudioPlayer) {
      try {
        if (isPlaying) {
          const targetTime = Number(syncedCurrentTime || 0);
          const currentPlayerTime = player.getCurrentTime?.() || 0;
          if (targetTime > 0 && Math.abs(currentPlayerTime - targetTime) > 2 && typeof player.seekTo === 'function') {
            player.seekTo(targetTime, true);
          }
          player.playVideo();
        } else {
          player.pauseVideo();
        }
      } catch (error) {
        console.error('Player control error:', error);
      }
    }
  }, [isPlaying, isPlayerReady, player, canUseAudioPlayer, isReadyPlayer, syncedCurrentTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(announcementTimerRef.current);
      clearFadeIntervals();
      stopHostPlayer();
    };
  }, [clearFadeIntervals, stopHostPlayer]);

  const needsAudioActivation = Boolean(
    isAudioDevice
    && !effectiveAudioReady
    && !audioActivated
  );
  const renderActivationButton = (label = 'Tap to activate audio') => (
    <button
      type="button"
      onClick={handleActivateAudio}
      className="inline-flex items-center justify-center rounded-full bg-[#C9A84C] px-7 py-4 text-base font-black text-[#0A0A0A] shadow-xl shadow-black/30 transition hover:bg-[#F0C040]"
    >
      {label}
    </button>
  );

  if (!currentSong) {
    return (
      <div className="card">
        <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-[#C9A84C22] bg-[#0A0A0A]/60 px-6 py-10 text-center">
          <div className="brand-mark mb-4">
            <span className="text-xl leading-none">♛</span>
          </div>
          <h3 className="text-lg font-bold text-white">Nothing playing yet</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-400">Add a request or start the default playlist when you are ready.</p>
          {needsAudioActivation && (
            <div className="mt-6">
              {renderActivationButton()}
              <p className="mt-3 text-xs text-[#888880]">This unlocks browser audio for this device.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const duration = knownDuration || currentSong.duration || 0;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (elapsedTime / duration) * 100)) : 0;
  const hasPlayableTracks = Boolean(currentSong || playlist?.songs?.length || playlist?.defaultSongs?.length);
  const pendingQueue = playlist?.songs?.filter((song) => !song.playedAt && song._id !== currentSong?._id) || [];
  const defaultSongs = playlist?.defaultSongs || [];
  const currentDefaultIndex = defaultSongs.findIndex((song) => song._id === currentSong?._id);
  const nextDefaultSong = defaultSongs.length
    ? defaultSongs[(currentDefaultIndex >= 0 ? currentDefaultIndex + 1 : playlist?.defaultIndex || 0) % defaultSongs.length]
    : null;
  const nextSong = currentSource === 'queue'
    ? (pendingQueue[0] || nextDefaultSong)
    : (pendingQueue[0] || nextDefaultSong);

  const handlePlayPause = () => {
    if (!socket || !isHost) return;

    if (isPlaying) {
      socket.emit('pause', { currentTime: elapsedTime });
      return;
    }

    socket.emit('play', {
      currentTime: elapsedTime,
      songId: currentSong?._id,
      source: currentSource
    });
  };

  const handleNext = () => {
    if (!socket || !isHost) return;
    socket.emit('next-song');
  };

  const handleVolumeChange = (volume) => {
    if (!socket || !isHost) return;
    socket.emit('set-volume', { volume });
  };

  const adjustVolume = (delta) => {
    handleVolumeChange(Math.max(0, Math.min(100, roomVolume + delta)));
  };

  const openFullscreen = async () => {
    setIsFullscreen(true);

    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // The overlay still provides the full-screen player experience if the browser denies fullscreen.
    }
  };

  const closeFullscreen = async () => {
    setIsFullscreen(false);

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      }
    } catch {
      // Ignore browser fullscreen exit failures.
    }
  };

  const renderHostControls = (variant = 'card') => {
    if (!isHost) return null;

    const isFullscreenControls = variant === 'fullscreen';

    return (
      <div className={isFullscreenControls ? "mt-0 min-w-0 max-w-full sm:mt-8" : "mt-5"}>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handlePlayPause}
            disabled={!hasPlayableTracks}
            className={`${isFullscreenControls ? 'h-14 w-14 text-xl sm:h-16 sm:w-16 sm:text-2xl' : 'h-12 w-12 text-lg'} inline-flex items-center justify-center rounded-full bg-[#C9A84C] font-black text-[#0A0A0A] shadow-lg shadow-black/30 transition hover:bg-[#F0C040] disabled:cursor-not-allowed disabled:opacity-40`}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <span aria-hidden="true">
              {isPlaying ? '⏸' : '▶'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!playlist?.songs?.length && !playlist?.defaultSongs?.length}
            className={`${isFullscreenControls ? 'h-14 w-14 text-xl sm:h-16 sm:w-16 sm:text-2xl' : 'h-12 w-12 text-lg'} inline-flex items-center justify-center rounded-full border border-white/10 bg-white/10 font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40`}
            title="Next"
            aria-label="Next"
          >
            <span aria-hidden="true">⏭</span>
          </button>
        </div>

        <div className={`${isFullscreenControls ? 'mt-4 max-w-full px-2 py-2.5 sm:mt-5 sm:max-w-xl sm:px-4 sm:py-3' : 'mt-4 max-w-sm px-3 py-2'} mx-auto flex w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-[#C9A84C22] bg-[#0A0A0A]/55 sm:gap-3`}>
          <button
            type="button"
            onClick={() => adjustVolume(-10)}
            disabled={roomVolume <= 0}
            className={`${isFullscreenControls ? 'h-9 w-9 text-base sm:h-11 sm:w-11' : 'h-9 w-9 text-sm'} inline-flex flex-shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40`}
            title="Volume down"
            aria-label="Volume down"
          >
            <span aria-hidden="true">−</span>
          </button>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={roomVolume}
            onChange={(event) => handleVolumeChange(Number(event.target.value))}
            className="min-w-0 flex-1 accent-[#C9A84C]"
            aria-label="Audio volume"
          />
          <button
            type="button"
            onClick={() => adjustVolume(10)}
            disabled={roomVolume >= 100}
            className={`${isFullscreenControls ? 'h-9 w-9 text-base sm:h-11 sm:w-11' : 'h-9 w-9 text-sm'} inline-flex flex-shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40`}
            title="Volume up"
            aria-label="Volume up"
          >
            <span aria-hidden="true">+</span>
          </button>
          <span className="w-9 flex-shrink-0 text-right font-mono text-[11px] text-slate-300 sm:w-11 sm:text-xs">
            {roomVolume}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="card relative overflow-hidden p-0">
        <div className="bg-black/45 p-5 text-white">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#C9A84C]">Now playing</p>
              <h2 className="mt-1 text-xl font-black">Room audio</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openFullscreen}
                className="badge border-[#C9A84C22] bg-[#C9A84C0F] text-slate-200 transition hover:border-[#C9A84C66] hover:bg-[#C9A84C18]"
                title="Full screen"
                aria-label="Open full screen player"
              >
                <span aria-hidden="true">⛶</span>
              </button>
              <span className={isAudioDevice ? "badge border-[#C9A84C55] bg-[#C9A84C14] text-[#F0C040]" : "badge border-[#88888055] bg-[#88888018] text-[#D0D0C8]"}>
                {isAudioDevice ? `Audio device ${isPlayerReady ? "ready" : "loading"}` : "Listening"}
              </span>
              {isHost && (
                <span className="badge border-emerald-300/30 bg-emerald-400/10 text-emerald-200">
                  Host
                </span>
              )}
              {currentSource && (
                <span className="badge border-white/10 bg-white/10 text-slate-200">
                  {currentSource === 'default' ? 'Default' : 'Request'}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
            {visiblePlayer && canUseAudioPlayer ? (
              <div
                ref={visiblePlayerHostRef}
                className="aspect-video w-full overflow-hidden rounded-lg border border-[#C9A84C22] bg-black shadow-lg shadow-black/20 md:min-h-[180px]"
              />
            ) : (
              <img
                src={currentSong.thumbnail}
                alt={currentSong.title}
                className="aspect-video w-full rounded-lg object-cover shadow-lg shadow-black/20"
              />
            )}
            
            <div className="min-w-0 self-center">
              <h3 className="line-clamp-2 text-2xl font-black leading-tight text-white md:text-3xl">
                {currentSong.title}
              </h3>
              
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                <span className="rounded-full bg-white/10 px-3 py-1">
                  {currentSource === 'default' ? 'Default playlist' : `Added by ${currentSong.addedBy}`}
                </span>
                <span className={isPlaying ? "rounded-full bg-[#C9A84C22] px-3 py-1 text-[#F0C040]" : "rounded-full bg-[#88888022] px-3 py-1 text-[#D0D0C8]"}>
                  {isPlaying ? "Playing" : "Paused"}
                </span>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between font-mono text-xs text-slate-400">
                  <span>{formatTime(elapsedTime)}</span>
                  <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#C9A84C] transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {isHost && (
                renderHostControls()
              )}
            </div>
          </div>
        </div>

        {currentSource === 'queue' && currentSong.message && (
          <div className="border-b border-[#C9A84C22] bg-[#0A0A0A]/45 p-5">
            <p className="eyebrow">Message</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">"{currentSong.message}"</p>
          </div>
        )}

        {/* Status indicators */}
        {!isAudioDevice && isPlaying && (
          <div className="m-5 rounded-lg border border-[#C9A84C33] bg-[#C9A84C11] p-4">
            <p className="font-semibold text-[#F0C040]">Music is playing on the assigned audio device</p>
            <p className="mt-1 text-sm text-[#D0D0C8]">You are synced with the room playlist.</p>
          </div>
        )}

        {!isAudioDevice && !isPlaying && (
          <div className="m-5 rounded-lg border border-[#88888033] bg-[#88888011] p-4">
            <p className="font-semibold text-[#D0D0C8]">Playback paused</p>
            <p className="mt-1 text-sm text-[#888880]">Waiting for the host to resume.</p>
          </div>
        )}

        {isAudioDevice && !isPlayerReady && (
          <div className="m-5 rounded-lg border border-[#88888033] bg-[#88888011] p-4">
            <p className="font-semibold text-[#D0D0C8]">Initializing audio player</p>
            <p className="mt-1 text-sm text-[#888880]">The host player is preparing the next track.</p>
          </div>
        )}

        {isAudioDevice && isPlayerReady && (
          <div className="m-5 rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="font-semibold text-white">Audio player ready</p>
            <p className="mt-1 text-sm text-slate-400">This device is playing room audio.</p>
          </div>
        )}

        {needsAudioActivation && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0A0A0A]/90 p-6 text-center backdrop-blur-sm">
            <div className="max-w-md">
              <p className="eyebrow">Audio device</p>
              <h3 className="mt-2 text-2xl font-black text-white">Activate audio on this device</h3>
              <p className="mt-2 text-sm leading-6 text-[#D0D0C8]">
                Browsers require one tap before YouTube audio can play.
              </p>
              <div className="mt-6">
                {renderActivationButton()}
              </div>
            </div>
          </div>
        )}
      </div>

      {isFullscreen && (
          <div className="fixed inset-0 z-50 max-w-[100vw] overflow-hidden bg-[#0A0A0A] text-white">
          <div className="flex h-[100dvh] min-h-0 max-w-full flex-col overflow-x-hidden">
            <div className="flex max-w-full flex-shrink-0 items-center justify-between gap-3 overflow-hidden border-b border-[#C9A84C22] bg-[#0A0A0A]/95 px-4 py-2.5 backdrop-blur sm:gap-4 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <p className="eyebrow">Now playing</p>
                <p className="mt-0.5 truncate text-xs text-slate-400 sm:mt-1 sm:text-sm">
                  {currentSource === 'default' ? 'Default playlist' : 'User request'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeFullscreen}
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl text-white transition hover:bg-white/10"
                title="Exit full screen"
                aria-label="Exit full screen player"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="grid min-h-0 max-w-full flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-x-hidden px-4 py-3 sm:block sm:overflow-y-auto sm:px-6 sm:py-6 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:grid-rows-none lg:items-center lg:gap-8 lg:overflow-hidden lg:px-10">
              <div className="mx-auto w-full max-w-full sm:max-w-2xl lg:max-w-3xl">
                <img
                  src={currentSong.thumbnail}
                  alt={currentSong.title}
                  className="mx-auto aspect-video max-h-[22dvh] w-full max-w-[42dvh] rounded-lg object-cover shadow-2xl shadow-black/40 sm:max-h-none sm:max-w-none"
                />
              </div>

              <div className="mx-auto flex min-h-0 w-full max-w-full flex-col justify-center overflow-hidden text-center sm:max-w-4xl lg:text-left">
                <div className="flex flex-wrap items-center justify-center gap-1.5 lg:justify-start">
                  <span className={isPlaying ? "rounded-full bg-[#C9A84C22] px-3 py-1 text-xs font-semibold text-[#F0C040] sm:text-sm" : "rounded-full bg-[#88888022] px-3 py-1 text-xs font-semibold text-[#D0D0C8] sm:text-sm"}>
                    {isPlaying ? "Playing" : "Paused"}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200 sm:text-sm">
                    {isAudioDevice ? "This device" : "Room sync"}
                  </span>
                </div>

                <h2 className="mx-auto mt-2 line-clamp-2 max-w-full break-words text-xl font-black leading-tight text-white sm:mt-5 sm:max-w-3xl sm:text-4xl md:text-5xl lg:mx-0 lg:text-6xl">
                  {currentSong.title}
                </h2>

                <p className="mt-1 truncate text-xs text-slate-300 sm:mt-4 sm:text-base md:text-lg">
                  {currentSource === 'default' ? 'Default playlist' : `Added by ${currentSong.addedBy}`}
                </p>

                <div className="mx-auto mt-3 w-full max-w-full sm:mt-8 sm:max-w-2xl lg:mx-0">
                  <div className="mb-2 flex items-center justify-between font-mono text-xs text-slate-300 sm:mb-3 sm:text-sm">
                    <span>{formatTime(elapsedTime)}</span>
                    <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/10 sm:h-3">
                    <div
                      className="h-full rounded-full bg-[#C9A84C] transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400 sm:mt-3 sm:text-sm">
                    Played {formatTime(elapsedTime)} of {duration > 0 ? formatTime(duration) : 'unknown length'}
                  </p>
                </div>

                {nextSong && (
                  <div className="mx-auto mt-3 flex w-full max-w-full min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2 text-left sm:mt-8 sm:max-w-2xl sm:gap-4 sm:p-3 lg:mx-0">
                    <img
                      src={nextSong.thumbnail}
                      alt={nextSong.title}
                      className="h-10 w-16 flex-shrink-0 rounded object-cover sm:h-16 sm:w-24"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#C9A84C]">Next song</p>
                      <p className="truncate text-sm font-semibold text-white sm:text-base">{nextSong.title}</p>
                      <p className="truncate text-xs text-slate-400 sm:text-sm">{nextSong.source === 'default' ? 'Default playlist' : `Added by ${nextSong.addedBy}`}</p>
                    </div>
                  </div>
                )}

                {isHost && (
                  <div className="hidden sm:block">
                    {renderHostControls('fullscreen')}
                  </div>
                )}
              </div>
            </div>

            {isHost && (
              <div className="max-w-full flex-shrink-0 overflow-hidden border-t border-[#C9A84C22] bg-[#0A0A0A]/95 px-3 py-2.5 shadow-2xl shadow-black/50 backdrop-blur sm:hidden">
                {renderHostControls('fullscreen')}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default NowPlaying;
