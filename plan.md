# Add Firebase Auth + Firestore Backend

## Context
Currently all user data (profiles, watched videos, preferences) lives in localStorage, which means it's lost when switching browsers/devices. Adding Firebase gives us:
1. **Google OAuth login** — replaces the manual API key prompt entirely
2. **Cloud-synced config** — profiles, watched list, and preferences persist across devices
3. **Free** — Firebase free tier (Spark plan) is more than enough for a single-user app

## How Google OAuth replaces the API key
When signing in with Google via Firebase Auth, we request the `https://www.googleapis.com/auth/youtube.readonly` scope. Firebase returns a Google OAuth access token (`result.credential.accessToken`) that can be passed as a Bearer token to the YouTube Data API v3 — no API key needed.

The token expires (~1 hour), but Firebase's `onAuthStateChanged` + `getRedirectResult` handle re-auth. We store the token in memory and re-acquire via `signInWithPopup` if a YouTube API call fails with 401.

## Data Model in Firestore

```
users/{uid}/
  config (document):
    profiles: Profile[]
    filterShorts: boolean
    watchedIds: string[]    // cap at ~1000 most recent
```

Single document per user. Simple reads/writes, no complex queries.

## Firebase Setup (Do This First)

Before coding, you need to create and configure a Firebase project:

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it (e.g. "tubo")
2. **Authentication**:
   - Go to Authentication → Get started
   - Sign-in method → Enable **Google**
   - Set the project support email to your Gmail
3. **Firestore**:
   - Go to Firestore Database → Create database
   - Choose **production mode**
   - Pick a region (e.g. `us-central1`)
   - Go to Rules tab, replace with:
     ```
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /users/{userId}/{document=**} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
     ```
4. **Authorized domains**:
   - Authentication → Settings → Authorized domains
   - Add `giacomotag.io`
5. **Get config**:
   - Project settings (gear icon) → General → Your apps → Add web app
   - Copy the `firebaseConfig` object — you'll paste it into the code when prompted

## Files to Modify

### 1. New: `src/firebase.ts`
- Initialize Firebase app with config
- Export `auth` and `db` instances
- `signIn()` — `signInWithPopup` with Google provider + YouTube scope, returns `{ user, youtubeAccessToken }`
- `signOut()`
- `onAuthChange(callback)` — wraps `onAuthStateChanged`
- `loadUserConfig(uid)` — reads `users/{uid}/config` from Firestore
- `saveUserConfig(uid, config)` — writes to Firestore (debounced ~2s)

### 2. Modify: `src/youtube.ts`
- `ytFetch` currently uses `url.searchParams.set("key", apiKey)` (line 35) — change to `Authorization: Bearer <token>` header
- Remove `getApiKey`/`setApiKey` and `API_KEY_STORAGE_KEY` (lines 1-9)
- Add module-level `let accessToken: string | null` with exported `setYouTubeToken(token)` setter

### 3. Modify: `src/profiles.ts`
- Keep `Profile` interface and all mutation functions as-is (they already return updated arrays)
- Replace localStorage persistence with a callback pattern: caller provides save/load functions
- Or simpler: make `getProfiles`/`saveProfiles` accept an optional storage adapter, defaulting to localStorage

### 4. Modify: `src/App.tsx`
- Replace `ApiKeyPrompt` (lines 48-82) with "Sign in with Google" button
- Top-level: `onAuthStateChanged` → if signed in, load Firestore config, set YouTube token, render app
- On any config change, debounce-save to Firestore
- Settings panel: remove API key section, add user info + sign out button
- Keep localStorage as offline fallback/cache

### 5. `package.json`
- Add `firebase` dependency

## Auth Flow

```
Page load
  → onAuthStateChanged
  → Signed in:
      → Get Google access token (re-auth if expired)
      → setYouTubeToken(token)
      → Load config from Firestore
      → Render app
  → Not signed in:
      → Show "Sign in with Google" screen
      → signInWithPopup with youtube.readonly scope
      → Save token, init default config if first login
      → Render app
```

## Token Refresh
Google OAuth tokens expire after ~1 hour. On YouTube API 401:
- Call `signInWithPopup` again (silent if session valid, popup if not)
- Retry the failed request

## Verification
1. `npx webpack --mode development` — builds clean
2. Manual testing:
   - Fresh visit → "Sign in with Google"
   - Sign in → app loads with default profile
   - Add channels, watch videos → data persists after reload
   - Incognito sign-in → same data appears
   - Sign out → returns to sign-in screen
