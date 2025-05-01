// Load environment variables from the .env file
require('dotenv').config();

// Import necessary dependencies
const express = require('express');       // Express framework for building the web app
const session = require('express-session'); // Express-session to manage user sessions
const MongoStore = require('connect-mongo'); // MongoDB session store to persist sessions in MongoDB
const bcrypt = require('bcrypt');        // bcrypt for password hashing
const Joi = require('joi');              // Joi for data validation
const { database } = require('./databaseConnection'); // MongoDB connection setup
const saltRounds = 12;                   // Number of salt rounds for bcrypt hashing

// Load MongoDB credentials and session settings from environment variables
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database_sessions = process.env.MONGODB_DATABASE_SESSIONS;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

// Initialize the Express application
const app = express();
const port = process.env.PORT || 3000;  // Use the port specified in the environment or default to 3000
const expireTime = 60 * 60 * 1000;      // Set session expiration time to 1 hour (in milliseconds)

// Set EJS as the templating engine for views
app.set('view engine', 'ejs');

// Middleware to parse incoming URL-encoded data (for forms)
app.use(express.urlencoded({ extended: false }));

// Middleware to serve static files like images, CSS, etc. from the 'public' directory
app.use(express.static('public'));

// Sessions database configuration using MongoDB
var mongoStore = MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database_sessions}?retryWrites=true&w=majority`,
    collectionName: 'sessions',  // Store session data in the 'sessions' collection
    crypto: { secret: mongodb_session_secret },  // Encrypt session data with the secret
});

// Use the session middleware to manage user sessions
app.use(session({
    secret: node_session_secret,  // Secret key to sign the session ID cookie
    store: mongoStore,            // Use the MongoDB session store
    saveUninitialized: false,     // Don't save uninitialized sessions
    resave: true                  // Resave the session even if it wasn't modified
}));

// Route for the home page (index)
app.get('/', (req, res) => {
    if (req.session.authenticated) { // If the user is authenticated, show the logged-in view
        res.render('index', {
            authenticated: true,
            username: req.session.username // Pass the username from the session
        });
    } else { // If the user is not authenticated, show the login view
        res.render('index', {
            authenticated: false,
            username: null
        });
    }
});

// Route to display the signup form
app.get('/signup', (req, res) => {
    res.render('signup', { errorMessage: null });
});

// Signup POST route: Process the signup form submission
app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;

    // Validate input using Joi
    const schema = Joi.object({
        name: Joi.string().max(50).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
    });

    const validationResult = schema.validate({ name, email, password });
    if (validationResult.error) { // If validation fails, show an error message
        return res.render('signup', { errorMessage: validationResult.error.details[0].message });
    }

    // Hash the password using bcrypt before storing it in the database
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Check if a user already exists with the provided email
    const userCollection = database.db(process.env.MONGODB_DATABASE).collection('users');
    const existingUser = await userCollection.findOne({ email });
    if (existingUser) { // If the user already exists, show an error message
        return res.render('signup', { errorMessage: 'User with that email already exists!' });
    }

    // Insert the new user into the 'users' collection
    await userCollection.insertOne({ name, email, password: hashedPassword });

    // Set the session to mark the user as authenticated
    req.session.authenticated = true;
    req.session.username = name;  // Store the username in the session
    req.session.cookie.maxAge = expireTime; // Set the session cookie expiration

    // Redirect to the profile page
    res.redirect('/profile');
});

// Route to display the login form
app.get('/login', (req, res) => {
    res.render('login', { errorMessage: null });
});

// Login POST route: Process the login form submission
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Validate input using Joi
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    });

    const validationResult = schema.validate({ email, password });
    if (validationResult.error) { // If validation fails, show an error message
        return res.render('login', { errorMessage: validationResult.error.details[0].message });
    }

    // Find the user by email in the database
    const userCollection = database.db(process.env.MONGODB_DATABASE).collection('users');
    const user = await userCollection.findOne({ email });
    if (!user) { // If no user is found, show an error message
        return res.render('login', { errorMessage: 'User not found' });
    }

    // Compare the provided password with the hashed password stored in the database
    const validPassword = await bcrypt.compare(password, user.password);
    if (validPassword) { // If the password is valid, authenticate the user
        req.session.authenticated = true;
        req.session.username = user.name;  // Store the username in the session
        req.session.cookie.maxAge = expireTime;  // Set the session cookie expiration
        res.redirect('/profile');
    } else { // If the password is incorrect, show an error message
        res.render('login', { errorMessage: 'Incorrect password' });
    }
});

// Profile page route: Display the logged-in user's page
app.get('/profile', (req, res) => {
    if (!req.session.authenticated) { // If the user is not authenticated, redirect to the homepage
        return res.redirect('/');
    }

    // Render the 'profile' view and pass the username to the template
    res.render('profile', { username: req.session.username });
});

// Logout route: Destroy the session and redirect to the homepage
app.get('/logout', (req, res) => {
    req.session.destroy();  // Destroy the session
    res.redirect('/');  // Redirect to the homepage
});

// 404 route: Catch-all route for undefined routes
app.use((req, res) => {
    res.status(404).render('404');  // Render a custom 404 page
});

// Start the server and listen on the specified port
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
