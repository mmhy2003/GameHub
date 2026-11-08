import json
import os
import time
import uuid
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import jwt

from games import get_game_logic

# ── JWT config ────────────────────────────────────────────────────────────────
JWT_SECRET    = os.environ.get("JWT_SECRET", "changeme-use-a-real-secret-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXP_HOURS = 24

if JWT_SECRET == "changeme-use-a-real-secret-in-production":
    print("⚠️  WARNING: JWT_SECRET is not set. Using a weak default — set JWT_SECRET in your .env for production.")

def create_token(username: str) -> str:
    session_id = str(uuid.uuid4())
    payload = {
        "sub":        session_id,
        "username":   username,
        "iat":        datetime.now(timezone.utc),
        "exp":        datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    """Returns {"session_id": ..., "username": ...} or raises jwt.PyJWTError."""
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    return {"session_id": payload["sub"], "username": payload["username"]}

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(title="GameHub Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth endpoint ─────────────────────────────────────────────────────────────
class TokenRequest(BaseModel):
    username: str

@app.post("/auth/token")
def get_token(body: TokenRequest):
    name = body.username.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Username cannot be empty.")
    token = create_token(name)
    return {"token": token}

# ── Game room ─────────────────────────────────────────────────────────────────
class GameRoom:
    def __init__(self, room_id: str, game_type: str = "tic-tac-toe"):
        self.room_id   = room_id
        self.game_type = game_type
        self.players:  List[WebSocket]         = []

        # ws → display username
        self.player_names:    Dict[WebSocket, str] = {}
        # ws → session_id (UUID)
        self.player_sessions: Dict[WebSocket, str] = {}

        # session_id → game symbol ("A"/"B"/"X"/"O" etc.)
        self.player_symbols:  Dict[str, str]       = {}
        # session_id → display username (for broadcasts)
        self.session_names:   Dict[str, str]       = {}

        self.game_logic = get_game_logic(game_type)
        self.loop_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket, session_id: str, username: str):
        await websocket.accept()
        self.players.append(websocket)
        self.player_names[websocket]    = username
        self.player_sessions[websocket] = session_id
        self.session_names[session_id]  = username

        if self.game_logic and hasattr(self.game_logic, "on_player_join"):
            symbol = self.game_logic.on_player_join(session_id, self.player_symbols)
            if symbol is not None:
                self.player_symbols[session_id] = symbol

        await self.broadcast_chat("System", f"{username} joined the room.")
        await self.broadcast_state()

    def disconnect(self, websocket: WebSocket):
        if websocket in self.players:
            username   = self.player_names.get(websocket, "Unknown")
            self.players.remove(websocket)
            self.player_names.pop(websocket, None)
            self.player_sessions.pop(websocket, None)
            return username
        return None

    def make_move(self, session_id: str, **kwargs):
        if not self.game_logic:
            return False
        symbol = self.player_symbols.get(session_id)
        if not symbol:
            return False
        return self.game_logic.make_move(symbol=symbol, **kwargs)

    def reset_game(self):
        if self.game_logic:
            self.game_logic.reset()

    def maybe_start_loop(self):
        if (self.game_logic and
                getattr(self.game_logic, "needs_server_loop", False) and
                getattr(self.game_logic, "phase", "") == "playing" and
                (self.loop_task is None or self.loop_task.done())):
            self.loop_task = asyncio.create_task(self._game_loop())

    async def _game_loop(self):
        tick_rate = 1 / 30
        while (self.game_logic and
               getattr(self.game_logic, "phase", "") == "playing" and
               len(self.players) > 0):
            self.game_logic.tick()
            await self.broadcast_state()
            if getattr(self.game_logic, "winner", None):
                win_sym  = self.game_logic.winner
                win_sid  = next((s for s, sym in self.player_symbols.items() if sym == win_sym), None)
                win_name = self.session_names.get(win_sid, win_sym) if win_sid else win_sym
                await self.broadcast_chat("System", f"{win_name} won the game!")
                break
            await asyncio.sleep(tick_rate)

    async def broadcast_state(self):
        # Build display-friendly symbols map: session_id → symbol, plus names
        for connection in list(self.players):
            session_id = self.player_sessions.get(connection)
            symbol     = self.player_symbols.get(session_id) if session_id else None

            game_state: dict = {}
            if self.game_logic:
                if hasattr(self.game_logic, "get_state_for_player"):
                    game_state = self.game_logic.get_state_for_player(symbol)
                else:
                    game_state = self.game_logic.get_state()

            # Build a name→symbol map for UI display (keeps frontend working with names)
            name_symbol_map = {
                self.session_names.get(sid, sid): sym
                for sid, sym in self.player_symbols.items()
            }

            game_state.update({
                "type":       "game_state",
                "game_type":  self.game_type,
                "players":    list(name_symbol_map.keys()),
                "symbols":    name_symbol_map,
                "my_session": session_id,
            })

            try:
                await connection.send_json(game_state)
            except Exception:
                pass

    async def broadcast_chat(self, sender: str, message: str):
        msg = {
            "type":      "chat",
            "sender":    sender,
            "message":   message,
            "timestamp": int(time.time() * 1000),
        }
        await self.broadcast_json(msg)

    async def broadcast_json(self, data: dict):
        for connection in list(self.players):
            try:
                await connection.send_json(data)
            except Exception:
                pass

# ── Connection manager ────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, GameRoom] = {}

    def get_or_create_room(self, room_id: str, game_type: str = "tic-tac-toe") -> GameRoom:
        if room_id not in self.rooms:
            self.rooms[room_id] = GameRoom(room_id, game_type)
        return self.rooms[room_id]

    def remove_room_if_empty(self, room_id: str):
        if room_id in self.rooms and len(self.rooms[room_id].players) == 0:
            del self.rooms[room_id]

manager = ConnectionManager()

# ── HTTP health check ─────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"status": "ok", "message": "GameHub Backend API is running."}

# ── WebSocket endpoint ────────────────────────────────────────────────────────
@app.websocket("/ws/{game_type}/{room_id}")
async def websocket_endpoint(websocket: WebSocket, game_type: str, room_id: str, token: str):
    # ── Validate JWT ─────────────────────────────────────────────────────────
    try:
        claims     = decode_token(token)
        session_id = claims["session_id"]
        username   = claims["username"]
    except jwt.PyJWTError:
        await websocket.accept()
        await websocket.send_json({"type": "error", "code": "UNAUTHORIZED", "message": "Invalid or expired token. Please refresh the page."})
        await websocket.close(code=4001)
        return

    # ── Room type conflict check ──────────────────────────────────────────────
    existing_room = manager.rooms.get(room_id)
    if existing_room and existing_room.game_type != game_type:
        await websocket.accept()
        await websocket.send_json({
            "type":             "error",
            "code":             "ROOM_TYPE_MISMATCH",
            "actual_game_type": existing_room.game_type,
            "message":          f"Room '{room_id}' is already running a '{existing_room.game_type}' game.",
        })
        await websocket.close()
        return

    room = manager.get_or_create_room(room_id, game_type)
    await room.connect(websocket, session_id, username)
    room.maybe_start_loop()

    try:
        while True:
            data   = await websocket.receive_text()
            parsed = json.loads(data)
            action = parsed.get("action")

            if action == "chat":
                msg = parsed.get("message", "")
                if msg:
                    await room.broadcast_chat(username, msg)

            elif action == "move":
                move_kwargs = {k: v for k, v in parsed.items() if k != "action"}
                success = room.make_move(session_id, **move_kwargs)
                if success:
                    if not getattr(room.game_logic, "needs_server_loop", False):
                        await room.broadcast_state()
                        if room.game_logic and getattr(room.game_logic, "winner", None):
                            win_sym  = room.game_logic.winner
                            win_sid  = next((s for s, sym in room.player_symbols.items() if sym == win_sym), None)
                            win_name = room.session_names.get(win_sid, username) if win_sid else username
                            await room.broadcast_chat("System", f"{win_name} won the game!")
                        elif room.game_logic and getattr(room.game_logic, "is_draw", None):
                            await room.broadcast_chat("System", "The game ended in a draw.")
                    else:
                        await room.broadcast_state()
                        room.maybe_start_loop()

            elif action == "restart":
                room.reset_game()
                await room.broadcast_state()
                await room.broadcast_chat("System", f"Game restarted by {username}.")

    except WebSocketDisconnect:
        disc_user = room.disconnect(websocket)
        manager.remove_room_if_empty(room_id)
        if room_id in manager.rooms and disc_user:
            await manager.rooms[room_id].broadcast_chat("System", f"{disc_user} left the room.")
            await manager.rooms[room_id].broadcast_state()
