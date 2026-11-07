# GH-1 — Implementation plan: GameHub Knowledge Base

## Goal
Fill the empty **GH — GameHub** KB space with 10 linked pages: a root index and 9 pages in 4 folders. Every key claim on these pages is checked against the code at a recorded commit.

## Architecture
This task writes documentation only and produces no code. Each step reads the repo files it lists, read-only, checks every claim, and saves **one** KB page with `kb_write`. Pages 1–8 come first. Each one names its related pages in bold, by exact title, in a "Related pages" section. Page 0 (the index) comes next. The last step turns the bold names and the index map into real links using the document IDs, then runs the verification checklist.

## Fixed facts (all steps)
- **KB space:** `GH — GameHub`, `space_id = 42fb5252-1af3-4de2-81af-dc727c6634b0`. At plan time it holds only the folder `Designs & Plans` (id `3f9649e0-6a3b-4ecb-84ba-9d3602a7eab3`) and no documents. **Do not touch that folder.**
- **Folder paths** (the `folder_path` of `kb_write`; missing folders are created): `Product`, `Architecture`, `Games`, `Operations & Status`. The index sits at the root, so omit `folder_path`.
- **Exact page titles:** `GameHub — Start here`, `Product overview`, `System architecture`, `WebSocket & HTTP protocol`, `Frontend`, `Game catalog`, `Adding a new game`, `Deployment & configuration`, `Known issues & docs vs. code`.
- **Link format:** `[Exact page title](<document_id>)`.
- **Commit to record:** run `git rev-parse HEAD` at the start of each step and put the full SHA in the page's **Sources** section. At plan time it is `96f9887ab619d9d5b4ce318245cfc62496bf03f5`.
- **The repository is read-only.** Make no edits, create no files and make no git commits. A step's "commit" is the saved KB page. Report its `document_id` and exact title in `complete_step`, because steps 9 and 10 need them.
- **Read-only command rules:** combine commands only with `;` or `|`. Do not use `&&`, `||`, redirection, `$`, parentheses, braces, backslashes or double quotes. Put patterns in single quotes. Prefer the Read tool for whole files.
- **No secrets or values:** name env vars only and never give their values. This includes the compose defaults in `docker-compose.yml` and the JWT default in `backend/main.py:17`. Call that default "a weak hard-coded default". Leave out the Swetrix project ID.
- **Docs vs. code line format:** `- **<doc path>** says X; the code (<code path>:<line>) does Y.`
- **Page skeleton (pages 1–8):** title H1, a one-line summary, body sections, `## Related pages` (bold exact titles), and `## Sources` (repo paths plus `Checked against commit <SHA>`).
- **"TDD" for docs:** every step starts by writing a claims checklist (the "test"). It checks each claim with Read, `rg` or `git` and drops or corrects any claim that fails. Only then does it call `kb_write`. Afterwards it calls `kb_read` on the new document to confirm the title, folder and that the Sources/SHA are present (the "pass").

## Verified facts the steps rely on (at 96f9887)
- Backend: `backend/main.py` (279 lines). `GameRoom` is at lines 63–186 and `ConnectionManager` at 189–200. Routes: `GET /` (205), `POST /auth/token` (54; an empty name returns 400), `WS /ws/{game_type}/{room_id}` with a required `token` query param (210). An `UNAUTHORIZED` error closes with code 4001 (217–221). `ROOM_TYPE_MISMATCH` includes `actual_game_type` and closes with the default code (224–234). Actions: `chat`, `move` (every key except `action` becomes a kwarg, line 252) and `restart`. The server loop runs at 1/30 s (126). `get_state_for_player` is used when it exists (148). The server adds `type`, `game_type`, `players`, `symbols` (display name → symbol) and `my_session` (159–165). `disconnect` never removes `player_symbols`/`session_names` (97–104).
- `backend/games/__init__.py`: the 12 keys `tic-tac-toe, battleships, tetris, ping-pong, connect-four, rock-paper-scissors, hangman, number-duel, minesweeper, guess-who, snakes-ladders, stratego`. An unknown key returns `None`, so the room is created with no logic.
- `on_player_join(username, existing_symbols)` is called with the **session_id** as its first argument (`main.py:90`), even though the parameter is named `username`.
- Only `ping_pong.py:13` sets `needs_server_loop = True` (`WIN_SCORE = 7`).
- RPS and Number Duel both use `WIN_ROUNDS = 3`. The RPS comment says "Best of 5" (`rock_paper_scissors.py:3`).
- `get_state_for_player` exists in `battleships.py:23` and `stratego.py:123`. Stratego maps any non-A/B symbol to `A` (124–125), so spectators see A's view.
- `guess_who.py:81–85` puts `char_A` and `char_B` in the shared state.
- `snakes_ladders.py:120–121` puts `hand_A` and `hand_B` in the shared state.
- Root `Dockerfile` holds **only comments** (no `FROM`/`COPY`), so a root build fails. Describe it that way. This corrects the design's wording "copies a requirements.txt", which the code does not support.
- `PORT` is set in `docker-compose.yml` but read nowhere: `rg -n PORT backend` finds nothing. The backend Dockerfile hard-codes `--port 8000`.
- `frontend/next.config.ts` sets `X-Frame-Options: ALLOWALL` and `Content-Security-Policy: frame-ancestors *`.
- Room page `frontend/src/app/room/[id]/page.tsx` (326 lines): `?game=` defaults to `tic-tac-toe` (24). The own symbol is looked up by display name, `data.symbols[resolvedName]` (80–81). With no token it goes to `router.push("/")` (62–64). On `UNAUTHORIZED` it clears the token and goes to `/` (89–90). `socket.onclose` is at line 98 and does not reconnect. The game switch is at lines 173–196, and every component gets `ws, gameState, mySymbol, handleRestart`.
- Lobby `frontend/src/app/page.tsx`: the params `name`, `room` and `chat` (11–13), plus `localStorage gamehub_username` and `sessionStorage gamehub_token`.
- There are no tests and no CI: there is no test directory and no `.github/` in `git ls-files`.

## File map (KB pages; nothing in the repo changes)
| # | Title | Folder | Main sources |
|---|---|---|---|
| 0 | GameHub — Start here | root | all pages, README.md |
| 1 | Product overview | Product | README.md, docs/prd.md, frontend/src/app/page.tsx |
| 2 | System architecture | Architecture | backend/main.py, backend/games/__init__.py, docker-compose.yml |
| 3 | WebSocket & HTTP protocol | Architecture | backend/main.py, room page |
| 4 | Frontend | Architecture | frontend/src/** , next.config.ts, AGENTS.md |
| 5 | Game catalog | Games | backend/games/*.py, frontend/src/components/games/*.tsx, gameRules.ts |
| 6 | Adding a new game | Games | games/__init__.py, main.py, room page, page.tsx, gameRules.ts, public/games/ |
| 7 | Deployment & configuration | Operations & Status | Dockerfiles, docker-compose.yml, env.sample, requirements.txt, package.json |
| 8 | Known issues & docs vs. code | Operations & Status | all of the above |

## Steps
1. **Write "Product overview" (Product/)**: see step detail.
2. **Write "System architecture" (Architecture/)**
3. **Write "WebSocket & HTTP protocol" (Architecture/)**
4. **Write "Frontend" (Architecture/)**
5. **Write "Game catalog" (Games/)**
6. **Write "Adding a new game" (Games/)**
7. **Write "Deployment & configuration" (Operations & Status/)**
8. **Write "Known issues & docs vs. code" (Operations & Status/)**
9. **Write "GameHub — Start here" (root index)**
10. **Link pass and final verification**

The full text of each step is in the `steps` array; it is the same text as these numbered entries.

## Final verification
- `kb_list(space_id)` and then `kb_list` on each folder: `GameHub — Start here` is at the root; Product has 1 page, Architecture 3, Games 2, Operations & Status 2. `Designs & Plans` is unchanged.
- `kb_read` each page: every `](...)` link target is one of the 10 document IDs, and no bold-only page name is left under Related pages.
- Game catalog: all 12 keys from `backend/games/__init__.py` are present: `rg -n 'game_type ==' backend/games/__init__.py`.
- Secrets: no page body contains `changeme`, `JWT_SECRET=`, `_PORT=`, `_URL=`, `localhost:8000` used as an env value, or a Swetrix ID.
- Every "Docs vs. code" line cites a doc path and a `code path:line`.
- Every page ends with Sources and the full commit SHA.
