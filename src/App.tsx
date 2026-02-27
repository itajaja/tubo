import { useState, useEffect, useCallback, useRef } from "react";
import { getProfiles, addChannelToProfile, removeChannelFromProfile, addProfile, deleteProfile, updateProfile, Profile } from "./profiles";
import {
  getApiKey,
  resolveChannel,
  getLatestVideos,
  getVideoById,
  VideoWithDetails,
} from "./youtube";
import { parseUrl, buildUrl, ChannelInfo } from "./utils";
import ApiKeyPrompt from "./ApiKeyPrompt";
import VideoCard from "./VideoCard";
import ChannelPills from "./ChannelPills";
import ProfileSwitcher from "./ProfileSwitcher";
import SettingsPanel from "./SettingsPanel";

const initialUrl = parseUrl();

function getInitialProfile(): { profiles: Profile[]; active: Profile } {
  const profiles = getProfiles();
  const idx = initialUrl.profileIndex;
  if (idx !== null && !isNaN(idx) && idx >= 0 && idx < profiles.length) {
    return { profiles, active: profiles[idx] };
  }
  return { profiles, active: profiles[0] };
}

const initialProfile = getInitialProfile();

export default function App() {
  const [hasKey, setHasKey] = useState(!!getApiKey());
  const [profiles, setProfiles] = useState<Profile[]>(initialProfile.profiles);
  const [activeProfile, setActiveProfile] = useState<Profile>(initialProfile.active);
  const [channels, setChannels] = useState<string[]>(() => activeProfile.channels);
  const [channelInfos, setChannelInfos] = useState<Map<string, ChannelInfo>>(
    new Map()
  );
  const [videos, setVideos] = useState<VideoWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoWithDetails | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(() => {
    if (initialUrl.channels) {
      const valid = initialUrl.channels.filter(c => activeProfile.channels.includes(c));
      if (valid.length > 0) return new Set(valid);
    }
    return new Set(activeProfile.channels);
  });
  const [watchedIds, setWatchedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("tubo_watched");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterShorts, setFilterShorts] = useState(() => localStorage.getItem("tubo_filter_shorts") !== "false");
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; dragging: boolean; offset: number; decided: boolean } | null>(null);
  const [dragOffset, setDragOffset] = useState<number | null>(null);

  // Edge swipe to open drawer
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.innerWidth >= 768) return; // md breakpoint
      const touch = e.touches[0];
      if (touch.clientX < 20) {
        dragRef.current = { startX: touch.clientX, startY: touch.clientY, dragging: false, offset: 0, decided: false };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.dragging) return; // handled by drawer's own handler once open
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

  // Drawer drag-to-close gesture handlers
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

  const markWatched = useCallback((videoId: string) => {
    setWatchedIds((prev) => {
      const next = new Set(prev);
      next.add(videoId);
      localStorage.setItem("tubo_watched", JSON.stringify([...next]));
      return next;
    });
  }, []);
  const pageTokensRef = useRef<Record<string, string>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<(() => Promise<void>) | null>(null);
  const genRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const pendingVideoIdRef = useRef<string | null>(initialUrl.videoId);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    pageTokensRef.current = {};
    const currentChannels = channels;
    try {
      const channelResults = await Promise.allSettled(
        currentChannels.map(async (handle) => {
          const ch = await resolveChannel(handle);
          return ch ? { handle, ...ch } : null;
        })
      );
      const resolved = channelResults
        .filter(
          (r) => r.status === "fulfilled" && r.value != null
        )
        .map((r) => (r as PromiseFulfilledResult<any>).value as ChannelInfo);

      const infoMap = new Map<string, ChannelInfo>();
      for (const ch of resolved) {
        infoMap.set(ch.handle, ch);
      }
      setChannelInfos(infoMap);

      const videoResults = await Promise.allSettled(
        resolved.map((ch) => getLatestVideos(ch.uploadsPlaylistId, ch.handle))
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
          new Date(b.publishedAt).getTime() -
          new Date(a.publishedAt).getTime()
      );
      pageTokensRef.current = tokens;
      setVideos(allVideos);

      // Handle pending video permalink
      const pendingId = pendingVideoIdRef.current;
      if (pendingId) {
        pendingVideoIdRef.current = null;
        const found = allVideos.find(v => v.videoId === pendingId);
        if (found) {
          setSelectedVideo(found);
          markWatched(found.videoId);
        } else {
          // Video not in channel list — fetch it directly
          getVideoById(pendingId).then(v => {
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
  }, [markWatched, channels]);

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
        infos.map((info) => getLatestVideos(info.uploadsPlaylistId, info.handle, 10, tokens[info.handle]))
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
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime()
        );
        return combined;
      });
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [selectedChannels, channelInfos]);

  useEffect(() => {
    if (hasKey) loadVideos();
  }, [hasKey, loadVideos]);

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

  // Sync URL with selected video and channel filter
  useEffect(() => {
    const profileIdx = profiles.findIndex((p) => p.id === activeProfile.id);
    const url = buildUrl(selectedVideo?.videoId ?? null, selectedChannels, channels, profileIdx >= 0 ? profileIdx : 0);
    if (url !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", url);
    }
  }, [selectedVideo, selectedChannels, channels, activeProfile, profiles]);

  const handleAddChannel = (handle: string) => {
    const updatedProfiles = addChannelToProfile(activeProfile.id, handle);
    const updatedProfile = updatedProfiles.find((p) => p.id === activeProfile.id) || updatedProfiles[0];
    setProfiles(updatedProfiles);
    setActiveProfile(updatedProfile);
    setChannels(updatedProfile.channels);
    setSelectedChannels((prev) => new Set([...prev, handle]));
    loadVideos();
  };

  const handleRemoveChannel = (handle: string) => {
    const updatedProfiles = removeChannelFromProfile(activeProfile.id, handle);
    const updatedProfile = updatedProfiles.find((p) => p.id === activeProfile.id) || updatedProfiles[0];
    setProfiles(updatedProfiles);
    setActiveProfile(updatedProfile);
    setChannels(updatedProfile.channels);
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      next.delete(handle);
      return next;
    });
    setVideos((prev) => prev.filter((v) => v.handle !== handle));
  };

  const switchProfile = (id: string) => {
    const profile = profiles.find((p) => p.id === id) || profiles[0];
    setActiveProfile(profile);
    setChannels(profile.channels);
    setSelectedChannels(new Set(profile.channels));
    setVideos([]);
    setChannelInfos(new Map());
    setSelectedVideo(null);
  };

  const handleAddProfile = (name: string, emoji: string) => {
    const updated = addProfile(name, emoji);
    setProfiles(updated);
    const newProfile = updated[updated.length - 1];
    switchProfile(newProfile.id);
  };

  const handleDeleteProfile = (id: string) => {
    const updated = deleteProfile(id);
    setProfiles(updated);
    if (activeProfile.id === id) {
      switchProfile(updated[0].id);
    }
  };

  if (!hasKey) {
    return <ApiKeyPrompt onSave={() => setHasKey(true)} />;
  }

  const allSelected = selectedChannels.size === channels.length;
  const filteredVideos = (allSelected
    ? videos
    : videos.filter((v) => selectedChannels.has(v.handle))
  ).filter((v) => !filterShorts || v.duration === 0 || v.duration > 180);

  return (
    <div className="flex h-screen bg-[#1c1714] text-[#c4b5a0]">
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
              activeProfile={activeProfile}
              onSwitch={switchProfile}
              onAdd={handleAddProfile}
              onDelete={handleDeleteProfile}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-xs text-[#5a5044] hover:text-[#8a7e6e] cursor-pointer"
              title="Settings"
            >
              &#9881;
            </button>
            <button
              onClick={loadVideos}
              disabled={loading}
              className="text-xs text-[#5a5044] hover:text-[#8a7e6e] cursor-pointer disabled:opacity-50"
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

        <div className="relative flex-1 overflow-y-auto space-y-1 min-h-0">
          <div className="sticky top-0 h-3 -mb-3 z-10 pointer-events-none bg-gradient-to-b from-[#1c1714] to-transparent" />

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
            onClick={() => {
              markWatched(v.videoId);
              setSelectedVideo(v);
              setSidebarOpen(false);
            }}
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
      <div className={`flex-1 min-w-0 flex flex-col bg-[#141110] ${selectedVideo ? "" : "hidden md:flex"}`}>
        {selectedVideo ? (
          <>
            <div className="flex items-center justify-between p-3 border-b border-[#302a22]">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden text-[#5a5044] hover:text-[#8a7e6e] text-lg cursor-pointer"
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
              <button
                onClick={() => setSelectedVideo(null)}
                className="ml-4 text-[#5a5044] hover:text-[#8a7e6e] text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 p-2 md:p-4 min-h-0">
              <iframe
                key={selectedVideo.videoId}
                src={`https://www.youtube-nocookie.com/embed/${selectedVideo.videoId}?autoplay=1&rel=0`}
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="w-full h-full rounded-xl"
              />
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
          activeProfile={activeProfile}
          filterShorts={filterShorts}
          onAdd={handleAddChannel}
          onRemove={handleRemoveChannel}
          onUpdateProfile={(updates) => {
            const updated = updateProfile(activeProfile.id, updates);
            setProfiles(updated);
            setActiveProfile(updated.find((p) => p.id === activeProfile.id) || updated[0]);
          }}
          onToggleFilterShorts={() => {
            setFilterShorts((prev) => {
              const next = !prev;
              localStorage.setItem("tubo_filter_shorts", String(next));
              return next;
            });
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
