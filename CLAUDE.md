# Tubo

Distraction-free YouTube video viewer. Shows latest videos from a curated list of channels with no suggestions, no algorithmic recommendations — just the videos and their controls.

**Live:** https://giacomotag.io/tubo/

## Stack

- React + TypeScript
- Tailwind CSS v4 (via `@tailwindcss/postcss`)
- Webpack 5 with `ts-loader` (no esbuild — esbuild binaries fail on this machine due to macOS code signing)
- Bun as package manager (npm points to Anthropic's internal registry which is missing some packages)

## Key files

- `src/App.tsx` — Main UI: API key prompt, channel pills, video list with infinite scroll, embedded player
- `src/youtube.ts` — YouTube Data API v3 helpers (resolve channels, fetch videos with pagination)
- `src/channels.ts` — Channel list management with localStorage persistence
- `webpack.config.js` — Build config, production publicPath set to `/tubo/` for GitHub Pages
- `postcss.config.js` — PostCSS with Tailwind plugin

## YouTube API

- Uses YouTube Data API v3 with a **free API key** (no OAuth needed — read-only public data)
- API key is stored in `localStorage` under `tubo_youtube_api_key`
- Channels are resolved via `forHandle`, then videos fetched from the uploads playlist
- Pagination uses `nextPageToken` per channel

## Local state (localStorage)

- `tubo_youtube_api_key` — YouTube API key
- `tubo_channels` — JSON array of channel handles
- `tubo_watched` — JSON array of watched video IDs

## Deploy

```bash
bun run deploy  # builds and publishes to gh-pages branch
```

GitHub Pages is configured to serve from the `gh-pages` branch. The repo uses personal git credentials (itajaja / giacomo.tag@gmail.com) stored in `.git/.credentials`.

## Design

Dark warm brown theme (`#1c1714` base) with cream/amber text. Soft, cozy aesthetic.
