# Bridge — connects the unconnected

A multi-room chat app: create or join rooms, send messages, share photos and files, see who's online, and see typing indicators — all in real time.

**Live app:** https://bridge-unite.vercel.app

## Structure

```
client/                      React + Vite — the deployed app
  src/
    App.jsx                  Entry screen vs. chat room
    context/ChatContext.jsx  All Supabase logic (rooms, messages, uploads)
    components/
      EntryScreen.jsx        Cover → Join/Create choice → form
      ChatRoom.jsx           Chat header
      MessageList.jsx        Bubbles, avatars, photo/file attachments, lightbox
      MessageInput.jsx       Composer + attach button
    utils/avatar.js          Per-user avatar gradients and name colors
    index.css
server/                      Old Node/Socket.io backend (not used)
```

## Backend (Supabase)

- `rooms` and `messages` tables with Row Level Security (open, no auth).
- `messages` has attachment columns: `attachment_url`, `attachment_type`, `attachment_name`, `attachment_size`.
- A public storage bucket `attachments` holds uploaded photos and files (8MB limit in the app).
- Realtime is enabled on `messages`; presence and typing use Realtime channels.

## Run locally

```bash
cd client
npm install
npm run dev
```

## Deploy

**Vercel:** import the repo, set **Root Directory** to `client`, preset **Vite**.

**GitHub Pages:** the workflow in `.github/workflows/deploy-pages.yml` builds `client/` with the right base path.
In the repo go to **Settings → Pages → Source** and choose **GitHub Actions**.

## Notes

- Room passwords are stored as plain text — fine for a demo, not for anything sensitive.
- The Supabase free tier pauses after about a week of inactivity; restore it from the Supabase dashboard if rooms stop loading.
