from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from pymongo import MongoClient
from datetime import datetime, timedelta
import bcrypt
import jwt
from typing import Optional

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)