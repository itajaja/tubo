import { useEffect, useRef } from "react";

const BASE_PATH = window.location.pathname.startsWith("/tubo") ? "/tubo/" : "/";

export interface UrlState {
  videoId: string | null;
  channels: string[] | null;
  profileIndex: number | null;
  query: string | null;
}

function parseUrl(): UrlState {
  const params = new URLSearchParams(window.location.search);
  const videoId = params.get("v") || null;
  const channelsParam = params.get("channels");
  const channels = channelsParam ? channelsParam.split(",").filter(Boolean) : null;
  const profileParam = params.get("profile");
  const profileIndex = profileParam !== null ? parseInt(profileParam, 10) : null;
  const query = params.get("q") || null;
  return { videoId, channels, profileIndex, query };
}

function buildUrl(videoId: string | null, selectedChannels: Set<string>, allChannels: string[], profileIndex: number, query: string): string {
  const params = new URLSearchParams();
  if (videoId) params.set("v", videoId);
  const isAll = selectedChannels.size === allChannels.length || selectedChannels.size === 0;
  if (!isAll) params.set("channels", [...selectedChannels].join(","));
  if (profileIndex > 0) params.set("profile", String(profileIndex));
  if (query.trim()) params.set("q", query);
  const search = params.toString();
  return BASE_PATH + (search ? "?" + search : "");
}

export const initialUrlState: UrlState = parseUrl();

export function useUrlSync(
  videoId: string | null,
  selectedChannels: Set<string>,
  allChannels: string[],
  profileIndex: number,
  query: string,
  onNavigate: (state: UrlState) => void,
) {
  const prevVideoRef = useRef(videoId);
  const prevProfileRef = useRef(profileIndex);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  useEffect(() => {
    const url = buildUrl(videoId, selectedChannels, allChannels, profileIndex, query);
    if (url !== window.location.pathname + window.location.search) {
      const videoChanged = videoId !== prevVideoRef.current;
      const profileChanged = profileIndex !== prevProfileRef.current;
      if (videoChanged || profileChanged) {
        window.history.pushState(null, "", url);
      } else {
        // Typing in the search box shouldn't add a history entry per keystroke.
        window.history.replaceState(null, "", url);
      }
    }
    prevVideoRef.current = videoId;
    prevProfileRef.current = profileIndex;
  }, [videoId, selectedChannels, allChannels, profileIndex, query]);

  useEffect(() => {
    const onPopState = () => {
      const parsed = parseUrl();
      prevVideoRef.current = parsed.videoId;
      prevProfileRef.current = parsed.profileIndex !== null && !isNaN(parsed.profileIndex) ? parsed.profileIndex : 0;
      onNavigateRef.current(parsed);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}
