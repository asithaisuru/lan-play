# Waveio LAN

Waveio LAN is a local-network shared YouTube playlist system for parties, shops, offices, and small events. Users join a room from their own device, add songs, and the assigned audio device plays the room playlist.

The host controls the room, but audio playback can be assigned to any connected device.

Waveio is a KRODOT product | Crown of Technology.

## Features

- LAN-friendly room sharing with invite links.
- User song requests with optional spoken messages.
- Host-managed default playlist that plays when the user queue is empty.
- User requests interrupt default music, then default music resumes from where it paused.
- Persistent room state using SQLite.
- Host recovery after refresh using a browser `clientId`.
- Host transfer to another connected user.
- Assignable audio device separate from the host/admin device.
- Host controls for play, pause, next, fullscreen player, and audio volume.
- Dark player-style interface with mobile fullscreen support.

## Project Structure

```text
lan-play/
  backend/              Node.js, Express, Socket.IO, SQLite
  frontend/             React, Vite, Socket.IO client
  start-lan-play.bat    Windows launcher for backend + frontend
```

## Requirements

- Node.js 24.11.1 or newer is recommended because the backend uses `node:sqlite`.
- npm
- Windows for the included `.bat` launcher

## Installation

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

## Running The App

### Windows Launcher

From the project root, run:

```bat
start-lan-play.bat
```

This opens two terminal windows:

- `Waveio LAN Backend`
- `Waveio LAN Frontend`

The backend runs on:

```text
http://localhost:5000
```

The frontend URL is shown in the frontend terminal window.

### Manual Start

Backend:

```bash
cd backend
npm start
```

Frontend:

```bash
cd frontend
npm run dev
```

## Environment

Create a backend `.env` file if needed:

```env
PORT=5000
NODE_ENV=development
GEMINI_API_KEY=
```

`PORT` defaults to `5000` if not set.

## Database

The app stores room, user, playlist, queue, default playlist, playback, volume, and host/audio-device state in SQLite.

Database location:

```text
backend/data/lan-play.sqlite
```

Do not commit generated SQLite database files.

## How It Works

1. A host creates or joins a room.
2. Other users join from the LAN invite link.
3. Users add YouTube links to the queue.
4. The host can create a default playlist.
5. If the user queue is empty, the default playlist loops.
6. If a user adds a song while default music is playing, default music pauses and the user song plays.
7. When the user queue ends, default music resumes from its saved position.
8. The host can assign which connected device actually plays audio.

## Host Controls

The host can:

- Play or pause the room.
- Skip to the next song.
- Toggle spoken messages.
- Manage the default playlist.
- Transfer host/admin status.
- Assign the audio playback device.
- Control the audio device volume.
- Open the fullscreen Now Playing view.

## Audio Device

The audio device is the browser/device that actually plays the YouTube audio.

Important notes:

- The host can assign any connected user as the audio device.
- The host does not have to be the audio device.
- If a browser blocks autoplay, click once on the assigned audio device page, then press play again.
- If the audio device disconnects, the app falls back to the owner if available, otherwise the oldest connected user.

## Playback Model

Waveio LAN uses the official YouTube IFrame API for browser playback. It does not use `ytdl-core`, `play-dl`, `youtube-dl`, direct audio extraction, or server-side YouTube stream downloading.

## LAN Sharing

The backend exposes network information at:

```text
http://localhost:5000/api/network-info
```

The app prefers real Wi-Fi/Ethernet addresses and filters out common virtual adapters such as Docker, WSL, VPN, VirtualBox, and Hyper-V.

If invite links do not work on another device:

- Make sure both devices are on the same network.
- Make sure the frontend and backend are running.
- Allow Node.js through Windows Firewall.
- Use the shown Wi-Fi/Ethernet IP address, not virtual adapter IPs.

## Common Console Messages

You may see messages like:

```text
net::ERR_BLOCKED_BY_CLIENT
inject_yt_blocking_script.js
chrome-extension://...
sharebx.js
```

These usually come from browser extensions, ad blockers, privacy blockers, or YouTube telemetry requests being blocked. They are not Waveio application errors.

For a clean test, open the app in an Incognito/InPrivate window with extensions disabled.

## Useful Commands

Frontend build:

```bash
cd frontend
npm run build
```

Frontend lint:

```bash
cd frontend
npm run lint
```

Backend syntax check:

```bash
node --check backend/server.js
node --check backend/sockets/playlistSocket.js
node --check backend/db/sqlite.js
```

Backend health check:

```text
http://localhost:5000/api/health
```

## Troubleshooting

### Frontend cannot connect to backend

- Confirm the backend terminal says it is running on port `5000`.
- Confirm the frontend is using the correct host/IP.
- Check Windows Firewall.

### Audio does not start on assigned device

- Click once on the assigned audio device browser page.
- Press play again from the host controls.
- Some browsers block autoplay until the page has user interaction.

### Default playlist restarts instead of resuming

- Confirm the assigned audio device is connected and reporting playback progress.
- Confirm the queue song finishes normally or the host uses next.

### Wrong IP address is shown

- Use the IP from the physical Wi-Fi/Ethernet adapter.
- Ignore VPN, Docker, WSL, VirtualBox, Hyper-V, and other virtual adapters.

## Notes

Waveio LAN is designed for no-login local-network use. Users are identified by username, room code, and a browser-stored client ID.

Waveio is a KRODOT product. Copyright 2026 KRODOT. All rights reserved.
