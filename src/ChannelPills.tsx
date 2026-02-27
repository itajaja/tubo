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
