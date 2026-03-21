# Product Requirements Document (PRD) — GameHub

## 1. Project Overview

**GameHub** is a web-based platform offering a collection of free, online, peer-to-peer (P2P) multiplayer classic games. The platform focuses on frictionless user entry — players jump straight into games without account creation.

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) · TypeScript · Tailwind CSS |
| Backend | FastAPI (Python) · WebSockets |
| Deployment | Docker Compose |

## 3. Core Features

### 3.1 Frictionless Onboarding
- No account required. Players enter only a display name.
- Name is persisted in `localStorage` for future sessions.
- Name can be pre-set via `?name=` URL param (see §6).

### 3.2 Home Dashboard
- Card-based game library. Each card links to a game room.
- Optional room code field — shared with an opponent to join the same room.
- Room ID persists across game selection on the page.

### 3.3 Multiplayer Game Rooms
All games are 2-player, real-time, over WebSockets.

| Game | Mode |
|------|------|
| Tic-Tac-Toe | Turn-based |
| Battleships | Turn-based (placement + salvo phases) |
| Tetris | Real-time competitive (garbage rows) |
| Ping-Pong | Real-time (server-authoritative physics) |
| Connect Four | Turn-based |
| Rock Paper Scissors | Simultaneous pick, best of 5 |

### 3.4 Integrated Chat
- Per-room real-time chat sidebar.
- System events broadcast via chat (join, win, draw, restart).
- Chat can be **disabled** via `?chat=false` URL param.

### 3.5 Embeddable via iframe
GameHub can be embedded in any third-party web app as an iframe.  
All per-session overrides are passed via URL params.  
No `X-Frame-Options` or `frame-ancestors` restrictions are applied.

## 4. URL Parameters

| Param | Values | Effect |
|-------|--------|--------|
| `name` | any string | Pre-sets player name, skips name form, locks player identity |
| `room` | room code string | Pre-fills room ID on homepage |
| `chat` | `true` \| `false` | Toggles chat panel visibility (default: `true`) |

Parameters set on the homepage are **forwarded** to every game room URL automatically.  
Parameters in room URLs take effect immediately — no redirect needed.

### Embed example
```html
<iframe
  src="http://gamehub.example.com/?name=Alice&room=match-001&chat=false"
  width="1024"
  height="768"
  frameborder="0"
  allow="autoplay"
></iframe>
```

## 5. Architecture

### Real-time Games (Ping-Pong, Tetris)
- Server-authoritative game loop runs as an asyncio background task in FastAPI.
- Room management in `main.py` via `GameRoom`, which holds WebSocket connections and calls `game_logic.tick()`.

### Turn-based Games (Tic-Tac-Toe, Battleships, Connect Four, RPS)
- State broadcasted on-demand after each valid move.

### Adding a New Game
1. Create `backend/games/<game>.py` with `on_player_join`, `get_state`, `make_move`, `reset`.
2. Register in `backend/games/__init__.py`.
3. Create `frontend/src/components/games/<Game>.tsx`.
4. Add import + switch case in `frontend/src/app/room/[id]/page.tsx`.
5. Add card to `frontend/src/app/page.tsx`.

## 6. User Journey

1. **Embed / Visit**: Parent app embeds GameHub with `?name=Alice&room=xyz&chat=false` or user visits directly.
2. **Name**: Set from param (skips form) or entered manually.
3. **Game Selection**: Player picks a game from the dashboard.
4. **Room**: Navigates to `/room/<id>?game=<type>` (all embed params forwarded).
5. **Gameplay**: Plays against opponent; chat shown/hidden per `chat` param.

## 7. Future Considerations
- Matchmaking / random peer pairing.
- Leaderboards using localStorage (no formal logins).
- Spectator mode (room capacity > 2).
