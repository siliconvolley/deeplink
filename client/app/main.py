from fastapi import FastAPI, Request, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from pymongo import MongoClient
from datetime import datetime, timedelta
import bcrypt
import jwt
from typing import Optional, Dict, List, Literal, Any
from math import radians, sin, cos, sqrt, atan2
import httpx
import json
from .websocket_manager import JunctionRoomManager

app = FastAPI()
security = HTTPBearer()

# Static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Configuration
SECRET_KEY = "yourSecretKey"  # Use environment variable in production
client = MongoClient('mongodb://localhost:27017/')
db = client['Hospital']

# MongoDB Collections
emergencies_collection = db['emergencies']
hospitals_collection = db['hospitals']
junctions_collection = db['junctions']

# Verify MongoDB connection
try:
    client.admin.command('ismaster')
    print("MongoDB connected successfully")
except Exception as e:
    print("Failed to connect to MongoDB. Error:", e)

# Pydantic models
class LoginData(BaseModel):
    hospitalName: str
    password: str

class PatientData(BaseModel):
    hospitalName: str
    severity: str
    emergencyType: str
    eta: int
    additionalInfo: str | None = None
    patient_id: str | None = None

class TrafficLightState(BaseModel):
    id: str
    lat: float
    lon: float
    status: Literal["RED", "GREEN"]

class TriggerPoint(BaseModel):
    id: str
    lat: float
    lon: float
    controlsSignal: str
    direction: str

class JunctionConfig(BaseModel):
    signals: List[str]
    triggers: List[str]

class RouteRequest(BaseModel):
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float

class RouteResponse(BaseModel):
    coordinates: List[Dict[str, float]]
    eta: int
    distance: float
    summary: Dict[str, Any]

# Traffic Management State
traffic_lights: Dict[str, TrafficLightState] = {}
trigger_points: Dict[str, TriggerPoint] = {}
junction_config: Dict[str, JunctionConfig] = {}

# Authentication dependency
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        if not credentials:
            raise HTTPException(status_code=403, detail="No credentials provided")
            
        token = credentials.credentials
        if token.startswith('Bearer '):
            token = token.split(' ')[1]
            
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            if not payload.get("hospitalName"):
                raise HTTPException(status_code=403, detail="Invalid token payload")
            return payload
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=403, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=403, detail=str(e))

# Utility functions
def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points on Earth"""
    R = 6371  # Earth's radius in kilometers

    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return R * c

# Routes
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("landing.html", {"request": request})

@app.get("/ambulance", response_class=HTMLResponse)
async def ambulance_page(request: Request):
    return templates.TemplateResponse("ambulance.html", {"request": request})

@app.get("/hospital-login", response_class=HTMLResponse)
async def hospital_login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})

@app.post("/api/login")
async def login(data: LoginData):
    hospital = hospitals_collection.find_one({"hospitalName": data.hospitalName})
    
    if not hospital:
        raise HTTPException(status_code=401, detail="Invalid credentials: Hospital Not Found")

    if bcrypt.checkpw(data.password.encode('utf-8'), hospital['password'].encode('utf-8')):
        token = jwt.encode(
            {
                "hospitalName": data.hospitalName,
                "exp": datetime.utcnow() + timedelta(hours=24)  # Token expires in 24 hours
            },
            SECRET_KEY,
            algorithm="HS256"
        )
        return {"token": token}
    
    raise HTTPException(status_code=401, detail="Invalid credentials: Wrong Password")

@app.get("/api/patients")
async def get_patients(payload: dict = Depends(verify_token)):
    hospital_name = payload.get('hospitalName')
    incoming_patients = list(emergencies_collection.find({"hospitalName": hospital_name}))
    
    # Convert ObjectId to string for JSON serialization
    for patient in incoming_patients:
        patient['_id'] = str(patient['_id'])
    
    return incoming_patients

@app.get("/api/nearest-hospital")
async def find_nearest_hospital(lat: float, lon: float):
    """Find nearest hospital using Overpass API"""
    overpass_url = f"https://overpass-api.de/api/interpreter?data=[out:json];node[amenity=hospital](around:13000,{lat},{lon});out;"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(overpass_url)
            data = response.json()
            
            if not data["elements"]:
                raise HTTPException(status_code=404, detail="No hospitals found within range")
            
            nearest = min(
                data["elements"],
                key=lambda hospital: haversine(
                    lat, lon,
                    hospital["lat"],
                    hospital["lon"]
                )
            )
            
            return {
                "hospital": {
                    "name": nearest.get("tags", {}).get("name", "Unknown Hospital"),
                    "lat": nearest["lat"],
                    "lon": nearest["lon"]
                }
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/submit-patient")
async def submit_patient(data: PatientData):
    current_timestamp = datetime.now().isoformat()
    hospital = hospitals_collection.find_one({"hospitalName": data.hospitalName})

    if not hospital:
        default_password = '123456'  # This should be securely handled
        hashed_password = bcrypt.hashpw(default_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        new_hospital = {
            "hospitalName": data.hospitalName,
            "password": hashed_password
        }
        hospitals_collection.insert_one(new_hospital)
        print(f"New hospital created: {data.hospitalName}")

    emergency_data = {
        "hospitalName": data.hospitalName,
        "severity": data.severity,
        "emergencyType": data.emergencyType,
        "eta": data.eta,
        "timestamp": current_timestamp,
        "patient-id": data.patient_id
    }
    emergencies_collection.insert_one(emergency_data)
    
    return {"message": "Patient data submitted successfully!"}

@app.post("/api/traffic/update")
async def update_traffic_light(light_id: str, new_status: Literal["RED", "GREEN"]):
    """Update traffic light status"""
    if light_id not in traffic_lights:
        raise HTTPException(status_code=404, detail="Traffic light not found")
    
    traffic_lights[light_id].status = new_status
    return {"message": f"Traffic light {light_id} updated to {new_status}"}

@app.get("/api/traffic/state")
async def get_traffic_state():
    """Get current state of all traffic lights"""
    return {
        "trafficLights": traffic_lights,
        "triggerPoints": trigger_points,
        "junctionConfig": junction_config
    }

@app.post("/api/traffic/initialize")
async def initialize_traffic_system(config: Dict):
    """Initialize traffic system with configuration"""
    try:
        # Clear existing state
        traffic_lights.clear()
        trigger_points.clear()
        junction_config.clear()
        
        # Load new configuration
        for id, light in config["trafficLights"].items():
            traffic_lights[id] = TrafficLightState(**light)
            
        for id, trigger in config["triggerPoints"].items():
            trigger_points[id] = TriggerPoint(**trigger)
            
        for id, junction in config["junctionConfig"].items():
            junction_config[id] = JunctionConfig(**junction)
            
        return {"message": "Traffic system initialized successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("startup")
async def startup_event():
    try:
        # Load initial configuration
        with open("static/traffic-config.json") as f:
            config = json.load(f)
            
        # Initialize traffic system
        for id, light in config["trafficLights"].items():
            traffic_lights[id] = TrafficLightState(**light)
            
        for id, trigger in config["triggerPoints"].items():
            trigger_points[id] = TriggerPoint(**trigger)
            
        for id, junction in config["junctionConfig"].items():
            junction_config[id] = JunctionConfig(**junction)
            
        print("Traffic system initialized successfully")
    except Exception as e:
        print(f"Error initializing traffic system: {e}")

# WebSocket functionality
junction_manager = JunctionRoomManager()

@app.websocket("/ws/{junction_id}")
async def websocket_endpoint(websocket: WebSocket, junction_id: str):
    await junction_manager.connect(websocket, junction_id)
    try:
        while True:
            data = await websocket.receive_json()
            if data["type"] == "ambulance_position":
                await junction_manager.update_ambulance_position(
                    junction_id,
                    data["ambulance_id"],
                    data["position"]
                )
            elif data["type"] == "signal_state":
                await junction_manager.update_signal_state(
                    junction_id,
                    data["signal_id"],
                    data["state"]
                )
    except WebSocketDisconnect:
        junction_manager.disconnect(websocket, junction_id)

@app.get("/api/nearest-junction")
async def get_nearest_junction(lat: float, lon: float):
    """Find the nearest junction based on coordinates"""
    return {"junctionId": junction_manager.get_nearest_junction(lat, lon)}
