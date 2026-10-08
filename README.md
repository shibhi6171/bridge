# Bridge — connects the unconnected

A minimal multi-room chat app: create or join rooms, send messages, see who's
online, and see typing indicators — all in real time.

**Live app:** https://wire-micro-chat.vercel.app

## Architecture

```
micro-chat/
├── client/                 React + Vite — the actual deployed app
│   ├── src/
│   │   ├── context/ChatContext.jsx   ← all Supabase logic lives here
│   │   ├── components/
│   │   │   ├── JoinRoom.jsx          ← Create room / Join room tabs
│   │   │   ├── ChatRoom.jsx
│   │   │   ├── MessageList.jsx
│   │   │   └── MessageInput.jsx
│   │   ├── App.jsx
│   │   └── index.css
│   ├── .env.example
│   └── package.json
└── server/                 Alternate Node/Socket.io backend (not currently used —
    ├── server.js           kept as a reference/fallback; see "Two backends" below)
    └── package.json
```

The deployed app talks to **Supabase** (hosted Postgres + Realtime) instead of
a custom server:

- **`rooms` table** — created via the "Create room" form (name, topic,
  optional password, max people). A unique constraint on `name` makes
  duplicate room creation fail cleanly.
- **`messages` table** — every chat message and system join/leave notice.
  Enabled in Supabase's `supabase_realtime` publication, so `INSERT`s push to
  every subscribed client instantly via websockets — no polling.
- **Presence & typing** — handled by Supabase Realtime's built-in Presence
  and Broadcast features on a per-room channel. These are ephemeral (not
  stored in a table), which is the right fit since nobody needs typing
  indicator history.
- **Row Level Security** is on for both tables, with public policies (this is
  an open demo app with no auth layer — anyone can create a room, join a
  room, and post to it).

## Running it locally

```bash
cd client
npm install
npm run dev          # http://localhost:5173
```

No server to start — the client talks directly to Supabase. Copy
`.env.example` to `.env` and fill in your own Supabase project's URL and
anon/publishable key if you want to point this at a different project
(otherwise it falls back to the deployed project's public key, which is safe
to expose — that's what Row Level Security is for).

## Two backends — why both exist

This project was originally built with a custom Node + Socket.io server
(`server/`). It's kept in the repo as a reference for anyone who wants to see
that approach or self-host without Supabase, but **the deployed app uses
Supabase instead** — a Socket.io server needs an always-on host (Render,
Railway, etc.), which added a step that Supabase's hosted Realtime avoids
entirely. If you want to run the Socket.io version instead:

```bash
cd server
npm install
npm start             # http://localhost:4000

cd ../client
npm install
# create .env with VITE_SERVER_URL=http://localhost:4000
# (and swap ChatContext.jsx back to the Socket.io version if reusing this path)
npm run dev
```

## Deploying to GitHub Pages

A workflow is already set up at `.github/workflows/deploy-pages.yml` that
builds the client and deploys it automatically on every push to `main`. It
handles the one thing that trips people up with Vite + Pages: Pages serves
your site from a subpath (`https://<user>.github.io/<repo>/`), so the build
needs `--base=/<repo>/` or all the asset URLs 404 and you get a blank white
screen. The workflow injects the repo name automatically, so you don't need
to edit anything.

To turn it on:
1. Push this repo to GitHub (see below).
2. In the repo, go to **Settings → Pages** and set **Source** to
   "GitHub Actions" (not "Deploy from a branch").
3. Push to `main` (or re-run the workflow from the **Actions** tab) — it'll
   build and publish automatically.

If you ever deploy manually instead of via the workflow, remember the base
path flag:
```bash
cd client
npm install
npx vite build --base=/your-repo-name/
# then push the contents of client/dist to your gh-pages branch
```

## Pushing to GitHub

```bash
cd micro-chat
git init
git add .
git commit -m "Initial commit: wire micro-chat"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

`.gitignore` already excludes `node_modules/`, `dist/`, and `.env` files.

## Notes

- The Supabase project is on the free tier, which auto-pauses after a week
  of inactivity. If "Create room" ever fails with a schema/table-not-found
  error after some downtime, the project just needs restoring — takes about
  a minute from the Supabase dashboard (or ask Claude, if you're picking
  this back up in a session that still has the connector).
- Room passwords are stored as plain text in this demo for simplicity — fine
  for a low-stakes chat room, not something to reuse for anything sensitive.
