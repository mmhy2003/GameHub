import json
import time
import asyncio
from typing import Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from games import get_game_logic

app = FastAPI(title="GameHub Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GameRoom:
    def __init__(self, room_id: str, game_type: str = "tic-tac-toe"):
        self.room_id = room_id
        self.game_type = game_type
        self.players: List[WebSocket] = []
        self.player_names: Dict[WebSocket, str] = {}

        # Instantiate game-specific logic
        self.game_logic = get_game_logic(game_type)

        # Player symbols (username -> symbol, e.g. X/O or L/R)
        self.player_symbols: Dict[str, str] = {}

        # Background game loop task (used by real-time games like Ping-Pong)
        self.loop_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        self.players.append(websocket)
        self.player_names[websocket] = username

        # Delegate player/symbol assignment to the game logic
        if self.game_logic and hasattr(self.game_logic, "on_player_join"):
            symbol = self.game_logic.on_player_join(username, self.player_symbols)
            if symbol is not None:
                self.player_symbols[username] = symbol

        await self.broadcast_chat("System", f"{username} joined the room.")
        await self.broadcast_state()

    def disconnect(self, websocket: WebSocket):
        if websocket in self.players:
            username = self.player_names.get(websocket, "Unknown")
            self.players.remove(websocket)
            if websocket in self.player_names:
                del self.player_names[websocket]
            return username
        return None

    def make_move(self, username: str, **kwargs):
        if not self.game_logic:
            return False

        symbol = self.player_symbols.get(username)
        if not symbol:
            return False

        success = self.game_logic.make_move(symbol=symbol, **kwargs)
        return success

    def reset_game(self):
        if self.game_logic:
            self.game_logic.reset()

    def maybe_start_loop(self):
        """Starts the server game loop for real-time games (e.g. Ping-Pong) if needed."""
        if (self.game_logic and
                getattr(self.game_logic, "needs_server_loop", False) and
                getattr(self.game_logic, "phase", "") == "playing" and
                (self.loop_task is None or self.loop_task.done())):
            self.loop_task = asyncio.create_task(self._game_loop())

    async def _game_loop(self):
        """30fps server-authoritative game loop for real-time games."""
        tick_rate = 1 / 30
        while (self.game_logic and
               getattr(self.game_logic, "phase", "") == "playing" and
               len(self.players) > 0):
            self.game_logic.tick()
            await self.broadcast_state()
            # Announce winner when game finishes
            if getattr(self.game_logic, "winner", None):
                win_sym = self.game_logic.winner
                win_name = next(
                    (u for u, s in self.player_symbols.items() if s == win_sym),
                    win_sym
                )
                await self.broadcast_chat("System", f"{win_name} won the game!")
                break
            await asyncio.sleep(tick_rate)

    async def broadcast_state(self):
        for connection in list(self.players):
            username = self.player_names.get(connection)
            symbol = self.player_symbols.get(username)

            game_state = {}
            if self.game_logic:
                if hasattr(self.game_logic, "get_state_for_player"):
                    game_state = self.game_logic.get_state_for_player(symbol)
                else:
                    game_state = self.game_logic.get_state()

            game_state.update({
                "type": "game_state",
                "game_type": self.game_type,
                "players": list(self.player_symbols.keys()),
                "symbols": self.player_symbols,
            })

            try:
                await connection.send_json(game_state)
            except Exception:
                pass

    async def broadcast_chat(self, sender: str, message: str):
        msg = {
            "type": "chat",
            "sender": sender,
            "message": message,
            "timestamp": int(time.time() * 1000)
        }
        await self.broadcast_json(msg)

    async def broadcast_json(self, data: dict):
        for connection in list(self.players):
            try:
                await connection.send_json(data)
            except Exception:
                pass

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

@app.get("/")
def read_root():
    return {"status": "ok", "message": "GameHub Backend API is running."}

@app.websocket("/ws/{game_type}/{room_id}")
async def websocket_endpoint(websocket: WebSocket, game_type: str, room_id: str, username: str):
    # Check for game type conflict before joining
    existing_room = manager.rooms.get(room_id)
    if existing_room and existing_room.game_type != game_type:
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "code": "ROOM_TYPE_MISMATCH",
            "actual_game_type": existing_room.game_type,
            "message": f"Room '{room_id}' is already running a '{existing_room.game_type}' game. Use a different room code or join the existing game."
        })
        await websocket.close()
        return

    room = manager.get_or_create_room(room_id, game_type)
    await room.connect(websocket, username)
    room.maybe_start_loop()  # Resume loop if reconnecting to a live game

    try:
        while True:
            data = await websocket.receive_text()
            parsed = json.loads(data)

            action = parsed.get("action")

            if action == "chat":
                msg = parsed.get("message", "")
                if msg:
                    await room.broadcast_chat(username, msg)

            elif action == "move":
                move_kwargs = {k: v for k, v in parsed.items() if k != "action"}
                success = room.make_move(username, **move_kwargs)
                if success:
                    # For real-time games the loop broadcasts; for turn-based we broadcast here
                    if not getattr(room.game_logic, "needs_server_loop", False):
                        await room.broadcast_state()
                        if room.game_logic and getattr(room.game_logic, "winner", None):
                            win_sym = room.game_logic.winner
                            win_name = next((u for u, s in room.player_symbols.items() if s == win_sym), username)
                            await room.broadcast_chat("System", f"{win_name} won the game!")
                        elif room.game_logic and getattr(room.game_logic, "is_draw", None):
                            await room.broadcast_chat("System", "The game ended in a draw.")
                    else:
                        # Broadcast once for lobby state changes, then maybe start loop
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
