let accessToken: string | null = null;

export function setYouTubeToken(token: string | null) {
  accessToken = token;
}

interface Channel {
  id: string;
  title: string;
  thumbnail: string;
  uploadsPlaylistId: string;
}

export interface Video {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  handle: string;
}

export interface VideoWithDetails extends Video {
  duration: number; // seconds
}

async function ytFetch(endpoint: string, params: Record<string, string>) {
  if (!accessToken) throw new Error("Not authenticated");
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 401) {
      throw Object.assign(new Error("Token expired"), { status: 401 });
    }
    throw new Error(
      body?.error?.message || `YouTube API error: ${res.status}`
    );
  }
  return res.json();
}

export async function resolveChannel(handle: string): Promise<Channel | null> {
  const data = await ytFetch("channels", {
    forHandle: handle,
    part: "snippet,contentDetails",
  });
  if (!data.items?.length) return null;
  const ch = data.items[0];
  return {
    id: ch.id,
    title: ch.snippet.title,
    thumbnail: ch.snippet.thumbnails.default.url,
    uploadsPlaylistId: ch.contentDetails.relatedPlaylists.uploads,
  };
}


export async function getLatestVideos(
  uploadsPlaylistId: string,
  handle: string,
  maxResults = 10,
  pageToken?: string
): Promise<{ videos: VideoWithDetails[]; nextPageToken?: string }> {
  const params: Record<string, string> = {
    playlistId: uploadsPlaylistId,
    part: "snippet",
    maxResults: String(maxResults),
  };
  if (pageToken) params.pageToken = pageToken;
  const data = await ytFetch("playlistItems", params);
  const rawVideos: Video[] = (data.items || []).map((item: any) => ({
    videoId: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    thumbnail:
      item.snippet.thumbnails.medium?.url ||
      item.snippet.thumbnails.default?.url,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    handle,
  }));
  const videos = await attachVideoDetails(rawVideos);
  return { videos, nextPageToken: data.nextPageToken };
}

export async function getVideoById(videoId: string): Promise<VideoWithDetails | null> {
  const data = await ytFetch("videos", {
    id: videoId,
    part: "snippet,contentDetails",
  });
  if (!data.items?.length) return null;
  const item = data.items[0];
  return {
    videoId: item.id,
    title: item.snippet.title,
    thumbnail:
      item.snippet.thumbnails.medium?.url ||
      item.snippet.thumbnails.default?.url,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    handle: "",
    duration: parseDuration(item.contentDetails?.duration || ""),
  };
}

export interface ChannelSearchResult {
  id: string;
  title: string;
  handle: string;
  thumbnail: string;
}

export async function searchChannels(query: string): Promise<ChannelSearchResult[]> {
  if (!query.trim()) return [];
  const data = await ytFetch("search", {
    q: query,
    type: "channel",
    part: "snippet",
    maxResults: "5",
  });
  if (!data.items?.length) return [];
  // Fetch full channel details to get customUrl (handle)
  const ids = data.items.map((item: any) => item.snippet.channelId).join(",");
  const details = await ytFetch("channels", {
    id: ids,
    part: "snippet",
  });
  return (details.items || []).map((ch: any) => ({
    id: ch.id,
    title: ch.snippet.title,
    handle: ch.snippet.customUrl?.replace(/^@/, "") || "",
    thumbnail: ch.snippet.thumbnails.default.url,
  }));
}

export interface Subscription {
  channelId: string;
  title: string;
  handle: string;
  thumbnail: string;
}

export async function getMySubscriptions(): Promise<Subscription[]> {
  const subs: Subscription[] = [];
  let pageToken: string | undefined;
  do {
    const params: Record<string, string> = {
      mine: "true",
      part: "snippet",
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;
    const data = await ytFetch("subscriptions", params);
    for (const item of data.items || []) {
      subs.push({
        channelId: item.snippet.resourceId.channelId,
        title: item.snippet.title,
        handle: "",
        thumbnail: item.snippet.thumbnails.default?.url || "",
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  // Resolve handles in batches of 50
  for (let i = 0; i < subs.length; i += 50) {
    const batch = subs.slice(i, i + 50);
    const ids = batch.map((s) => s.channelId).join(",");
    const details = await ytFetch("channels", { id: ids, part: "snippet" });
    for (const ch of details.items || []) {
      const sub = batch.find((s) => s.channelId === ch.id);
      if (sub) sub.handle = ch.snippet.customUrl?.replace(/^@/, "") || "";
    }
  }
  return subs.filter((s) => s.handle);
}

async function attachVideoDetails(videos: Video[]): Promise<VideoWithDetails[]> {
  if (videos.length === 0) return [];
  const ids = videos.map((v) => v.videoId).join(",");
  const data = await ytFetch("videos", {
    id: ids,
    part: "contentDetails",
  });
  const durations = new Map<string, number>();
  for (const item of data.items || []) {
    durations.set(item.id, parseDuration(item.contentDetails.duration));
  }
  return videos.map((v) => ({ ...v, duration: durations.get(v.videoId) || 0 }));
}

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || "0") * 3600) + (parseInt(m[2] || "0") * 60) + parseInt(m[3] || "0");
}
