from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # This will enable CORS for all routes

# Temporary storage for emergency information (in-memory)
emergency_data = {}

# Endpoint to receive emergency information from ambulance
@app.route('/emergency', methods=['POST'])
def receive_emergency():
    global emergency_data
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data received"}), 400
    
    # Store the data in memory (you can change this to database storage)
    emergency_data = {
        "hospitalName": data.get("hospitalName", "Unknown Hospital"),
        "severity": data.get("severity", "Unknown Severity"),
        "emergencyType": data.get("emergencyType", "Unknown Emergency Type"),
        "eta": data.get("eta", "Unknown ETA")
    }
    
    return jsonify({"message": "Emergency data received successfully"}), 200

# Endpoint to retrieve the latest emergency data for the hospital
@app.route('/emergency/latest', methods=['GET'])
def get_latest_emergency():
    if emergency_data:
        return jsonify(emergency_data), 200
    else:
        return jsonify({"error": "No emergency data available"}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5001)  # Change the port number here

