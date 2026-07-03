# CodeComply Field

CodeComply Field — the PWA mobile/tablet-first, offline-first inspection app for CodeComply.

## Features

- 📱 Mobile/Tablet optimized UI
- 🔌 Offline-first with IndexedDB
- 🔄 Real-time sync via WebSockets
- 💾 Service Worker for caching
- 🎨 Tailwind CSS styling

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Environment Variables

Create a `.env` file:

```
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
VITE_VAPID_PUBLIC_KEY=<public-key-from-web-push-generate-vapid-keys>
```

## Deploy to Render.com

The Inspector is a **static site** on Render. It must be built with `VITE_API_URL` pointing at your deployed API (HTTPS, no trailing slash). The API must list the Inspector origin in `INSPECTOR_URL` for CORS.

Full instructions: see [Staging deployment (Render.com)](../../README.md#staging-deployment-rendercom) in the root README.

After seeding the staging database, sign in with **`inspector1@example.com` / `password123`** (SCO). Admin accounts (`admin@example.com`) are for the Admin portal only.

## Service Worker in Development

The Workbox service worker is disabled by default in local dev so it does not stale-cache Vite chunks during HMR. To exercise offline or Workbox behavior locally, opt in explicitly:

```bash
VITE_ENABLE_PWA_DEV=true pnpm dev
```

## Push notifications (NFR-M-04)

Local setup (after `apps/api/.env` and `apps/inspector/.env` are configured):

```bash
pnpm db:migrate
pnpm api:dev
pnpm --filter @codecomply/inspector dev:push   # or: pnpm inspector:dev (with VITE_ENABLE_* in .env)
```

Open http://localhost:5175, sign in as SCO, then **Enable notifications** on Home or Profile.

- Requires `VITE_VAPID_PUBLIC_KEY` on the client and matching `VAPID_*` keys on the API.
- Generate new keys: `pnpm --filter @codecomply/api exec web-push generate-vapid-keys`
- **iOS Safari**: Web Push works only when the PWA is installed to the home screen on **iOS 16.4+**. In a normal Safari tab, `PushManager` is unavailable and the UI hides push controls automatically.
