import subprocess
import time
from flask import Flask, request, jsonify
from flask_cors import CORS 
import main1
import main2

CAR_TRAVEL_TIME: int = 7

app = Flask(__name__)
CORS(app) 
current_green_signal = None 

def algo():
    global current_green_signal
    car_count1, people_count1 = main1.run()
    car_count2, people_count2 = main2.run()

    print(car_count1)
    print(car_count2)

    print(people_count1)
    print(people_count2)

    final_count = 0
    if car_count1 and car_count2 != 0:
        ratio = car_count1 / car_count2
        
        if ratio > 1.5 and people_count1 < 7:
            current_green_signal = 1  # Signal-1 is green
            final_count = car_count1 * CAR_TRAVEL_TIME
        elif ratio > 1.5 and people_count1 > 7:
            current_green_signal = 2  # Signal-2 is green
            final_count = car_count2 * CAR_TRAVEL_TIME
        elif ratio < 1.5 and people_count2 > 7:
            current_green_signal = 1  # Signal-1 is green
            final_count = car_count2 * CAR_TRAVEL_TIME
        else:
            current_green_signal = 2  # Signal-2 is green
            final_count = car_count2 * CAR_TRAVEL_TIME

    else:
        if car_count1 > car_count2:
            current_green_signal = 1 
            final_count = car_count1 * CAR_TRAVEL_TIME
        elif car_count1 < car_count2:
            current_green_signal = 2 
            final_count = car_count2 * CAR_TRAVEL_TIME
        else:
            current_green_signal = None 
            final_count = 30
            
    print("Current Green Signal:", "Signal-1" if current_green_signal == 1 else "Signal-2" if current_green_signal == 2 else "No clear signal")

    return final_count

@app.route('/traffic_signal', methods=['POST'])
def traffic_signal():
    is_green = request.json.get('isGreen')
    signal_number = request.json.get('signalNumber')
    print("IM here")
    
    if isinstance(is_green, bool) and isinstance(signal_number, int):
        # if is_green == (current_green_signal == signal_number):
        print(f"Traffic Signal T{signal_number} : GREEN")
        return jsonify({"status": "Message printed"}), 200
    
    return jsonify({"status": "No action taken"}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5001)
    while True:
        final_count = algo()
        start_time = time.time()
        time.sleep(final_count)
        end_time = time.time()
