import { useRef } from "react";
import { ChannelInfo } from "./utils";

export default function ChannelPills({
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
        className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
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
          <ChannelPill
            key={handle}
            label={label}
            isSelected={isSelected}
            onToggle={() => onToggle(handle)}
            onOnly={() => onOnly(handle)}
          />
        );
      })}
    </div>
  );
}

function ChannelPill({ label, isSelected, onToggle, onOnly }: {
  label: string;
  isSelected: boolean;
  onToggle: () => void;
  onOnly: () => void;
}) {
  const lastClickRef = useRef(0);

  const handleClick = () => {
    const now = Date.now();
    if (now - lastClickRef.current < 300) {
      onToggle(); // undo the first click's toggle
      onOnly();
    } else {
      onToggle();
    }
    lastClickRef.current = now;
  };

  return (
    <button
      onClick={handleClick}
      className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
        isSelected
          ? "bg-[#7a6a50] text-[#1c1714]"
          : "bg-[#252019] text-[#8a7e6e] hover:bg-[#302a22]"
      }`}
    >
      {label}
    </button>
  );
}