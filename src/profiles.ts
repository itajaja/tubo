const PROFILES_KEY = "tubo_profiles";
const ACTIVE_PROFILE_KEY = "tubo_active_profile";
const OLD_CHANNELS_KEY = "tubo_channels";

const DEFAULT_CHANNELS = [
  "grounded.shaispace",
  "KaptainCarbon",
  "MyAnalogJournal",
  "boscostudio",
  "-TheArtOfListening",
  "kexp",
];

export interface Profile {
  id: string;
  name: string;
  emoji: string;
  channels: string[];
}

export function getProfiles(): Profile[] {
  const stored = localStorage.getItem(PROFILES_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fall through to migration
    }
  }

  // Migrate from old tubo_channels key or use defaults
  let channels: string[];
  const oldChannels = localStorage.getItem(OLD_CHANNELS_KEY);
  if (oldChannels) {
    try {
      channels = JSON.parse(oldChannels);
    } catch {
      channels = DEFAULT_CHANNELS;
    }
  } else {
    channels = DEFAULT_CHANNELS;
  }

  const defaultProfile: Profile = {
    id: "default",
    name: "Default",
    emoji: "📺",
    channels,
  };
  saveProfiles([defaultProfile]);
  return [defaultProfile];
}

export function saveProfiles(profiles: Profile[]) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function getActiveProfileId(): string {
  return localStorage.getItem(ACTIVE_PROFILE_KEY) || "default";
}

export function setActiveProfileId(id: string) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
}

export function getActiveProfile(): Profile {
  const profiles = getProfiles();
  const id = getActiveProfileId();
  return profiles.find((p) => p.id === id) || profiles[0];
}

export function addProfile(name: string, emoji: string): Profile[] {
  const profiles = getProfiles();
  const newProfile: Profile = {
    id: crypto.randomUUID(),
    name,
    emoji,
    channels: [],
  };
  const updated = [...profiles, newProfile];
  saveProfiles(updated);
  return updated;
}

export function updateProfile(id: string, updates: { name?: string; emoji?: string }): Profile[] {
  const profiles = getProfiles();
  const updated = profiles.map((p) =>
    p.id === id ? { ...p, ...updates } : p
  );
  saveProfiles(updated);
  return updated;
}

export function deleteProfile(id: string): Profile[] {
  const profiles = getProfiles();
  if (profiles.length <= 1) return profiles;
  const updated = profiles.filter((p) => p.id !== id);
  saveProfiles(updated);
  // If deleting the active profile, switch to the first remaining
  if (getActiveProfileId() === id) {
    setActiveProfileId(updated[0].id);
  }
  return updated;
}

export function addChannelToProfile(
  profileId: string,
  handle: string
): Profile[] {
  const profiles = getProfiles();
  const clean = handle.replace(/^@/, "").trim();
  if (!clean) return profiles;
  const updated = profiles.map((p) => {
    if (p.id !== profileId) return p;
    if (p.channels.includes(clean)) return p;
    return { ...p, channels: [...p.channels, clean] };
  });
  saveProfiles(updated);
  return updated;
}

export function removeChannelFromProfile(
  profileId: string,
  handle: string
): Profile[] {
  const profiles = getProfiles();
  const updated = profiles.map((p) => {
    if (p.id !== profileId) return p;
    return { ...p, channels: p.channels.filter((c) => c !== handle) };
  });
  saveProfiles(updated);
  return updated;
}

// Backward-compat exports that delegate to the active profile
export function getChannels(): string[] {
  return getActiveProfile().channels;
}

export function addChannel(handle: string): string[] {
  const profile = getActiveProfile();
  addChannelToProfile(profile.id, handle);
  return getActiveProfile().channels;
}

export function removeChannel(handle: string): string[] {
  const profile = getActiveProfile();
  removeChannelFromProfile(profile.id, handle);
  return getActiveProfile().channels;
}
