import { useState, useEffect, useRef } from "react";
import { Profile } from "./profiles";
import { searchChannels, ChannelSearchResult } from "./youtube";
import { ChannelInfo } from "./utils";
import EmojiPickerButton from "./EmojiPickerButton";

export default function SettingsPanel({
  channels,
  channelInfos,
  activeProfile,
  filterShorts,
  userName,
  userPhoto,
  onAdd,
  onRemove,
  onUpdateProfile,
  onToggleFilterShorts,
  onSignOut,
  onClose,
}: {
  channels: string[];
  channelInfos: Map<string, ChannelInfo>;
  activeProfile: Profile;
  filterShorts: boolean;
  userName: string;
  userPhoto: string;
  onAdd: (handle: string) => void;
  onRemove: (handle: string) => void;
  onUpdateProfile: (updates: { name?: string; emoji?: string }) => void;
  onToggleFilterShorts: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const [newChannel, setNewChannel] = useState("");
  const [suggestions, setSuggestions] = useState<ChannelSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
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

        {/* Account section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#8a7e6e] uppercase tracking-wider">Account</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {userPhoto && <img src={userPhoto} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />}
              <span className="text-sm text-[#c4b5a0]">{userName}</span>
            </div>
            <button
              onClick={onSignOut}
              className="text-sm text-[#5a5044] hover:text-red-400 cursor-pointer"
            >
              Sign out
            </button>
          </div>
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

        {/* Preferences section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#8a7e6e] uppercase tracking-wider">Preferences</h3>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[#c4b5a0]">Hide short videos (&lt;3min)</span>
            <button
              onClick={onToggleFilterShorts}
              className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${filterShorts ? "bg-[#7a6a50]" : "bg-[#3a332a]"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-[#d4c5b0] transition-transform mx-0.5 ${filterShorts ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </label>
        </div>
      </div>
    </div>
  );
}
