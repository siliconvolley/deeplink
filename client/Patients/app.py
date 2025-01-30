from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS 
from pymongo import MongoClient
import bcrypt  
from datetime import datetime, timedelta
import jwt
import os
from werkzeug.security import check_password_hash
import logging
from functools import wraps

app = Flask(__name__)
CORS(app)  

# Configuration
app.config['SECRET_KEY'] = 'yourSecretKey'  # Use environment variable in production
client = MongoClient('mongodb://localhost:27017/')
db = client['Hospital'] 
emergencies_collection = db['emergencies']  
hospitals_collection = db['hospitals'] 
junctions_collection = db['junctions']

# Add this near the top of your file
logging.basicConfig(level=logging.DEBUG)

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

# Add this decorator for protected routes
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_hospital = hospitals_collection.find_one({"hospitalName": data['hospitalName']})
            if not current_hospital:
                return jsonify({'message': 'Invalid token'}), 401
        except:
            return jsonify({'message': 'Invalid token'}), 401
        
        return f(current_hospital, *args, **kwargs)
    
    return decorated

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
        data = request.get_json()
        hospital_name = data.get('hospitalName')
        password = data.get('password')
        
        logging.info(f"Login attempt for hospital: {hospital_name}")
        
        hospital = hospitals_collection.find_one({"hospitalName": hospital_name})
        
        if not hospital:
            logging.warning(f"Hospital not found: {hospital_name}")
            return jsonify({'message': 'Invalid credentials'}), 401
        
        # Convert password to bytes if it's not already
        if isinstance(password, str):
            password = password.encode('utf-8')
        
        # Get stored hash from database
        stored_hash = hospital['password']
        
        # Check if the stored hash needs to be decoded from string
        if isinstance(stored_hash, str):
            stored_hash = stored_hash.encode('utf-8')
        
        logging.info("Attempting password verification")
        # Verify password using bcrypt
        if bcrypt.checkpw(password, stored_hash):
            logging.info("Password verified successfully")
            token = jwt.encode({
                'hospitalName': hospital_name,
                'exp': datetime.utcnow() + timedelta(hours=24)
            }, app.config['SECRET_KEY'])
            
            return jsonify({'token': token})
        else:
            logging.warning("Password verification failed")
            return jsonify({'message': 'Invalid credentials'}), 401
            
    except Exception as e:
        logging.error(f"Login error: {str(e)}")
        return jsonify({'message': str(e)}), 500

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

@app.route('/dashboard')
def dashboard_page():
    return render_template('dashboard.html')

@app.route('/api/dashboard-data')
@token_required
def get_dashboard_data(current_hospital):
    try:
        # Get all emergencies for this hospital
        emergencies = list(emergencies_collection.find(
            {"hospitalName": current_hospital['hospitalName']},
            {'_id': 0}
        ).sort('timestamp', -1))
        
        # Format timestamps
        for emergency in emergencies:
            emergency['timestamp'] = emergency['timestamp'].strftime('%m/%d/%Y, %I:%M:%S %p')
        
        return jsonify(emergencies)
    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/check_hospital/<name>')
def check_hospital(name):
    hospital = hospitals_collection.find_one({"hospitalName": name})
    if hospital:
        return jsonify({
            "found": True,
            "stored_hash": str(hospital['password'])
        })
    return jsonify({"found": False})

if __name__ == '__main__':
    app.run(debug=True, port=5000)