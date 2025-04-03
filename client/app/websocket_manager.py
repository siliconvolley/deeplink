from fastapi import WebSocket
from typing import Dict, Set, List
import json


class JunctionRoomManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Store ambulance positions
        self.ambulance_positions: Dict[str, Dict] = {}
        self.junction_signals: Dict[str, Dict] = {}     # Store signal states

    async def connect(self, websocket: WebSocket, junction_id: str):
        await websocket.accept()
        if junction_id not in self.active_connections:
            self.active_connections[junction_id] = set()
        self.active_connections[junction_id].add(websocket)

    def disconnect(self, websocket: WebSocket, junction_id: str):
        self.active_connections[junction_id].remove(websocket)

    async def broadcast_to_junction(self, junction_id: str, message: dict):
        if junction_id in self.active_connections:
            for connection in self.active_connections[junction_id]:
                await connection.send_json(message)

    def get_nearest_junction(self, lat: float, lon: float) -> str:
        # TODO: Implement logic to find nearest junction based on coordinates
        # For now, return a default junction
        return "junction1"

    async def update_ambulance_position(self, junction_id: str, ambulance_id: str, position: dict):
        self.ambulance_positions[ambulance_id] = {
            "position": position,
            "junction_id": junction_id
        }
        await self.broadcast_to_junction(junction_id, {
            "type": "ambulance_update",
            "ambulance_id": ambulance_id,
            "position": position
        })

    async def update_signal_state(self, junction_id: str, signal_id: str, state: str):
        if junction_id not in self.junction_signals:
            self.junction_signals[junction_id] = {}
        self.junction_signals[junction_id][signal_id] = state
        await self.broadcast_to_junction(junction_id, {
            "type": "signal_update",
            "signal_id": signal_id,
            "state": state
        })

    async def remove_ambulance(self, ambulance_id: str):
        """Remove ambulance from tracking when it reaches its destination"""
        print(f"Removing ambulance {ambulance_id} from tracking")
        if ambulance_id in self.ambulance_positions:
            junction_id = self.ambulance_positions[ambulance_id]["junction_id"]
            del self.ambulance_positions[ambulance_id]

            # Notify all clients in the junction that ambulance has completed
            await self.broadcast_to_junction(junction_id, {
                "type": "ambulance_complete",
                "ambulance_id": ambulance_id
            })
