# GameHub 🎮

A real-time peer-to-peer multiplayer game platform. Two players share a room code and play directly against each other over WebSockets — no accounts needed.

## Games

| Game | Type | Players |
|------|------|---------|
| Tic-Tac-Toe | Turn-based | 2 |
| Battleships | Turn-based | 2 |
| Tetris | Real-time (competitive) | 2 |
| Ping-Pong | Real-time | 2 |
| Tank Battle | Real-time | 2–4 |
| Snake Arena | Real-time | 2–6 |
| Connect Four | Turn-based | 2 |
| Rock Paper Scissors | Simultaneous pick | 2 |

## Embedding via iframe

GameHub can be embedded in any web app with no restrictions:

```html
<iframe
  src="http://gamehub.example.com/?name=Alice&room=match-001&chat=false"
  width="1024"
  height="768"
  frameborder="0"
></iframe>
```

## URL Parameters

| Param | Example | Effect |
|-------|---------|--------|
| `name` | `?name=Alice` | Pre-sets player name and skips the name form. Locks player identity (no "Change Name" button). |
| `room` | `?room=abc123` | Pre-fills the room code on the homepage. All games use this room ID. |
| `chat` | `?chat=false` | Hides the chat panel entirely (game takes full width). Omit or set `true` to show chat. |

All params set on the homepage are **automatically forwarded** to the game room URL, so they stay in effect throughout the session.

## Tech Stack

- **Frontend:** Next.js 16 (App Router) · TypeScript · Tailwind CSS
- **Backend:** FastAPI (Python) · WebSockets
- **Deployment:** Docker Compose

## Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Run locally

```bash
cp env.sample .env
docker compose up -d --build
```

Then open [http://localhost](http://localhost) (or `http://localhost:<HTTP_PORT>` if you changed `HTTP_PORT` in `.env`).

### Reverse proxy (Caddy)

Caddy is the single entry point. It routes by path:

- `/auth/*` and `/ws/*` go to the backend (FastAPI).
- Everything else goes to the frontend (Next.js).

Only Caddy publishes a host port (`HTTP_PORT`, default `80`). The backend and frontend are reachable only inside the Compose network. Any new backend route needs a matcher in `Caddyfile`.

Caddy serves plain HTTP for any domain. For HTTPS, put a TLS proxy (Coolify, Cloudflare, ...) in front of it. The WebSocket then uses `wss:` automatically.

> **Caveat:** Caddy trusts `X-Forwarded-Proto` only from proxies on a private network. If a proxy reaches the server over its public IP (e.g. Cloudflare directly), the SEO/OpenGraph URLs show `http://`. The app still works.

### Development without Docker

To run the frontend with `npm run dev` without Caddy, tell the browser where the backend is in `frontend/.env.local`:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Stop

```bash
docker compose down
```

## How to Play

1. Enter your name on the homepage
2. Pick a game and click **Create New Game** (or enter a room code to join an existing one)
3. Share the room URL with your opponent
4. Play!

## Project Structure

```
GameHub/
├── backend/
│   ├── main.py              # WebSocket server, room management, game loop
│   ├── games/
│   │   ├── tic_tac_toe.py
│   │   ├── battleships.py
│   │   ├── tetris.py
│   │   ├── ping_pong.py
│   │   ├── connect_four.py
│   │   └── rock_paper_scissors.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Homepage / game lobby
│   │   │   └── room/[id]/       # In-game room page
│   │   └── components/games/    # Per-game React components
│   └── Dockerfile
├── Caddyfile                # Reverse proxy: routes /auth/* and /ws/* to the backend
├── docker-compose.yml
└── README.md
```

## Adding a New Game

1. Create `backend/games/<your_game>.py` with a logic class implementing:
   - `on_player_join(username, existing_symbols) -> str | None`
   - `get_state() -> dict`
   - `make_move(symbol, **kwargs) -> bool`
   - `reset()`
   - _(optional)_ Set `needs_server_loop = True` for real-time games — the server will call `tick()` at 30fps
2. Register it in `backend/games/__init__.py`
3. Create `frontend/src/components/games/<YourGame>.tsx`
4. Add the import + switch case in `frontend/src/app/room/[id]/page.tsx`
5. Add a card to `frontend/src/app/page.tsx`
