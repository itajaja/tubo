import { useState, useEffect, useCallback, useRef } from "react";
import { getChannels, addChannel, removeChannel } from "./channels";
import {
  getApiKey,
  setApiKey,
  resolveChannel,
  getLatestVideos,
  Video,
} from "./youtube";

interface ChannelInfo {
  handle: string;
  title: string;
  uploadsPlaylistId: string;
}

function ApiKeyPrompt({ onSave }: { onSave: () => void }) {
  const [key, setKey] = useState("");
  return (
    <div className="flex items-center justify-center h-screen bg-[#1c1714] text-[#c4b5a0]">
      <div className="max-w-md w-full p-8 space-y-4 bg-[#252019] rounded-2xl border border-[#3a332a]">
        <h1 className="text-2xl font-bold text-[#d4c5b0]">Tubo</h1>
        <p className="text-sm text-[#8a7e6e]">
          Enter your YouTube Data API v3 key. You can get one for free from the{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
            className="underline text-[#a08860]"
          >
            Google Cloud Console
          </a>
          . Enable the &quot;YouTube Data API v3&quot; for your project.
        </p>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="AIza..."
          className="w-full px-3 py-2 rounded-lg bg-[#0e0c0a] border border-[#3a332a] focus:outline-none focus:border-[#a08860] text-[#c4b5a0] placeholder-[#5a5044]"
        />
        <button
          onClick={() => {
            if (key.trim()) {
              setApiKey(key.trim());
              onSave();
            }
          }}
          className="w-full py-2 rounded-lg bg-[#7a6a50] hover:bg-[#8a7a60] text-[#1c1714] font-medium cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  const units: [number, string][] = [
    [31536000, "y"],
    [2592000, "mo"],
    [604800, "w"],
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
  ];
  for (const [secs, label] of units) {
    const n = Math.floor(seconds / secs);
    if (n >= 1) return `${n}${label} ago`;
  }
  return "just now";
}

function VideoCard({
  video,
  onClick,
  isActive,
  watched,
}: {
  video: Video;
  onClick: () => void;
  isActive: boolean;
  watched: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex gap-3 p-2 rounded-xl text-left w-full cursor-pointer transition-colors ${
        isActive ? "bg-[#302a22]" : "hover:bg-[#252019]"
      }`}
    >
      <div className="relative w-40 min-w-40">
        <img
          src={video.thumbnail}
          alt=""
          className={`w-full aspect-video object-cover rounded-lg${watched ? " opacity-60" : ""}`}
        />
        {watched && (
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#1c1714]/80 text-[#8a7e6e]">
            watched
          </span>
        )}
      </div>
      <div className="min-w-0 flex flex-col justify-center">
        <p className="text-sm font-medium text-[#d4c5b0] line-clamp-2">
          {video.title}
        </p>
        <p className="text-xs text-[#8a7e6e] mt-1">{video.channelTitle}</p>
        <p className="text-xs text-[#5a5044]">{timeAgo(video.publishedAt)}</p>
      </div>
    </button>
  );
}

function ChannelPills({
  channels,
  channelInfos,
  selectedChannel,
  onSelect,
  onAdd,
  onRemove,
}: {
  channels: string[];
  channelInfos: Map<string, ChannelInfo>;
  selectedChannel: string | null;
  onSelect: (handle: string | null) => void;
  onAdd: (handle: string) => void;
  onRemove: (handle: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");

  return (
    <div className="flex flex-wrap gap-2 px-1 mb-3">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
          selectedChannel === null
            ? "bg-[#7a6a50] text-[#1c1714]"
            : "bg-[#252019] text-[#8a7e6e] hover:bg-[#302a22]"
        }`}
      >
        All
      </button>
      {channels.map((handle) => {
        const info = channelInfos.get(handle);
        const label = info?.title || handle;
        const isSelected = selectedChannel === handle;
        return (
          <div key={handle} className="group relative">
            <button
              onClick={() => onSelect(isSelected ? null : handle)}
              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                isSelected
                  ? "bg-[#7a6a50] text-[#1c1714]"
                  : "bg-[#252019] text-[#8a7e6e] hover:bg-[#302a22]"
              }`}
            >
              {label}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(handle);
              }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#3a332a] text-[#8a7e6e] text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-500 hover:text-white"
            >
              &times;
            </button>
          </div>
        );
      })}
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) {
              onAdd(input.trim());
              setInput("");
              setAdding(false);
            }
          }}
          className="flex items-center gap-1"
        >
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={() => {
              if (!input.trim()) setAdding(false);
            }}
            placeholder="@handle"
            className="px-2 py-1 rounded-full text-xs bg-[#0e0c0a] border border-[#3a332a] focus:outline-none focus:border-[#a08860] text-[#c4b5a0] placeholder-[#5a5044] w-28"
          />
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="px-3 py-1 rounded-full text-xs font-medium cursor-pointer bg-[#252019] border border-dashed border-[#3a332a] text-[#5a5044] hover:border-[#5a5044] hover:text-[#8a7e6e] transition-colors"
        >
          +
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [hasKey, setHasKey] = useState(!!getApiKey());
  const [channels, setChannels] = useState<string[]>(getChannels);
  const [channelInfos, setChannelInfos] = useState<Map<string, ChannelInfo>>(
    new Map()
  );
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("tubo_watched");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

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

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    pageTokensRef.current = {};
    const currentChannels = getChannels();
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
      const allVideos: Video[] = [];
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const tokens = pageTokensRef.current;
    const handles = selectedChannel ? [selectedChannel].filter(h => tokens[h]) : Object.keys(tokens);
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
      const newVideos: Video[] = [];
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
  }, [selectedChannel, channelInfos]);

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

  const handleAddChannel = (handle: string) => {
    const updated = addChannel(handle);
    setChannels(updated);
    loadVideos();
  };

  const handleRemoveChannel = (handle: string) => {
    const updated = removeChannel(handle);
    setChannels(updated);
    if (selectedChannel === handle) setSelectedChannel(null);
    setVideos((prev) => prev.filter((v) => v.handle !== handle));
  };

  if (!hasKey) {
    return <ApiKeyPrompt onSave={() => setHasKey(true)} />;
  }

  const filteredVideos = selectedChannel
    ? videos.filter((v) => v.handle === selectedChannel)
    : videos;

  return (
    <div className="flex h-screen bg-[#1c1714] text-[#c4b5a0]">
      {/* Video list */}
      <div
        className={`${
          selectedVideo
            ? "w-[420px] min-w-[420px]"
            : "w-[420px]"
        } h-full overflow-y-auto border-r border-[#302a22] p-3 space-y-1`}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <h1 className="text-lg font-bold text-[#d4c5b0]">Tubo</h1>
          <button
            onClick={loadVideos}
            disabled={loading}
            className="text-xs text-[#5a5044] hover:text-[#8a7e6e] cursor-pointer disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <ChannelPills
          channels={channels}
          channelInfos={channelInfos}
          selectedChannel={selectedChannel}
          onSelect={setSelectedChannel}
          onAdd={handleAddChannel}
          onRemove={handleRemoveChannel}
        />

        {error && <p className="text-sm text-red-400 px-1">{error}</p>}

        {!loading && filteredVideos.length === 0 && !error && (
          <p className="text-sm text-[#5a5044] px-1">No videos found.</p>
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
            }}
          />
        ))}

        {(selectedChannel ? !!pageTokensRef.current[selectedChannel] : Object.keys(pageTokensRef.current).length > 0) && (
          <div ref={sentinelRef} className="py-4 text-center text-sm text-[#5a5044]">
            {loadingMore ? "Loading..." : ""}
          </div>
        )}
      </div>

      {/* Player / Splash */}
      <div className="flex-1 flex flex-col bg-[#141110]">
        {selectedVideo ? (
          <>
            <div className="flex items-center justify-between p-3 border-b border-[#302a22]">
              <div className="min-w-0">
                <p className="font-medium truncate text-[#d4c5b0]">
                  {selectedVideo.title}
                </p>
                <p className="text-xs text-[#8a7e6e]">
                  {selectedVideo.channelTitle}
                </p>
              </div>
              <button
                onClick={() => setSelectedVideo(null)}
                className="ml-4 text-[#5a5044] hover:text-[#8a7e6e] text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <iframe
                key={selectedVideo.videoId}
                src={`https://www.youtube-nocookie.com/embed/${selectedVideo.videoId}?autoplay=1&rel=0`}
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="w-full max-w-5xl aspect-video rounded-xl"
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
    </div>
  );
}
