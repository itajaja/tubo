import { VideoWithDetails } from "./youtube";
import { formatDuration, timeAgo } from "./utils";

export default function VideoCard({
  video,
  onClick,
  isActive,
  watched,
  queued,
  onQueue,
  grid,
}: {
  video: VideoWithDetails;
  onClick: () => void;
  isActive: boolean;
  watched: boolean;
  queued?: boolean;
  onQueue?: () => void;
  grid?: boolean;
}) {
  if (grid) {
    return (
      <div
        className={`rounded-xl text-left w-full group transition-colors ${
          isActive ? "bg-[#302a22]" : "hover:bg-[#252019]"
        }`}
      >
        <button
          title={video.title}
          onClick={onClick}
          className="w-full cursor-pointer text-left"
        >
          <div className="relative">
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
          <div className="mt-2 px-1 pb-2">
            <p className="text-sm font-medium text-[#d4c5b0] line-clamp-2">
              {video.title}
            </p>
            <p className="text-xs text-[#8a7e6e] mt-1">{video.channelTitle}</p>
            <p className="text-xs text-[#5a5044]">{timeAgo(video.publishedAt)}</p>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-3 p-2 rounded-xl text-left w-full group transition-colors ${
        isActive ? "bg-[#302a22]" : "hover:bg-[#252019]"
      }`}
    >
      <button
        title={video.title}
        onClick={onClick}
        className="flex gap-3 flex-1 min-w-0 cursor-pointer text-left"
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
      {onQueue && (
        <button
          onClick={onQueue}
          title={queued ? "In queue" : "Add to queue"}
          className={`self-center p-1.5 rounded cursor-pointer transition-colors shrink-0 md:opacity-0 md:group-hover:opacity-100 ${
            queued ? "text-[#a08860]" : "text-[#5a5044] hover:text-[#8a7e6e]"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
