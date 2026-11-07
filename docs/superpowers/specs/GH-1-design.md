# GH-1 — GameHub Knowledge Base

## Goal
Fill the empty **GH — GameHub** KB space with 10 linked pages: a root index and 9 pages in 4 folders. Together they explain what GameHub is, how it works end to end, all 12 games, how to run and extend it, and where the code and the docs disagree. Every key claim on a page is checked against the code, so a new person or agent can get up to speed without reading the source.

## Decisions
- **Layout: about 10 linked pages in folders.** This was the human's choice. Rejected: one page per game (about 20 pages, harder to keep up to date) and one long overview page (hard to search and maintain). It follows the same pattern as the MW and OS KBs.
- **The pages are new summaries, not copies.** The README and `docs/prd.md` are out of date: they list 6 games and the code has 12. They also make claims the code contradicts. Pages state what the code does and record each difference in a "Docs vs. code" list.
- **The repo stays the source of truth.** Each page ends with **Sources**: the repo paths it relies on, plus the commit SHA it was checked against (`git rev-parse HEAD`, currently `96f9887ab619d9d5b4ce318245cfc62496bf03f5`).
- **The repo is not changed.** All output goes to the KB through `kb_write`. Nothing is added under `docs/`, and no code fixes are made. The issues found are documented, not fixed.

## KB structure (space `GH — GameHub`, id `42fb5252-1af3-4de2-81af-dc727c6634b0`)

**Root**
0. **GameHub — Start here.** A one-paragraph pitch, a map of every page with a one-line summary each, a quick start (`docker compose up -d --build`, then go to :3000), and a glossary: room, room code, game type key, symbol/seat, session, spectator, server loop, embed params.

**Product/**
1. **Product overview.** What GameHub is: free 2-player browser games with no accounts. Covers the user journey (lobby → room → play → chat), iframe embedding, and the URL params `name`, `room` and `chat` with their exact behaviour. Also covers the PRD's "future considerations" and how they compare with what already exists (spectators exist in practice). Sources: README, `docs/prd.md`, `frontend/src/app/page.tsx`.

**Architecture/**
2. **System architecture.** The parts are the Next.js 16 frontend, the FastAPI backend and Docker Compose. Covers:
   - The `ConnectionManager` → `GameRoom` → game logic layering, all held in memory, so rooms are lost on restart.
   - Room lifecycle: created on first join, deleted when empty. A room locks to its game type.
   - Seat assignment through `on_player_join`; anyone after the first two joiners becomes a spectator.
   - Turn-based broadcasting compared with the 30fps server loop (only Ping-Pong uses the loop).
   - Per-player views through `get_state_for_player`.
   - JWT session identity: `POST /auth/token` returns a token with a UUID session and the username, valid for 24h.
   - A request flow diagram as text.
3. **WebSocket & HTTP protocol.** Covers:
   - Endpoints: `GET /`, `POST /auth/token`, and `WS /ws/{game_type}/{room_id}?token=`.
   - Client actions: `chat`, `move` (every extra key becomes a kwarg), and `restart`.
   - Server messages: `game_state` with the fields the server adds (`type`, `game_type`, `players`, `symbols`, `my_session`), `chat`, and `error` with codes `UNAUTHORIZED` (close 4001) and `ROOM_TYPE_MISMATCH`.
   - The system chat events: join, leave, win, draw, restart.
4. **Frontend.** Covers:
   - The lobby (`page.tsx`): `localStorage gamehub_username`, `sessionStorage gamehub_token`, the 12 hard-coded cards, random 6-character room IDs, and which params are forwarded.
   - The room page: how the WS URL is built, message handling, the room-conflict screen, the chat panel, unread count, and mobile collapse.
   - The game component contract (props and the shape of the move messages).
   - `GameHelp` and `gameRules.ts`, `GameBtnGuard`, Swetrix analytics, SEO (`layout.tsx` metadata, `robots.ts`, `sitemap.ts`), and the `next.config.ts` frame headers.
   - The `frontend/AGENTS.md` note about breaking changes in this Next.js version.

**Games/**
5. **Game catalog.** One section per game, covering all 12: game key, logic class, seats, phases, server loop yes/no, hidden information, move kwargs, and win/draw rules. Each section also notes anything unusual: Tetris is client-trusted and has a garbage-row table; RPS and Number Duel are first to 3; Minesweeper is co-op with no winner field; Stratego has rank masking. A summary table comes at the top.
6. **Adding a new game.** The full checklist, corrected against the code:
   - backend class methods, including optional `get_state_for_player`, `needs_server_loop`/`tick`/`phase`/`winner`/`is_draw`;
   - registering the class in `games/__init__.py`;
   - the frontend component, the switch case in the room page, and the lobby card;
   - the `gameRules.ts` entry and a cover image in `public/games/`.

**Operations & Status/**
7. **Deployment & configuration.** Covers:
   - The three Dockerfiles and `docker-compose.yml`.
   - Env vars from `env.sample`, **by name only**: `BACKEND_PORT`, `FRONTEND_PORT`, `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_TELEMETRY_DISABLED`, `JWT_SECRET`. NEXT_PUBLIC_* values are fixed when the frontend is built.
   - Dependency versions, running without Docker (uvicorn plus `npm run dev`), and the fact that there are no tests and no CI.
8. **Known issues & docs vs. code.** Each issue has a file:line reference and a severity:
   - Guess Who sends both secret characters to everyone.
   - Snakes & Ladders exposes both hands.
   - Stratego spectators see A's pieces.
   - Seats are never freed when a player disconnects.
   - The player's own symbol is found by display name, so two players with the same name collide.
   - There is no WebSocket reconnect.
   - A room link loses the room ID when there is no token.
   - The `?name=` token fetch races navigation.
   - Tetris is client-trusted.
   - The root Dockerfile is broken (it copies a `requirements.txt` that doesn't exist).
   - `PORT` is set in compose but never read.
   - `X-Frame-Options: ALLOWALL` is not a valid value.
   - A weak default JWT secret is used if none is set.
   - Rule texts don't match the backend (Hangman full-word guess, Tetris scoring).
   - The "Docs vs. code" list: 6 vs. 12 games, "all real-time", Tetris "server-authoritative", RPS "best of 5", no frame headers, room-URL params "take effect immediately", spectators listed as "future".

Pages 1–8 name their related pages in bold in a "Related pages" section. A final pass turns those, and the index map, into real links (`[Title](<document_id>)`).

## Rules for writing
- **No secrets or values:** env vars are named only, never with values. Don't copy the default JWT secret string; just say "a weak hard-coded default". The Swetrix project ID is not needed either.
- Check each claim with Read, `rg` or `git` before writing it. When unsure, leave it out.
- Leave the space's `Designs & Plans` folder untouched if it appears.

## Testing / verification
- Each page lists its sources and the commit SHA.
- A final checklist:
  - All 10 pages exist in the right folders.
  - Every link resolves.
  - All 12 game keys appear in the catalog and match `games/__init__.py`.
  - No env values or secrets appear on any page (grep the page bodies for `=`-style values and the JWT default).
  - Every item under "Docs vs. code" cites a doc path and a code location.

## Out of scope
- Fixing any of the issues found, or updating the README/PRD in the repo. These could become follow-up tasks.
- A separate page per game, and copying the stock `frontend/README.md`.