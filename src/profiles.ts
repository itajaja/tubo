export interface Profile {
  id: string;
  name: string;
  emoji: string;
  channels: string[];
}

export const ALL_PROFILE_ID = "__all__";

export function getAllProfile(profiles: Profile[]): Profile {
  const seen = new Set<string>();
  const channels: string[] = [];
  for (const p of profiles) {
    for (const ch of p.channels) {
      if (!seen.has(ch)) {
        seen.add(ch);
        channels.push(ch);
      }
    }
  }
  return { id: ALL_PROFILE_ID, name: "All", emoji: "*", channels };
}
