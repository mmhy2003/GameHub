# GH-12: Fix the vulnerable dependencies from the "NPM/Python Package Audit"

## Goal
Fix the problems the 2026-11-07 dependency audit (KB page "NPM/Python Package Audit") reported: the critical Next.js RCE/SSRF, the backend CVEs (starlette, python-multipart, python-jose, ecdsa) and the end-of-life Node 20 image. Players see no change in behaviour, and existing JWTs keep working.

## Decisions
- **Scope: all six audit actions** (human's choice). That is the five security fixes plus the Node 20 → 24 image move. Rejected: security fixes only; also doing minor and patch bumps of packages that are not vulnerable.
- **Replace python-jose with PyJWT** (human's choice). Even python-jose 3.5.0 has unfixed CVEs (CVE-2024-29370, CVE-2026-85394, and ecdsa CVE-2024-23342). PyJWT removes both python-jose and ecdsa. Rejected: upgrading to 3.5.0 and accepting the risk.
- Packages that are not vulnerable stay where they are (react/react-dom 19.2.4, lucide-react, swetrix, uvicorn, websockets). The one exception: a security bump that requires a newer version of a package (for example pydantic for the new fastapi) may raise it to the lowest compatible version.
- Following the audit's note, we do **not** take npm's suggested downgrade of eslint-config-next to 15.x, and we never run `npm audit fix --force`.

## Changes

### Frontend
- `frontend/package.json`: `next` and `eslint-config-next` 16.2.1 → **16.4.5**, both exact pins as today. This also brings the fixed postcss and sharp.
- `frontend/package-lock.json`: regenerate the lock after the bump, then run a plain `npm audit fix` for the transitive advisories (brace-expansion, picomatch, js-yaml, nanoid, browserslist, source-map-js, zod, …). If an advisory can only be fixed by a major bump of a direct dependency, leave it and list it in the PR. Expected leftover: the moderate, dev-only typescript-eslint/minimatch chain.
- `frontend/Dockerfile`: `FROM node:20-alpine` → `FROM node:24-alpine`. Nothing else changes. `@types/node` stays at `^20` (types only, out of scope).

### Backend
- `backend/requirements.txt`, all pins exact (`==`) as today:
  - `fastapi` 0.111.0 → the current release (0.162.x), so starlette resolves to ≥ 1.3.1.
  - `pydantic` → only if the new fastapi requires it, then the lowest version it accepts.
  - `python-multipart` 0.0.9 → 0.0.33.
  - `python-jose[cryptography]==3.3.0` → removed, replaced by `PyJWT==<latest 2.x>`.
- `backend/main.py` (the only JWT user):
  - `from jose import jwt, JWTError` → `import jwt` and catch `jwt.PyJWTError` (line ~217).
  - `jwt.encode` and `jwt.decode(..., algorithms=["HS256"])` keep the same calls. PyJWT returns `str` from `encode`, the same as today. The token payload, the 24 h expiry and `JWT_SECRET` do not change, so tokens issued before the deploy still validate.
- If the new fastapi/starlette deprecates something `main.py` uses (CORSMiddleware, `@app.websocket`, `HTTPException`, a `BaseModel` body), make the smallest fix needed. None is expected.

## Error handling and edge cases
- An expired or bad token must still cause the same WebSocket rejection path. `jwt.PyJWTError` is the base class of `ExpiredSignatureError` and `InvalidSignatureError`, so it covers both.
- Next 16.4.5 may differ from what we know (`frontend/AGENTS.md`). If the build breaks, check `node_modules/next/dist/docs/` before changing app code.

## Testing
The repo has no automated tests (adding them is a separate task). Verification:
1. Frontend: `npx tsc --noEmit` passes. `npm run build` succeeds on Node 24. `npx eslint` reports no more than the 94 problems that exist today. `npm audit` shows no critical or high advisories, and any leftover is listed in the PR.
2. Backend: `python3 -m compileall backend` passes. `pip-audit -r backend/requirements.txt`, or an equivalent check, reports no known CVEs.
3. Smoke test with `docker compose up --build`: `POST /auth/token` returns a token, a WebSocket connection to `/ws/tic_tac_toe/<room>?token=…` with that token joins and plays a move, and a bad token is rejected. A token minted by the old python-jose build still validates under PyJWT (HS256 compatibility).

## Out of scope
- Updating packages that are not vulnerable, and major bumps (lucide-react 1.x, react 19.3, @types/node).
- Fixing the existing lint problems, adding pytest or Vitest, CI.
- Other audit-adjacent items: the weak `JWT_SECRET` default, the unread `PORT`, the unbuildable root `Dockerfile`.
