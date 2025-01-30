from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS 
from pymongo import MongoClient
import bcrypt  
from datetime import datetime
import jwt
import os

app = Flask(__name__)
CORS(app)  

# Configuration
app.config['SECRET_KEY'] = 'yourSecretKey'  # Use environment variable in production
client = MongoClient('mongodb://localhost:27017/')
db = client['Hospital'] 
emergencies_collection = db['emergencies']  
hospitals_collection = db['hospitals'] 
junctions_collection = db['junctions']

# Authentication decorator
def authenticate_token(f):
    def wrapper(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({"error": "No token provided"}), 403
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            return f(*args, **kwargs)
        except:
            return jsonify({"error": "Invalid token"}), 403
    wrapper.__name__ = f.__name__
    return wrapper

# Routes
@app.route('/')
def index():
    return render_template('landing.html')

@app.route('/ambulance')
def ambulance_page():
    return render_template('ambulance.html')

@app.route('/hospital-login')
def hospital_login():
    return render_template('login.html')

@app.route('/api/login', methods=['POST'])
def login():
    try:
        if request.is_json:
            data = request.json
        else:
            data = request.form
        
        # Debug prints
        print("Received data:", data)
        
        hospital_name = data.get('hospitalName')
        password = data.get('password')
        
        print("Looking for hospital:", hospital_name)
        
        # Test MongoDB connection
        try:
            hospital = hospitals_collection.find_one({"hospitalName": hospital_name})
            print("Found hospital:", hospital)
        except Exception as e:
            print("MongoDB error:", str(e))
            return jsonify({"message": "Database error"}), 500

        if not hospital_name or not password:
            return jsonify({"message": "Hospital name and password are required"}), 400

        if not hospital:
            return jsonify({"message": "Invalid credentials: Hospital Not Found"}), 401

        # Debug print for password verification
        print("Attempting password verification")
        stored_password = hospital['password']
        
        if bcrypt.checkpw(password.encode('utf-8'), stored_password.encode('utf-8')):
            try:
                # Create token with explicit string conversion
                token_payload = {"hospitalName": str(hospital_name)}
                secret_key = str(app.config['SECRET_KEY'])
                
                token = jwt.encode(
                    payload=token_payload,
                    key=secret_key,
                    algorithm="HS256"
                )
                print("Token generated successfully:", token)
                return jsonify({"token": token, "message": "Login successful"})
            except Exception as e:
                print("Token generation error:", str(e))
                return jsonify({"message": "Error generating token"}), 500
        else:
            return jsonify({"message": "Invalid credentials: Wrong Password"}), 401
            
    except Exception as e:
        print("Login error:", str(e))
        return jsonify({"message": "Server error", "error": str(e)}), 500

@app.route('/api/patients', methods=['GET'])
@authenticate_token
def get_patients():
    token = request.headers.get('Authorization')
    data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
    hospital_name = data.get('hospitalName')

    incoming_patients = list(emergencies_collection.find({"hospitalName": hospital_name}))
    # Convert ObjectId to string for JSON serialization
    for patient in incoming_patients:
        patient['_id'] = str(patient['_id'])
    
    return jsonify(incoming_patients)

@app.route('/submit-patient', methods=['POST', 'OPTIONS'])  # Added OPTIONS method
def submit_patient():
    if request.method == 'OPTIONS':
        return '', 204 
    data = request.json
    current_timestamp = datetime.now().isoformat()

    if not all(key in data for key in ('hospitalName', 'severity', 'emergencyType', 'eta')):
        return jsonify({"error": "Missing data"}), 400

    hospital_name = data['hospitalName']
    hospital = hospitals_collection.find_one({"hospitalName": hospital_name})

    if not hospital:
        default_password = '123456'  # This should be securely handled
        hashed_password = bcrypt.hashpw(default_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        new_hospital = {
            "hospitalName": hospital_name,
            "password": hashed_password
        }
        
        hospitals_collection.insert_one(new_hospital)
        print(f"New hospital created: {hospital_name}")

    emergencies_collection.insert_one({
        "hospitalName": hospital_name,
        "severity": data['severity'],
        "emergencyType": data['emergencyType'],
        "eta": data['eta'],
        "timestamp": current_timestamp 
    })

    return jsonify({"message": "Patient data submitted successfully!"}), 201

if __name__ == '__main__':
    app.run(debug=True, port=5000)