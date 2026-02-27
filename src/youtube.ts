const API_KEY_STORAGE_KEY = "tubo_youtube_api_key";

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
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

async function ytFetch(endpoint: string, params: Record<string, string>) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No API key set");
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  url.searchParams.set("key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
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
): Promise<{ videos: Video[]; nextPageToken?: string }> {
  const params: Record<string, string> = {
    playlistId: uploadsPlaylistId,
    part: "snippet",
    maxResults: String(maxResults),
  };
  if (pageToken) params.pageToken = pageToken;
  const data = await ytFetch("playlistItems", params);
  const videos = (data.items || []).map((item: any) => ({
    videoId: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    thumbnail:
      item.snippet.thumbnails.medium?.url ||
      item.snippet.thumbnails.default?.url,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    handle,
  }));
  return { videos, nextPageToken: data.nextPageToken };
}

export async function getVideoById(videoId: string): Promise<Video | null> {
  const data = await ytFetch("videos", {
    id: videoId,
    part: "snippet",
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
  };
}
