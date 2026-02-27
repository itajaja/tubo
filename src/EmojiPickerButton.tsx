import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

export default function EmojiPickerButton({
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
