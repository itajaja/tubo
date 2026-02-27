import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { getChannels, addChannel, removeChannel, getProfiles, getActiveProfile, setActiveProfileId, addProfile, deleteProfile, updateProfile, Profile } from "./profiles";
import {
  getApiKey,
  setApiKey,
  resolveChannel,
  getLatestVideos,
  getVideoById,
  searchChannels,
  Video,
  ChannelSearchResult,
} from "./youtube";

const BASE_PATH = window.location.pathname.startsWith("/tubo") ? "/tubo/" : "/";

function parseUrl() {
  const path = window.location.pathname.slice(BASE_PATH.length);
  const videoId = path && path !== "/" ? path : null;
  const params = new URLSearchParams(window.location.search);
  const channelsParam = params.get("channels");
  const channels = channelsParam ? channelsParam.split(",").filter(Boolean) : null;
  return { videoId, channels };
}

function buildUrl(videoId: string | null, selectedChannels: Set<string>, allChannels: string[]) {
  let path = BASE_PATH;
  if (videoId) path += videoId;
  const isAll = selectedChannels.size === allChannels.length || selectedChannels.size === 0;
  const search = isAll ? "" : "?channels=" + [...selectedChannels].join(",");
  return path + search;
}

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
  selectedChannels,
  onToggle,
  onSelectAll,
  onOnly,
}: {
  channels: string[];
  channelInfos: Map<string, ChannelInfo>;
  selectedChannels: Set<string>;
  onToggle: (handle: string) => void;
  onSelectAll: () => void;
  onOnly: (handle: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 px-1 mb-3">
      <button
        onClick={() => onSelectAll()}
        className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
          selectedChannels.size === channels.length
            ? "bg-[#7a6a50] text-[#1c1714]"
            : "bg-[#252019] text-[#8a7e6e] hover:bg-[#302a22]"
        }`}
      >
        All
      </button>
      {channels.map((handle) => {
        const info = channelInfos.get(handle);
        const label = info?.title || handle;
        const isSelected = selectedChannels.has(handle);
        return (
          <div key={handle} className="group relative">
            <button
              onClick={() => onToggle(handle)}
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
                onOnly(handle);
              }}
              className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-[#3a332a] text-[#8a7e6e] text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-[#7a6a50] hover:text-[#1c1714]"
            >
              only
            </button>
          </div>
        );
      })}
    </div>
  );
}

function EmojiPickerButton({
  value,
  onChange,
}: {
  value: string;
  onChange: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        pickerRef.current && !pickerRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-10 h-9 rounded-lg bg-[#0e0c0a] border border-[#3a332a] text-center text-sm cursor-pointer hover:border-[#a08860] transition-colors"
      >
        {value || "\u{1F4C1}"}
      </button>
      {open && pos && createPortal(
        <div ref={pickerRef} data-emoji-picker="true" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}>
          <Picker
            data={data}
            onEmojiSelect={(emoji: any) => { onChange(emoji.native); setOpen(false); }}
            theme="dark"
            previewPosition="none"
            skinTonePosition="none"
            perLine={8}
          />
        </div>,
        document.body
      )}
    </>
  );
}

function ProfileSwitcher({
  profiles,
  activeProfile,
  onSwitch,
  onAdd,
  onDelete,
}: {
  profiles: Profile[];
  activeProfile: Profile;
  onSwitch: (id: string) => void;
  onAdd: (name: string, emoji: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const path = e.composedPath();
      const inSelf = path.some((el) => el === ref.current);
      const inPicker = path.some((el) => el instanceof HTMLElement && el.dataset.emojiPicker);
      if (!inSelf && !inPicker) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm hover:bg-[#252019] cursor-pointer transition-colors"
      >
        <span>{activeProfile.emoji}</span>
        <span className="text-[#5a5044] text-xs">&#9662;</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded-lg bg-[#252019] border border-[#3a332a] shadow-lg overflow-hidden">
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                p.id === activeProfile.id ? "bg-[#302a22]" : "hover:bg-[#302a22]"
              }`}
              onClick={() => { onSwitch(p.id); setOpen(false); setCreating(false); }}
            >
              <span className="text-sm text-[#c4b5a0]">{p.emoji} {p.name}</span>
              <div className="flex items-center gap-2">
                {p.id === activeProfile.id && (
                  <span className="text-xs text-[#7a6a50]">&#10003;</span>
                )}
                {profiles.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                    className="text-[#5a5044] hover:text-red-400 text-sm cursor-pointer"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="border-t border-[#3a332a]">
            {creating ? (
              <form
                className="flex items-center gap-2 px-3 py-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newName.trim()) {
                    onAdd(newName.trim(), newEmoji.trim() || "📁");
                    setNewName("");
                    setNewEmoji("");
                    setCreating(false);
                    setOpen(false);
                  }
                }}
              >
                <EmojiPickerButton value={newEmoji} onChange={setNewEmoji} />
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name"
                  autoFocus
                  className="flex-1 px-2 py-1 rounded bg-[#0e0c0a] border border-[#3a332a] text-sm text-[#c4b5a0] placeholder-[#5a5044] focus:outline-none focus:border-[#a08860]"
                />
                <button
                  type="submit"
                  className="text-[#7a6a50] hover:text-[#a08860] text-sm cursor-pointer font-medium"
                >
                  Add
                </button>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full text-left px-3 py-2 text-sm text-[#8a7e6e] hover:bg-[#302a22] cursor-pointer transition-colors"
              >
                + New profile
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPanel({
  channels,
  channelInfos,
  activeProfile,
  onAdd,
  onRemove,
  onUpdateProfile,
  onClose,
}: {
  channels: string[];
  channelInfos: Map<string, ChannelInfo>;
  activeProfile: Profile;
  onAdd: (handle: string) => void;
  onRemove: (handle: string) => void;
  onUpdateProfile: (updates: { name?: string; emoji?: string }) => void;
  onClose: () => void;
}) {
  const [newChannel, setNewChannel] = useState("");
  const [suggestions, setSuggestions] = useState<ChannelSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const currentKey = getApiKey() || "";
  const [profileName, setProfileName] = useState(activeProfile.name);
  const [profileEmoji, setProfileEmoji] = useState(activeProfile.emoji);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = newChannel.trim();
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchChannels(q);
        setSuggestions(results.filter(r => r.handle && !channels.includes(r.handle)));
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [newChannel, channels]);

  const selectSuggestion = (result: ChannelSearchResult) => {
    onAdd(result.handle);
    setNewChannel("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#252019] border border-[#3a332a] rounded-2xl w-full max-w-md mx-4 p-6 space-y-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#d4c5b0]">Settings</h2>
          <button
            onClick={onClose}
            className="text-[#5a5044] hover:text-[#8a7e6e] text-xl cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Profile section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#8a7e6e] uppercase tracking-wider">Profile</h3>
          <div className="flex items-center gap-2">
            <EmojiPickerButton
              value={profileEmoji}
              onChange={(emoji) => { setProfileEmoji(emoji); onUpdateProfile({ emoji }); }}
            />
            <input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              onBlur={() => { if (profileName.trim() && profileName !== activeProfile.name) onUpdateProfile({ name: profileName.trim() }); }}
              className="flex-1 px-3 py-2 rounded-lg bg-[#0e0c0a] border border-[#3a332a] text-sm text-[#c4b5a0] focus:outline-none focus:border-[#a08860]"
            />
          </div>
        </div>

        {/* Channels section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#8a7e6e] uppercase tracking-wider">Channels</h3>
          <div className="space-y-1">
            {channels.map((handle) => {
              const info = channelInfos.get(handle);
              const label = info?.title || handle;
              return (
                <div key={handle} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#1c1714]">
                  <span className="text-sm text-[#c4b5a0]">{label} <span className="text-[#5a5044]">@{handle}</span></span>
                  <button
                    onClick={() => onRemove(handle)}
                    className="text-[#5a5044] hover:text-red-400 cursor-pointer text-sm"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
          <div className="relative">
            <input
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              placeholder="Search channels..."
              className="w-full px-3 py-2 rounded-lg bg-[#0e0c0a] border border-[#3a332a] focus:outline-none focus:border-[#a08860] text-[#c4b5a0] placeholder-[#5a5044] text-sm"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#5a5044]">...</span>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg bg-[#1c1714] border border-[#3a332a] overflow-hidden shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectSuggestion(s)}
                    className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-[#302a22] cursor-pointer transition-colors"
                  >
                    <img src={s.thumbnail} alt="" className="w-8 h-8 rounded-full" />
                    <div className="min-w-0">
                      <p className="text-sm text-[#c4b5a0] truncate">{s.title}</p>
                      <p className="text-xs text-[#5a5044]">@{s.handle}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* API Key section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#8a7e6e] uppercase tracking-wider">API Key</h3>
          <p className="text-xs text-[#5a5044]">
            Current: {currentKey ? (showApiKey ? currentKey : currentKey.slice(0, 6) + "\u2026" + currentKey.slice(-4)) : "Not set"}
            {currentKey && (
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="ml-2 underline hover:text-[#8a7e6e] cursor-pointer"
              >
                {showApiKey ? "hide" : "show"}
              </button>
            )}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (apiKeyInput.trim()) {
                setApiKey(apiKeyInput.trim());
                setApiKeyInput("");
                onClose();
                window.location.reload();
              }
            }}
            className="flex gap-2"
          >
            <input
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="New API key..."
              className="flex-1 px-3 py-2 rounded-lg bg-[#0e0c0a] border border-[#3a332a] focus:outline-none focus:border-[#a08860] text-[#c4b5a0] placeholder-[#5a5044] text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#7a6a50] hover:bg-[#8a7a60] text-[#1c1714] font-medium cursor-pointer text-sm"
            >
              Save
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const initialUrl = parseUrl();

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
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(() => {
    if (initialUrl.channels) {
      const valid = initialUrl.channels.filter(c => getChannels().includes(c));
      if (valid.length > 0) return new Set(valid);
    }
    return new Set(getChannels());
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
  const [profiles, setProfiles] = useState<Profile[]>(getProfiles);
  const [activeProfile, setActiveProfile] = useState<Profile>(getActiveProfile);
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
  }, [markWatched]);

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
    const url = buildUrl(selectedVideo?.videoId ?? null, selectedChannels, channels);
    if (url !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", url);
    }
  }, [selectedVideo, selectedChannels, channels]);

  const handleAddChannel = (handle: string) => {
    const updated = addChannel(handle);
    setChannels(updated);
    setProfiles(getProfiles());
    setActiveProfile(getActiveProfile());
    setSelectedChannels((prev) => new Set([...prev, handle]));
    loadVideos();
  };

  const handleRemoveChannel = (handle: string) => {
    const updated = removeChannel(handle);
    setChannels(updated);
    setProfiles(getProfiles());
    setActiveProfile(getActiveProfile());
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      next.delete(handle);
      return next;
    });
    setVideos((prev) => prev.filter((v) => v.handle !== handle));
  };

  const switchProfile = (id: string) => {
    setActiveProfileId(id);
    const profile = getProfiles().find((p) => p.id === id) || getProfiles()[0];
    setActiveProfile(profile);
    setChannels(profile.channels);
    setSelectedChannels(new Set(profile.channels));
    setVideos([]);
    setChannelInfos(new Map());
    setSelectedVideo(null);
    setTimeout(() => loadVideos(), 0);
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
  const filteredVideos = allSelected
    ? videos
    : videos.filter((v) => selectedChannels.has(v.handle));

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
        } h-full overflow-y-auto bg-[#1c1714] border-r border-[#302a22] p-3 space-y-1`}
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
          onAdd={handleAddChannel}
          onRemove={handleRemoveChannel}
          onUpdateProfile={(updates) => {
            const updated = updateProfile(activeProfile.id, updates);
            setProfiles(updated);
            setActiveProfile(updated.find((p) => p.id === activeProfile.id) || updated[0]);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
