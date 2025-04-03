from pydantic import BaseModel
from typing import Dict, List, Literal, Any

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
    status: Literal["GREEN", "RED"]

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