import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Profile } from "./profiles";
import {
  resolveChannel,
  getLatestVideos,
  getVideoById,
  setYouTubeToken,
  VideoWithDetails,
} from "./youtube";
import { ChannelInfo } from "./utils";
import { initialUrlState, useUrlSync } from "./useUrlState";
import {
  signIn,
  doSignOut,
  onAuthChange,
  loadUserConfig,
  saveUserConfig,
  UserConfig,
  refreshAccessToken,
  getAccessToken,
} from "./firebase";
import { User } from "firebase/auth";
import VideoCard from "./VideoCard";
import ChannelPills from "./ChannelPills";
import ProfileSwitcher from "./ProfileSwitcher";
import SettingsPanel from "./SettingsPanel";
import ImportWizard from "./ImportWizard";
import YouTubePlayer from "./YouTubePlayer";

function SignInScreen() {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signIn();
    } catch (err: any) {
      setError(err.message || "Sign-in failed");
      setSigningIn(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-[#1c1714] text-[#c4b5a0]">
      <div className="max-w-md w-full p-5 md:p-8 space-y-4 bg-[#252019] rounded-2xl border border-[#3a332a] mx-4 text-center">
        <h1 className="text-2xl font-bold text-[#d4c5b0]">Tubo</h1>
        <p className="text-sm text-[#8a7e6e]">
          Distraction-free YouTube. Sign in with Google to get started.
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="w-full py-2 rounded-lg bg-[#7a6a50] hover:bg-[#8a7a60] text-[#1c1714] font-medium cursor-pointer disabled:opacity-50"
        >
          {signingIn ? "Signing in..." : "Sign in with Google"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading
  const [config, setConfig] = useState<UserConfig | null>(null);
  const configRef = useRef<UserConfig | null>(null);

  // Auth listener
  useEffect(() => {
    return onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        // Ensure we have a YouTube access token
        if (!getAccessToken()) {
          try {
            await refreshAccessToken();
          } catch {
            // Re-auth failed — user will need to sign in again
            setUser(null);
            return;
          }
        } else {
          setYouTubeToken(getAccessToken());
        }
        try {
          const cfg = await loadUserConfig(u.uid);
          configRef.current = cfg;
          setConfig(cfg);
        } catch (err) {
          console.error("Failed to load config:", err);
        }
      } else {
        setYouTubeToken(null);
        configRef.current = null;
        setConfig(null);
      }
    });
  }, []);

  const updateConfig = useCallback((updater: (prev: UserConfig) => UserConfig) => {
    if (!user || !configRef.current) return;
    const next = updater(configRef.current);
    configRef.current = next;
    setConfig(next);
    saveUserConfig(user.uid, next);
  }, [user]);

  // Loading state
  if (user === undefined) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1c1714] text-[#5a5044]">
        Loading...
      </div>
    );
  }

  // Not signed in
  if (!user || !config) {
    return <SignInScreen />;
  }

  return (
    <MainApp
      user={user}
      config={config}
      updateConfig={updateConfig}
    />
  );
}

interface MainAppProps {
  user: User;
  config: UserConfig;
  updateConfig: (updater: (prev: UserConfig) => UserConfig) => void;
}

function MainApp({ user, config, updateConfig }: MainAppProps) {
  const profiles = config.profiles;
  const watchedIds = useMemo(() => new Set(config.watchedIds), [config.watchedIds]);
  const filterShorts = config.filterShorts;

  const activeProfile = useMemo(() => {
    const idx = initialUrlState.profileIndex;
    if (idx !== null && !isNaN(idx) && idx >= 0 && idx < profiles.length) {
      return profiles[idx];
    }
    return profiles[0];
  }, []); // only compute once on mount

  const [activeProfileId, setActiveProfileId] = useState(activeProfile.id);
  const currentProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) || profiles[0],
    [profiles, activeProfileId]
  );

  const channels = currentProfile.channels;

  const [channelInfos, setChannelInfos] = useState<Map<string, ChannelInfo>>(new Map());
  const [videos, setVideos] = useState<VideoWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoWithDetails | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(() => {
    if (initialUrlState.channels) {
      const valid = initialUrlState.channels.filter(c => channels.includes(c));
      if (valid.length > 0) return new Set(valid);
    }
    return new Set(channels);
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; dragging: boolean; offset: number; decided: boolean } | null>(null);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [listScrolled, setListScrolled] = useState(false);
  const [queue, setQueue] = useState<VideoWithDetails[]>([]);

  const markWatched = useCallback((videoId: string) => {
    updateConfig((prev) => {
      if (prev.watchedIds.includes(videoId)) return prev;
      const next = [videoId, ...prev.watchedIds].slice(0, 1000);
      return { ...prev, watchedIds: next };
    });
  }, [updateConfig]);

  const pageTokensRef = useRef<Record<string, string>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<(() => Promise<void>) | null>(null);
  const genRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const pendingVideoIdRef = useRef<string | null>(initialUrlState.videoId);

  // Wrap YouTube API calls with token refresh on 401
  const withRetry = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.status === 401) {
        const newToken = await refreshAccessToken();
        setYouTubeToken(newToken);
        return await fn();
      }
      throw err;
    }
  }, []);

  // Edge swipe to open drawer
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.innerWidth >= 768) return;
      const touch = e.touches[0];
      if (touch.clientX < 20) {
        dragRef.current = { startX: touch.clientX, startY: touch.clientY, dragging: false, offset: 0, decided: false };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.dragging) return;
      const touch = e.touches[0];
      const dx = touch.clientX - drag.startX;
      const dy = touch.clientY - drag.startY;
      if (!drag.decided) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dy) > Math.abs(dx)) { dragRef.current = null; return; }
        drag.decided = true;
      }
      if (dx > 10) {
        drag.dragging = true;
        setSidebarOpen(true);
      }
    };
    const onTouchEnd = () => { dragRef.current = null; };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Drawer drag-to-close
  const onDrawerTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragRef.current = { startX: touch.clientX, startY: touch.clientY, dragging: false, offset: 0, decided: false };
  }, []);

  const onDrawerTouchMove = useCallback((e: React.TouchEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const touch = e.touches[0];
    const dx = touch.clientX - drag.startX;
    const dy = touch.clientY - drag.startY;
    if (!drag.decided) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) { dragRef.current = null; setDragOffset(null); return; }
      drag.decided = true;
    }
    const offset = Math.min(0, dx);
    drag.offset = offset;
    drag.dragging = true;
    setDragOffset(offset);
  }, []);

  const onDrawerTouchEnd = useCallback(() => {
    const drag = dragRef.current;
    if (drag?.dragging) {
      const drawerWidth = drawerRef.current?.offsetWidth || 300;
      if (Math.abs(drag.offset) > drawerWidth * 0.3) {
        setSidebarOpen(false);
      }
    }
    dragRef.current = null;
    setDragOffset(null);
  }, []);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    pageTokensRef.current = {};
    const currentChannels = channels;
    try {
      const channelResults = await Promise.allSettled(
        currentChannels.map(async (handle) => {
          const ch = await withRetry(() => resolveChannel(handle));
          return ch ? { handle, ...ch } : null;
        })
      );
      const resolved = channelResults
        .filter((r) => r.status === "fulfilled" && r.value != null)
        .map((r) => (r as PromiseFulfilledResult<any>).value as ChannelInfo);

      const infoMap = new Map<string, ChannelInfo>();
      for (const ch of resolved) {
        infoMap.set(ch.handle, ch);
      }
      setChannelInfos(infoMap);

      const videoResults = await Promise.allSettled(
        resolved.map((ch) => withRetry(() => getLatestVideos(ch.uploadsPlaylistId, ch.handle)))
      );
      const allVideos: VideoWithDetails[] = [];
      const tokens: Record<string, string> = {};
      videoResults.forEach((r, i) => {
        if (r.status === "fulfilled") {
          allVideos.push(...r.value.videos);
          if (r.value.nextPageToken) {
            tokens[resolved[i].handle] = r.value.nextPageToken;
          }
        }
      });

      allVideos.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      pageTokensRef.current = tokens;
      setVideos(allVideos);

      const pendingId = pendingVideoIdRef.current;
      if (pendingId) {
        pendingVideoIdRef.current = null;
        const found = allVideos.find(v => v.videoId === pendingId);
        if (found) {
          setSelectedVideo(found);
          markWatched(found.videoId);
        } else {
          withRetry(() => getVideoById(pendingId)).then(v => {
            if (v) {
              setSelectedVideo(v);
              markWatched(v.videoId);
            }
          });
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [markWatched, channels, withRetry]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const tokens = pageTokensRef.current;
    const handles = selectedChannels.size === channels.length ? Object.keys(tokens) : [...selectedChannels].filter(h => tokens[h]);
    if (handles.length === 0) return;
    const gen = genRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const infos = handles.map(h => channelInfos.get(h)).filter(Boolean) as ChannelInfo[];
      const results = await Promise.allSettled(
        infos.map((info) => withRetry(() => getLatestVideos(info.uploadsPlaylistId, info.handle, 10, tokens[info.handle])))
      );
      if (gen !== genRef.current) return;
      const newVideos: VideoWithDetails[] = [];
      const newTokens = { ...pageTokensRef.current };
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          newVideos.push(...r.value.videos);
          if (r.value.nextPageToken) {
            newTokens[infos[i].handle] = r.value.nextPageToken;
          } else {
            delete newTokens[infos[i].handle];
          }
        }
      });
      pageTokensRef.current = newTokens;
      setVideos((prev) => {
        const seen = new Set(prev.map(v => v.videoId));
        const deduped = newVideos.filter(v => !seen.has(v.videoId));
        const combined = [...prev, ...deduped];
        combined.sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        return combined;
      });
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [selectedChannels, channelInfos, channels, withRetry]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    genRef.current++;
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreRef.current?.();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  });

  const profileIndex = useMemo(() => {
    const idx = profiles.findIndex((p) => p.id === activeProfileId);
    return idx >= 0 ? idx : 0;
  }, [profiles, activeProfileId]);

  useUrlSync(
    selectedVideo?.videoId ?? null,
    selectedChannels,
    channels,
    profileIndex,
    (parsed) => {
      if (parsed.videoId) {
        const found = videos.find(v => v.videoId === parsed.videoId);
        if (found) {
          setSelectedVideo(found);
        } else {
          withRetry(() => getVideoById(parsed.videoId!)).then(v => setSelectedVideo(v));
        }
      } else {
        setSelectedVideo(null);
      }
      const idx = parsed.profileIndex;
      if (idx !== null && !isNaN(idx) && idx >= 0 && idx < profiles.length) {
        const profile = profiles[idx];
        if (profile.id !== activeProfileId) {
          setActiveProfileId(profile.id);
          setSelectedChannels(new Set(profile.channels));
          setVideos([]);
          setChannelInfos(new Map());
        }
      } else if (activeProfileId !== profiles[0].id) {
        setActiveProfileId(profiles[0].id);
        setSelectedChannels(new Set(profiles[0].channels));
        setVideos([]);
        setChannelInfos(new Map());
      }
    },
  );

  const handleAddChannel = (handle: string) => {
    updateConfig((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === activeProfileId && !p.channels.includes(handle)
          ? { ...p, channels: [...p.channels, handle] }
          : p
      ),
    }));
    setSelectedChannels((prev) => new Set([...prev, handle]));
  };

  const handleRemoveChannel = (handle: string) => {
    updateConfig((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === activeProfileId
          ? { ...p, channels: p.channels.filter((c) => c !== handle) }
          : p
      ),
    }));
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      next.delete(handle);
      return next;
    });
    setVideos((prev) => prev.filter((v) => v.handle !== handle));
  };

  const switchProfile = (id: string) => {
    setActiveProfileId(id);
    const profile = profiles.find((p) => p.id === id) || profiles[0];
    setSelectedChannels(new Set(profile.channels));
    setVideos([]);
    setChannelInfos(new Map());
  };

  const handleAddProfile = (name: string, emoji: string) => {
    const newProfile: Profile = {
      id: crypto.randomUUID(),
      name,
      emoji,
      channels: [],
    };
    updateConfig((prev) => ({
      ...prev,
      profiles: [...prev.profiles, newProfile],
    }));
    setActiveProfileId(newProfile.id);
    setSelectedChannels(new Set());
    setVideos([]);
    setChannelInfos(new Map());
  };

  const handleDeleteProfile = (id: string) => {
    if (profiles.length <= 1) return;
    updateConfig((prev) => ({
      ...prev,
      profiles: prev.profiles.filter((p) => p.id !== id),
    }));
    if (activeProfileId === id) {
      const remaining = profiles.filter((p) => p.id !== id);
      switchProfile(remaining[0].id);
    }
  };

  const handleSignOut = async () => {
    await doSignOut();
  };

  const addToQueue = useCallback((video: VideoWithDetails) => {
    setQueue((prev) => prev.some((v) => v.videoId === video.videoId) ? prev : [...prev, video]);
  }, []);

  const removeFromQueue = useCallback((videoId: string) => {
    setQueue((prev) => prev.filter((v) => v.videoId !== videoId));
  }, []);

  const playNext = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const [next, ...rest] = prev;
      markWatched(next.videoId);
      setSelectedVideo(next);
      setSidebarOpen(false);
      return rest;
    });
  }, [markWatched]);

  const handleImport = (assignments: Map<string, string>) => {
    updateConfig((prev) => {
      const updated = prev.profiles.map((p) => {
        const newHandles = [...assignments.entries()]
          .filter(([, pid]) => pid === p.id)
          .map(([handle]) => handle)
          .filter((h) => !p.channels.includes(h));
        if (newHandles.length === 0) return p;
        return { ...p, channels: [...p.channels, ...newHandles] };
      });
      return { ...prev, profiles: updated };
    });
    setImportOpen(false);
  };

  const handlePip = useCallback(async () => {
    if (!("documentPictureInPicture" in window) || !selectedVideo) return;
    const pip = await (window as any).documentPictureInPicture.requestWindow({ width: 640, height: 360 });
    pip.document.head.innerHTML = `<style>body{margin:0;background:#141110;display:flex;align-items:center;justify-content:center;height:100vh}iframe{width:100%;height:100%;border:none}</style>`;
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${selectedVideo.videoId}?autoplay=1&rel=0`;
    iframe.allow = "autoplay; encrypted-media";
    iframe.allowFullscreen = true;
    pip.document.body.appendChild(iframe);
  }, [selectedVideo]);

  const hasPip = "documentPictureInPicture" in window;
  const allSelected = selectedChannels.size === channels.length;
  const filteredVideos = (allSelected
    ? videos
    : videos.filter((v) => selectedChannels.has(v.handle))
  ).filter((v) => !filterShorts || v.duration === 0 || v.duration > 180);

  return (
    <div className="flex h-dvh bg-[#1c1714] text-[#c4b5a0]">
      {/* Backdrop */}
      {selectedVideo && (
        <div
          className={`md:hidden fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar drawer */}
      <div
        ref={drawerRef}
        onTouchStart={selectedVideo ? onDrawerTouchStart : undefined}
        onTouchMove={selectedVideo ? onDrawerTouchMove : undefined}
        onTouchEnd={selectedVideo ? onDrawerTouchEnd : undefined}
        className={`${
          selectedVideo
            ? `fixed z-50 inset-y-0 left-0 w-3/4 md:relative md:w-[420px] md:min-w-[420px] ${dragOffset == null ? "transition-transform duration-300" : ""} ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`
            : "w-full md:w-[420px]"
        } h-full flex flex-col bg-[#1c1714] border-r border-[#302a22] p-3`}
        style={selectedVideo && dragOffset != null ? { transform: `translateX(${dragOffset}px)` } : undefined}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-[#d4c5b0]"><button onClick={() => { setSelectedVideo(null); setSidebarOpen(false); }} className="cursor-pointer hover:text-[#e8d9c4]">Tubo</button></h1>
            <ProfileSwitcher
              profiles={profiles}
              activeProfile={currentProfile}
              onSwitch={switchProfile}
              onAdd={handleAddProfile}
              onDelete={handleDeleteProfile}
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 text-base text-[#5a5044] hover:text-[#8a7e6e] cursor-pointer"
              title="Settings"
            >
              &#9881;
            </button>
            <button
              onClick={loadVideos}
              disabled={loading}
              className="p-2 text-xs text-[#5a5044] hover:text-[#8a7e6e] cursor-pointer disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <ChannelPills
          channels={channels}
          channelInfos={channelInfos}
          selectedChannels={selectedChannels}
          onToggle={(handle) => {
            setSelectedChannels((prev) => {
              const next = new Set(prev);
              if (next.has(handle)) {
                next.delete(handle);
              } else {
                next.add(handle);
              }
              return next;
            });
          }}
          onSelectAll={() => setSelectedChannels(new Set(channels))}
          onOnly={(handle) => setSelectedChannels(new Set([handle]))}
        />

        <div className="relative flex-1 overflow-y-auto space-y-1 min-h-0" onScroll={(e) => setListScrolled(e.currentTarget.scrollTop > 0)}>
          <div className={`sticky top-0 h-3 -mb-3 z-10 pointer-events-none bg-gradient-to-b from-[#1c1714] to-transparent transition-opacity ${listScrolled ? "opacity-100" : "opacity-0"}`} />

          {error && <p className="text-sm text-red-400 px-1">{error}</p>}

        {!loading && filteredVideos.length === 0 && !error && (
          <p className="text-sm text-[#5a5044] px-1 text-center">No videos found. <button onClick={() => setSettingsOpen(true)} className="underline hover:text-[#8a7e6e] cursor-pointer">Add some channels</button></p>
        )}

        {filteredVideos.map((v) => (
          <VideoCard
            key={v.videoId}
            video={v}
            isActive={selectedVideo?.videoId === v.videoId}
            watched={watchedIds.has(v.videoId)}
            queued={queue.some((q) => q.videoId === v.videoId)}
            onClick={() => {
              markWatched(v.videoId);
              setSelectedVideo(v);
              setSidebarOpen(false);
            }}
            onQueue={() => addToQueue(v)}
          />
        ))}


        {(allSelected ? Object.keys(pageTokensRef.current).length > 0 : [...selectedChannels].some(h => pageTokensRef.current[h])) && (
          <div ref={sentinelRef} className="py-4 text-center text-sm text-[#5a5044]">
            {loadingMore ? "Loading..." : ""}
          </div>
        )}
        </div>
      </div>

      {/* Player / Splash */}
      <div className={`flex-1 min-w-0 flex flex-col bg-[#141110] overflow-hidden ${selectedVideo ? "" : "hidden md:flex"}`}>
        {selectedVideo ? (
          <>
            <div className="flex items-center justify-between p-3 border-b border-[#302a22]">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 -ml-2 text-[#5a5044] hover:text-[#8a7e6e] text-lg cursor-pointer"
                >
                  &#9776;
                </button>
                <div className="min-w-0">
                  <p className="font-medium truncate text-[#d4c5b0]">
                    {selectedVideo.title}
                  </p>
                  <p className="text-xs text-[#8a7e6e]">
                    {selectedVideo.channelTitle}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {hasPip && (
                  <button
                    onClick={handlePip}
                    className="p-2 text-[#5a5044] hover:text-[#8a7e6e] text-sm cursor-pointer"
                    title="Picture in Picture"
                  >
                    PiP
                  </button>
                )}
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="ml-2 p-2 text-[#5a5044] hover:text-[#8a7e6e] text-xl cursor-pointer"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col p-2 md:p-4">
              <YouTubePlayer
                videoId={selectedVideo.videoId}
                onEnded={queue.length > 0 ? playNext : undefined}
              />
              {queue.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-[#5a5044] font-semibold uppercase tracking-wider">Up next ({queue.length})</p>
                  {queue.map((v, i) => (
                    <div key={v.videoId} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[#1c1714]">
                      <span className="text-xs text-[#5a5044] w-4 text-center shrink-0">{i + 1}</span>
                      <p className="text-sm text-[#c4b5a0] truncate flex-1">{v.title}</p>
                      <button
                        onClick={() => removeFromQueue(v.videoId)}
                        className="text-[#5a5044] hover:text-red-400 cursor-pointer text-sm shrink-0"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center select-none">
            <p className="text-8xl mb-6 opacity-20">&#9655;</p>
            <p className="text-xl font-semibold text-[#3a332a]">Pick something to watch</p>
            <p className="text-sm text-[#302a22] mt-1">{videos.length} videos from {channelInfos.size} channels</p>
          </div>
        )}
      </div>

      {settingsOpen && (
        <SettingsPanel
          channels={channels}
          channelInfos={channelInfos}
          activeProfile={currentProfile}
          filterShorts={filterShorts}
          userName={user.displayName || ""}
          userPhoto={user.photoURL || ""}
          onAdd={handleAddChannel}
          onRemove={handleRemoveChannel}
          onUpdateProfile={(updates) => {
            updateConfig((prev) => ({
              ...prev,
              profiles: prev.profiles.map((p) =>
                p.id === activeProfileId ? { ...p, ...updates } : p
              ),
            }));
          }}
          onToggleFilterShorts={() => {
            updateConfig((prev) => ({ ...prev, filterShorts: !prev.filterShorts }));
          }}
          onSignOut={handleSignOut}
          onImportSubscriptions={() => { setSettingsOpen(false); setImportOpen(true); }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {importOpen && (
        <ImportWizard
          profiles={profiles}
          existingChannels={new Set(profiles.flatMap((p) => p.channels))}
          onImport={handleImport}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
