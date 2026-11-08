# GH-12 implementation plan: fix the vulnerable dependencies from the "NPM/Python Package Audit"

## Goal
Apply all six actions from the 2026-11-07 audit (next/eslint-config-next 16.4.5, python-jose → PyJWT, fastapi bump so starlette ≥ 1.3.1, python-multipart 0.0.33, non-forced `npm audit fix`, `node:24-alpine`) without changing how the app behaves, and keep already-issued JWTs valid.

## Architecture
This is a dependency-only change. The backend keeps its single module `backend/main.py`. Only the JWT import and the caught exception change (`import jwt`, `jwt.PyJWTError`). The tokens stay HS256 with the same payload and `JWT_SECRET`, so tokens minted by python-jose still validate. The frontend changes `frontend/package.json`, `frontend/package-lock.json` and the base image in `frontend/Dockerfile`. No app code changes unless the new Next build needs it.

## Conventions this plan relies on
- **No test framework exists**, and the design keeps it that way. Each step's "failing test" is therefore a concrete check command that fails before the change and passes after it. Do not add pytest or Vitest.
- **Python checks run in Docker** because the host has Python 3.10 and the image uses `python:3.11-slim`. Run them from the repo root:
  - Build: `docker compose build backend`
  - One-off command: `docker compose run --rm --no-deps -e JWT_SECRET=gh12-test-secret backend python -c '...'` (the WORKDIR is `/app`, so `from main import ...` works)
  - Version lookup: `docker run --rm python:3.11-slim pip index versions <pkg>`
  - `docker compose` needs a `.env` file (`env_file: .env`). If it is missing, run `cp env.sample .env` first. `.env` is git-ignored. Never commit it.
- **npm commands run on Node 24**, the version the Dockerfile will use. The host has Node 26. From `frontend/`, use `docker run --rm -v "$PWD":/app -w /app node:24-alpine <cmd>`, shown below as `N24 <cmd>`. Afterwards, delete the root-owned `node_modules` with `sudo rm -rf node_modules` if you need to, or just keep using the container.
- All pins in `backend/requirements.txt` stay exact (`==`). `next` and `eslint-config-next` stay exact pins. Never run `npm audit fix --force`, and never accept eslint-config-next 15.x.
- `frontend/AGENTS.md`: Next 16.4.5 may differ from what you know. If the build breaks, read `node_modules/next/dist/docs/` before you change app code.
- Lint baseline: **94 problems (59 errors, 35 warnings)**. It must not grow.
- Commits use Conventional Commit messages, one per step, ending with the `Co-Authored-By` trailer.

## File map
| File | Change |
|---|---|
| `backend/requirements.txt` | remove `python-jose[cryptography]==3.3.0`, add `PyJWT==<latest 2.x>`; `fastapi==<latest 0.162.x>`; `python-multipart==0.0.33`; `pydantic` raised only if fastapi requires it |
| `backend/main.py` | line 12 `from jose import jwt, JWTError` → `import jwt`; line 35 docstring `JWTError` → `jwt.PyJWTError`; line 217 `except JWTError:` → `except jwt.PyJWTError:` |
| `frontend/package.json` | `next` and `eslint-config-next` `16.2.1` → `16.4.5` |
| `frontend/package-lock.json` | regenerated, plus the `npm audit fix` result |
| `frontend/Dockerfile` | `FROM node:20-alpine` → `FROM node:24-alpine` |

## Steps

### 1. Backend: replace python-jose with PyJWT
**Before you change anything, mint a legacy token** with the current python-jose image. Steps 2 and 6 need it.
```
cp -n env.sample .env
docker compose build backend
docker compose run --rm --no-deps -e JWT_SECRET=gh12-test-secret backend python -c 'from main import create_token; print(create_token("legacy"))'
```
Save the printed token as `LEGACY_TOKEN`, for example in `/tmp/gh12-legacy-token`. It is valid for 24 h. Keep it out of the repo.

**Failing check** (write it first):
```
docker compose run --rm --no-deps -e JWT_SECRET=gh12-test-secret backend python -c 'import importlib.util as u, jwt; assert u.find_spec("jose") is None, "jose still installed"; assert u.find_spec("ecdsa") is None, "ecdsa still installed"; print(jwt.__version__)'
```
Expected now: `AssertionError: jose still installed` (or `ModuleNotFoundError: jwt`).

**Implementation**
1. Get the latest 2.x: `docker run --rm python:3.11-slim pip index versions PyJWT`.
2. In `backend/requirements.txt`, replace `python-jose[cryptography]==3.3.0` with `PyJWT==<that version>`. Do not add the `[crypto]` extra, because HS256 does not need it.
3. In `backend/main.py`:
   - line 12: `from jose import jwt, JWTError` → `import jwt`
   - line 35 docstring: `...or raises JWTError.` → `...or raises jwt.PyJWTError.`
   - line 217: `except JWTError:` → `except jwt.PyJWTError:`
   - `create_token` and `decode_token` stay exactly as they are. PyJWT 2.x `encode` returns `str`, `sub` is already a string (uuid4), and the `iat`/`exp` datetimes are converted to ints.
4. `grep -rn 'jose\|JWTError' backend/` must now show only `jwt.PyJWTError`.

**Pass checks**
```
docker compose build backend
<the failing check above>                                   # prints the PyJWT version
docker compose run --rm --no-deps -e JWT_SECRET=gh12-test-secret backend python -c 'import sys, jwt; from main import create_token, decode_token; t=create_token("alice"); assert isinstance(t,str); assert decode_token(t)["username"]=="alice"; print(decode_token(sys.argv[1])); bad=t[:-2]+("AA" if t[-2:]!="AA" else "BB"); exec("try:\n decode_token(bad)\n raise SystemExit(\"bad token accepted\")\nexcept jwt.PyJWTError:\n print(\"bad rejected\")")' "<LEGACY_TOKEN>"
python3 -m compileall -q backend
```
Expected: the legacy token decodes to `{'session_id': ..., 'username': 'legacy'}`, then the output shows `bad rejected`.

**Commit**: `fix(deps): replace python-jose with PyJWT (GH-12)`

### 2. Backend: bump fastapi (starlette ≥ 1.3.1) and python-multipart
**Failing check**
```
docker compose run --rm --no-deps backend python -c 'from importlib.metadata import version as v; from packaging.version import Version as V; s=v("starlette"); m=v("python-multipart"); print(s, m); assert V(s)>=V("1.3.1"), "starlette "+s; assert V(m)>=V("0.0.31"), "multipart "+m'
```
If `packaging` is not installed in the image, run `pip install packaging` in the same command first, for example `sh -c 'pip install -q packaging; python -c ...'`. Expected now: `AssertionError: starlette 0.37.2`.

**Implementation**
1. `docker run --rm python:3.11-slim pip index versions fastapi` → take the newest 0.162.x.
2. Find out what it requires: `docker run --rm python:3.11-slim sh -c 'pip install -q fastapi==<ver> pydantic==2.7.4 python-multipart==0.0.33 uvicorn==0.30.1 websockets==12.0 PyJWT==<ver>; pip show starlette | grep Version'`. If pip reports a conflict on pydantic, read the fastapi requirement with `pip install fastapi==<ver> --dry-run --report - --quiet` or `pip show fastapi`. Then raise `pydantic` to the **lowest** version that satisfies it, and repeat the check. Do the same for a uvicorn or websockets conflict, but only if pip forces it.
3. Edit `backend/requirements.txt` (exact pins): `fastapi==<0.162.x>`, `python-multipart==0.0.33`, and `pydantic` only if step 2 required it.
4. Look for deprecations: start the app and read the startup output (`docker compose run --rm --no-deps backend python -W error::DeprecationWarning -c 'import main'`. If that fails on a third-party warning, use `-W default` and read the output). Make the smallest fix only for warnings that point at `main.py` (CORSMiddleware, `@app.websocket`, `HTTPException`, `BaseModel`). None are expected.

**Pass checks**
```
docker compose build backend
<the failing check above>                                    # starlette >= 1.3.1, multipart 0.0.33
docker run --rm -v "$PWD/backend":/src python:3.11-slim sh -c 'pip install -q pip-audit; pip-audit -r /src/requirements.txt'
python3 -m compileall -q backend
```
Expected: pip-audit prints `No known vulnerabilities found`. Run the step 1 token check again with `LEGACY_TOKEN`. It must still pass.

**Commit**: `fix(deps): bump fastapi and python-multipart to fix starlette/multipart CVEs (GH-12)`

### 3. Frontend: upgrade next and eslint-config-next to 16.4.5
**Baseline first** (in `frontend/`, Node 24): `N24 npm ci`, then `N24 npx eslint 2>&1 | tail -3`. Record the count, which should be 94. `N24 npm audit` must show `next` as critical.

**Failing check**: `N24 node -e 'const v=require("next/package.json").version; if(v!=="16.4.5"){console.error("next "+v);process.exit(1)}'` prints `next 16.2.1` and exits 1.

**Implementation**
1. `N24 npm install --save-exact next@16.4.5 eslint-config-next@16.4.5`.
2. `frontend/package.json` must now read `"next": "16.4.5"` and `"eslint-config-next": "16.4.5"`, and nothing else may change. `@types/node` stays `^20`.
3. If the build or tsc breaks, read `node_modules/next/dist/docs/` and make the smallest app-code fix.

**Pass checks** (in `frontend/`, Node 24)
```
N24 node -e '...the failing check...'      # exits 0
N24 npx tsc --noEmit
N24 npm run build
N24 npx eslint 2>&1 | tail -3              # <= 94 problems
N24 npm audit                              # no critical; next/postcss/sharp gone
```
**Commit**: `fix(deps): upgrade next and eslint-config-next to 16.4.5 (GH-12)`

### 4. Frontend: non-forced `npm audit fix` for transitive advisories
**Failing check**: `N24 npm audit --audit-level=high` exits non-zero, with the transitive high advisories listed (brace-expansion, picomatch, js-yaml, nanoid, browserslist, source-map-js, zod, …).

**Implementation**
1. `N24 npm audit fix`. **Never** pass `--force`.
2. `git diff frontend/package.json` must be empty, or show only in-range changes. If npm changed `eslint-config-next` to 15.x or changed any major version, revert `package.json` and do not keep that change.
3. Save the remaining output: `N24 npm audit` → note each leftover advisory, its package, severity and why it is unfixable without a major or downgrade. The expected leftover is the moderate, dev-only typescript-eslint/minimatch chain. This list goes into the PR description.
4. If a high advisory remains that a same-major `overrides` entry could fix, stop and report it in the PR list rather than adding overrides. The design does not ask for overrides.

**Pass checks**
```
N24 npm audit --audit-level=high           # exits 0 (no critical/high)
N24 npx tsc --noEmit
N24 npm run build
N24 npx eslint 2>&1 | tail -3              # <= 94 problems
```
**Commit**: `fix(deps): apply npm audit fix for transitive advisories (GH-12)`

### 5. Frontend: move the Docker image to node:24-alpine
**Failing check**: `grep -c '^FROM node:24-alpine$' frontend/Dockerfile` prints `0`.

**Implementation**: in `frontend/Dockerfile` line 1, change `FROM node:20-alpine` to `FROM node:24-alpine`. Change nothing else.

**Pass checks** (repo root)
```
grep -c '^FROM node:24-alpine$' frontend/Dockerfile        # 1
docker compose build frontend                               # npm install + next build succeed on Node 24
docker compose run --rm --no-deps frontend node --version   # v24.x
```
**Commit**: `chore(docker): move frontend image to node:24-alpine (GH-12)`

### 6. End-to-end smoke test and PR notes
No code change is expected. Commit only if a smoke failure forces a fix.

1. `JWT_SECRET=gh12-test-secret docker compose up --build -d`
2. Root check: `curl -s localhost:8000/` returns `{"status":"ok",...}`. The frontend `curl -sI localhost:3000` returns 200.
3. Token: `curl -s -X POST localhost:8000/auth/token -H 'Content-Type: application/json' -d '{"username":"alice"}'` returns `{"token":"..."}`. An empty username returns 400.
4. WebSocket, using the `websockets` library already in the backend image:
```
docker compose exec backend python -c 'import asyncio, json, sys, websockets
async def go(tok):
    async with websockets.connect("ws://localhost:8000/ws/tic-tac-toe/gh12room?token="+tok) as ws:
        await ws.send(json.dumps({"action":"move","index":0}))
        for _ in range(5):
            print(await asyncio.wait_for(ws.recv(), 3))
asyncio.run(go(sys.argv[1]))' "<token from step 3>"
```
   Expected: state messages arrive with no `UNAUTHORIZED` error. A single player may not be able to move until a second player joins. In that case, open a second connection with a second token in the same script to confirm a move gets broadcast.
5. Bad token: run the same script with `token=garbage`. Expect `{"type":"error","code":"UNAUTHORIZED",...}`, then close code 4001.
6. Legacy token: run the same script with `LEGACY_TOKEN` from step 1, which was minted by python-jose with `gh12-test-secret`. It must join without `UNAUTHORIZED`. If more than 24 h have passed, mint a new one by checking out the commit before step 1 and repeating step 1's minting.
7. `docker compose down`.
8. Write the PR description: the version changes (PyJWT, fastapi, starlette, python-multipart, pydantic if raised, next/eslint-config-next, node image), the pip-audit result, and the list of leftover `npm audit` advisories from step 4 with the reason for each.

## Final verification
```
# backend
python3 -m compileall -q backend
grep -rn 'jose' backend/ ; echo 'expect no output above'
docker run --rm -v "$PWD/backend":/src python:3.11-slim sh -c 'pip install -q pip-audit; pip-audit -r /src/requirements.txt'
# frontend (in frontend/, Node 24)
N24 npx tsc --noEmit
N24 npm run build
N24 npx eslint 2>&1 | tail -3          # <= 94 problems
N24 npm audit --audit-level=high       # exit 0
# whole stack
docker compose up --build              # plus step 6 smoke checks
```
