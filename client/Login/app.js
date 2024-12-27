const express = require('express'); // Import the express module
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all routes
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the public directory

// Serve the login page at the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// MongoDB connection string
const uri = 'mongodb://0.0.0.0:27017/'; // Update with your MongoDB credentials
const client = new MongoClient(uri);
const secretKey = 'yourSecretKey'; // Use an environment variable in production

// Connect to the database
async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connected to MongoDB!');
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}

// Authentication Middleware
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.sendStatus(403);

    jwt.verify(token, secretKey, (err, user) => {
        if (err) return res.sendStatus(403);
        req.hospitalName = user.hospitalName;
        next();
    });
}

// Login Endpoint
app.post('/login', async (req, res) => {
  const { hospitalName, password } = req.body;

  await client.connect();
  const database = client.db("Hospital");
  const hospitals = database.collection("hospitals");

  // Log the request to check the received credentials
  console.log("Attempting to log in:", { hospitalName, password });

  const hospital = await hospitals.findOne({ hospitalName });

  // Check if the hospital was found
  if (!hospital) {
      console.log("Hospital not found");
      return res.status(401).json({ message: "Invalid credentials: Hospital Not Found" });
  }

  const passwordMatch = await bcrypt.compare(password, hospital.password);
  
  // Log the password comparison result
  console.log("Password match result:", passwordMatch);

  if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials: Wrong Password" });
  }

  const token = jwt.sign({ hospitalName }, secretKey, { expiresIn: '1h' });
  res.json({ token });
});


// Patients Retrieval Endpoint
app.get('/patients', authenticateToken, async (req, res) => {
    const hospitalName = req.hospitalName;

    await client.connect();
    const database = client.db("Hospital");
    const collection = database.collection("emergencies");

    const incomingPatients = await collection.find({ hospitalName }).toArray();
    res.json(incomingPatients);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    connectToDatabase();
});
