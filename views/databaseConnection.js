// Load environment variables from the .env file (MongoDB credentials, session secret, etc.)
require('dotenv').config();

// Extract MongoDB connection details and session secrets from environment variables
const mongodb_host = process.env.MONGODB_HOST;          // The MongoDB host (e.g., MongoDB Atlas cluster URL)
const mongodb_user = process.env.MONGODB_USER;          // The MongoDB username
const mongodb_password = process.env.MONGODB_PASSWORD;  // The MongoDB password
const mongodb_database_users = process.env.MONGODB_DATABASE_USERS; // The name of the database for users
const mongodb_database_sessions = process.env.MONGODB_DATABASE_SESSIONS; // The name of the database for sessions
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;  // The session secret for encrypting session data

// Import the MongoClient class from the MongoDB driver
const MongoClient = require("mongodb").MongoClient;

// Construct the MongoDB URI using the connection details from the .env file
// The URI follows the format `mongodb+srv://<username>:<password>@<host>/<database>?retryWrites=true&w=majority`
const atlasURI = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database_users}?retryWrites=true&w=majority`;

// Create a new MongoClient instance, which is used to interact with the MongoDB database
var database = new MongoClient(atlasURI, {});

// Export the `database` object so it can be used in other parts of the application to interact with MongoDB
module.exports = { database };
