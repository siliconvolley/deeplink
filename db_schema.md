# Database Collection Schemas

`hospitals` collection:
```json
[
  {
    "_id": "ObjectId",
    "hospitalName": "String",
    "password": "String"
  }
]
```

`emergencies` collection:
```json
[
  {
    "_id": "ObjectId",
    "emergencyType": "String",
    "eta": "Int32",
    "hospitalId": "ObjectId",  // References hospitals._id
    "patientId": ["ObjectId", "Undefined"],
    "severity": "String",
    "timestamp": "String",
    "ambulanceId": "ObjectId",  // References ambulances._id
    "status": "String" // "Active", "Completed", "Cancelled"
  }
]
```

`ambulances` collection:
```json
[
  {
    "_id": "ObjectId",
    "ambulanceId": "String",
    "location": {
      "lat": "Float",
      "long": "Float"
    },
    "assignedJunction": "ObjectId", // References junctions._id
    "status": "String", // "Idle", "En Route", "Waiting at Junction"
    "lastUpdated": "Timestamp"
  }
]
```

`junctions` collection:
```json
[
  {
    "_id": "ObjectId",
    "junctionId": "String",
    "location": {
      "lat": "Float",
      "long": "Float"
    },
    "activeAmbulances": ["ObjectId"], // References multiple ambulances._id
    "trafficState": {
      "north": "GREEN",
      "south": "RED",
      "east": "RED",
      "west": "GREEN"
    },
    "lastUpdated": "Timestamp"
  }
]
```