import { useState, useEffect, useRef } from "react";
import { Profile } from "./profiles";
import EmojiPickerButton from "./EmojiPickerButton";

export default function ProfileSwitcher({
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
