const STORAGE_KEY = "tubo_channels";

const DEFAULT_CHANNELS = [
  "grounded.shaispace",
  "KaptainCarbon",
  "MyAnalogJournal",
  "boscostudio",
  "-TheArtOfListening",
  "kexp",
];

export function getChannels(): string[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEFAULT_CHANNELS;
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CHANNELS));
  return DEFAULT_CHANNELS;
}

export function saveChannels(channels: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
}

export function addChannel(handle: string): string[] {
  const channels = getChannels();
  const clean = handle.replace(/^@/, "").trim();
  if (!clean || channels.includes(clean)) return channels;
  const updated = [...channels, clean];
  saveChannels(updated);
  return updated;
}

export function removeChannel(handle: string): string[] {
  const updated = getChannels().filter((c) => c !== handle);
  saveChannels(updated);
  return updated;
}
