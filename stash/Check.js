const { MongoClient } = require('mongodb');

// Connection URI
const uri = 'mongodb://localhost:27017/'; // Replace with your actual credentials
const client = new MongoClient(uri);

async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connected to MongoDB!');

        const database = client.db("hospital_system");
        // Perform operations on the collections here

    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    } finally {
        await client.close();
    }
}

connectToDatabase();
