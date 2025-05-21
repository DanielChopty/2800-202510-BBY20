// File: config/database.js

require('dotenv').config();
const { MongoClient } = require('mongodb');

const {
  MONGODB_HOST,
  MONGODB_USER,
  MONGODB_PASSWORD,
  MONGODB_DATABASE_USERS
} = process.env;

// Construct the MongoDB Atlas URI
const atlasURI = `mongodb+srv://${MONGODB_USER}:${MONGODB_PASSWORD}@${MONGODB_HOST}/${MONGODB_DATABASE_USERS}?retryWrites=true&w=majority`;

// Create and export the MongoClient instance
const database = new MongoClient(atlasURI, {});

module.exports = { database };
