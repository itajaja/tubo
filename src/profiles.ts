const PROFILES_KEY = "tubo_profiles";

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
      // fall through to default
    }
  }

  const defaultProfile: Profile = {
    id: "default",
    name: "Default",
    emoji: "📺",
    channels: [],
  };
  saveProfiles([defaultProfile]);
  return [defaultProfile];
}

export function saveProfiles(profiles: Profile[]) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
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