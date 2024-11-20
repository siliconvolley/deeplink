from flask import Flask, render_template, request, jsonify
from flask_cors import CORS 
from pymongo import MongoClient
import bcrypt  
from datetime import datetime

app = Flask(__name__)
CORS(app)  

client = MongoClient('mongodb://localhost:27017/')  # Replace with your MongoDB URI
db = client['Hospital']  # Your database name
emergencies_collection = db['emergencies']  # Your emergencies collection
hospitals_collection = db['hospitals']  # Collection for hospitals

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/submit-patient', methods=['POST'])
def submit_patient():
    data = request.json

    current_timestamp = datetime.now().isoformat()

    # Validate incoming data
    if not all(key in data for key in ('hospitalName', 'severity', 'emergencyType', 'eta')):
        return jsonify({"error": "Missing data"}), 400

    hospital_name = data['hospitalName']

    # Check if the hospital already exists in the database
    hospital = hospitals_collection.find_one({"hospitalName": hospital_name})

    if not hospital:
        # If the hospital does not exist, create a new one with a default password
        default_password = '123456'  # This should be securely handled
        hashed_password = bcrypt.hashpw(default_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Create a new hospital document
        new_hospital = {
            "hospitalName": hospital_name,
            "password": hashed_password
        }
        
        # Insert the new hospital into the database
        hospitals_collection.insert_one(new_hospital)
        print(f"New hospital created: {hospital_name}")

    # Insert the patient data into the MongoDB collection
    emergencies_collection.insert_one({
        "hospitalName": hospital_name,
        "severity": data['severity'],
        "emergencyType": data['emergencyType'],
        "eta": data['eta'],
        "timestamp": current_timestamp  # Optional timestamp field
    })

    return jsonify({"message": "Patient data submitted successfully!"}), 201

if __name__ == '__main__':
    app.run(debug=True, port=5000) 
