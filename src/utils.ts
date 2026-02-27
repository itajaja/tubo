export const BASE_PATH = window.location.pathname.startsWith("/tubo") ? "/tubo/" : "/";

export interface ChannelInfo {
  handle: string;
  title: string;
  uploadsPlaylistId: string;
}

export function parseUrl() {
  const path = window.location.pathname.slice(BASE_PATH.length);
  const videoId = path && path !== "/" ? path : null;
  const params = new URLSearchParams(window.location.search);
  const channelsParam = params.get("channels");
  const channels = channelsParam ? channelsParam.split(",").filter(Boolean) : null;
  const profileParam = params.get("profile");
  const profileIndex = profileParam !== null ? parseInt(profileParam, 10) : null;
  return { videoId, channels, profileIndex };
}

export function buildUrl(videoId: string | null, selectedChannels: Set<string>, allChannels: string[], profileIndex: number) {
  let path = BASE_PATH;
  if (videoId) path += videoId;
  const params = new URLSearchParams();
  const isAll = selectedChannels.size === allChannels.length || selectedChannels.size === 0;
  if (!isAll) params.set("channels", [...selectedChannels].join(","));
  if (profileIndex > 0) params.set("profile", String(profileIndex));
  const search = params.toString();
  return path + (search ? "?" + search : "");
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function timeAgo(dateStr: string): string {
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
