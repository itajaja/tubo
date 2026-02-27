import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  OAuthCredential,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { Profile } from "./profiles";
import { setYouTubeToken } from "./youtube";

const firebaseConfig = {
  apiKey: "AIzaSyDQJAEUX9KINI-V_Rgl0sw81TLpv5PTEQg",
  authDomain: "tubo-9dee4.firebaseapp.com",
  projectId: "tubo-9dee4",
  storageBucket: "tubo-9dee4.firebasestorage.app",
  messagingSenderId: "580419026530",
  appId: "1:580419026530:web:a5efea3efe8b5cf1e39b3b",
  measurementId: "G-PTZVXQ5K8Q",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/youtube.readonly");

let cachedAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export async function signIn(): Promise<{ user: User; accessToken: string }> {
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result) as OAuthCredential;
  const accessToken = credential.accessToken!;
  cachedAccessToken = accessToken;
  setYouTubeToken(accessToken);
  return { user: result.user, accessToken };
}

export async function refreshAccessToken(): Promise<string> {
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result) as OAuthCredential;
  const accessToken = credential.accessToken!;
  cachedAccessToken = accessToken;
  setYouTubeToken(accessToken);
  return accessToken;
}

export function doSignOut() {
  cachedAccessToken = null;
  return auth.signOut();
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export interface UserConfig {
  profiles: Profile[];
  filterShorts: boolean;
  watchedIds: string[];
}

const DEFAULT_CONFIG: UserConfig = {
  profiles: [{ id: "default", name: "Default", emoji: "\u{1F4FA}", channels: [] }],
  filterShorts: true,
  watchedIds: [],
};

export async function loadUserConfig(uid: string): Promise<UserConfig> {
  const snap = await getDoc(doc(db, "users", uid, "config", "main"));
  if (snap.exists()) {
    return snap.data() as UserConfig;
  }
  // First login — initialize with default config
  await saveUserConfig(uid, DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export async function saveUserConfig(uid: string, config: UserConfig): Promise<void> {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await setDoc(doc(db, "users", uid, "config", "main"), config);
  }, 2000);
}

export async function saveUserConfigImmediate(uid: string, config: UserConfig): Promise<void> {
  if (saveTimeout) clearTimeout(saveTimeout);
  await setDoc(doc(db, "users", uid, "config", "main"), config);
}
