import cv2
import pandas as pd
from ultralytics import YOLO
from tracker1 import Tracker  # Make sure to import the Tracker class

def run():
    model = YOLO('yolov8s.pt')

    def RGB(event, x, y, flags, param):
        if event == cv2.EVENT_MOUSEMOVE:
            colorsBGR = [x, y]
            print(colorsBGR)

    cv2.namedWindow('RGB')
    cv2.setMouseCallback('RGB', RGB)

    cap = cv2.VideoCapture('veh2.mp4')

    my_file = open("coco1.txt", "r")
    data = my_file.read()
    class_list = data.split("\n")

    # Initialize the tracker
    tracker = Tracker()

    cy1 = 322
    cy2 = 368
    offset = 6

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.resize(frame, (1020, 500))

        results = model.predict(frame)
        a = results[0].boxes.data
        px = pd.DataFrame(a).astype("float")

        # Initialize a variable to store the number of detected cars
        # ...

        # Initialize a variable to store the number of detected cars
        car_count = 0

        car_bounding_boxes = []  # Use a different variable name

        people_bounding_boxes = []

        for index, row in px.iterrows():
            x1 = int(row[0])
            y1 = int(row[1])
            x2 = int(row[2])
            y2 = int(row[3])
            d = int(row[5])
            c = class_list[d]
            if 'car' in c:
                car_bounding_boxes.append([x1, y1, x2, y2])

        for index, row in px.iterrows():
            x1 = int(row[0])
            y1 = int(row[1])
            x2 = int(row[2])
            y2 = int(row[3])
            d = int(row[5])
            c = class_list[d]
            if 'person' in c:
                people_bounding_boxes.append([x1, y1, x2, y2])

        # Update the tracker with the list of car bounding boxes
        bbox_id = tracker.update(car_bounding_boxes)  # Use the updated variable name

        bbox_ids = tracker.update(people_bounding_boxes)
        # Calculate the number of detected cars
        car_count = len(bbox_id)

        people_count = len(bbox_ids)
        # ...

        for bbox in bbox_id:
            x3, y3, x4, y4, id = bbox
            cx = int((x3 + x4) // 2)
            cy = int((y3 + y4) // 2)
            cv2.circle(frame, (cx, cy), 4, (0, 0, 255), -1)
            cv2.putText(frame, str(id), (cx, cy), cv2.FONT_HERSHEY_COMPLEX, 0.8, (0, 255, 255), 2)

        cv2.imshow("RGB", frame)
        if cv2.waitKey(1) & 0xFF == 27:
            break

    # Print the car count and signal at the end of the processing loop
    if car_count > 0:
        print(f"Number of Cars Detected: {car_count}, Signal: Green")
    else:
        print("No cars detected, Signal: Red")

    cap.release()
    cv2.destroyAllWindows()
    return car_count, people_count
