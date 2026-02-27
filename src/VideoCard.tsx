import { VideoWithDetails } from "./youtube";
import { formatDuration, timeAgo } from "./utils";

export default function VideoCard({
  video,
  onClick,
  isActive,
  watched,
}: {
  video: VideoWithDetails;
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
        {video.duration > 0 && (
          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#1c1714]/80 text-[#c4b5a0]">
            {formatDuration(video.duration)}
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
