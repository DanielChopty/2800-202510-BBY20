// Load environment variables from .env file
require('dotenv').config();

// Import necessary dependencies
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // For storing sessions in MongoDB
const bcrypt = require('bcrypt'); // For hashing passwords
const Joi = require('joi'); // For input validation
const { ObjectId } = require('mongodb'); // For working with MongoDB document IDs
const { database } = require('./databaseConnection'); // Custom DB connection module

const saltRounds = 12; // Number of rounds for bcrypt hashing

// Load environment variables
const {
  MONGODB_USER,
  MONGODB_PASSWORD,
  MONGODB_HOST,
  MONGODB_DATABASE_USERS,
  MONGODB_DATABASE_SESSIONS,
  MONGODB_SESSION_SECRET,
  NODE_SESSION_SECRET,
  PORT,
  OPENWEATHER_API_KEY
} = process.env;

const app = express();
const axios = require('axios');
const port = PORT || 3000;
const expireTime = 60 * 60 * 1000; // 1 hour session expiration

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Middleware to parse form data and serve static files
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.static(__dirname));

// Configure session store using MongoDB
const mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${MONGODB_USER}:${MONGODB_PASSWORD}@${MONGODB_HOST}/${MONGODB_DATABASE_SESSIONS}?retryWrites=true&w=majority`,
  collectionName: 'sessions',
  crypto: { secret: MONGODB_SESSION_SECRET },
});

// Configure session middleware
app.use(session({
  secret: NODE_SESSION_SECRET,
  store: mongoStore,
  saveUninitialized: false,
  resave: true
}));

// Custom middleware to pass session data to all views
app.use((req, res, next) => {
  res.locals.authenticated = req.session.authenticated || false;
  res.locals.user = req.session.user || null;
  next();
});

// Custom middleware to pass session data and weather to all views
app.use(async (req, res, next) => {
  res.locals.authenticated = req.session.authenticated || false;
  res.locals.user = req.session.user || null;

  // Always attempt to fetch weather data, regardless of authentication
  try {
    let weather = null;
    let city = null;

    // Get IP and use it to fetch location
    let ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    if (ip === '::1' || ip === '127.0.0.1') {
      ip = '8.8.8.8'; // Test IP for local environment
    }

    const ipApiUrl = `http://ip-api.com/json/${ip}`;
    const ipResponse = await axios.get(ipApiUrl);
    const location = ipResponse.data;

    if (location.status === 'success') {
      const { lat, lon, city: locationCity } = location;
      city = locationCity;

      // Fetch weather from OpenWeather
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
      const weatherResponse = await axios.get(weatherUrl);
      weather = weatherResponse.data;
    }

    // Pass weather and city to all views
    res.locals.weather = weather;
    res.locals.city = city;

    next();
  } catch (err) {
    console.error('Error fetching weather data:', err);
    res.locals.weather = null;
    res.locals.city = null;
    next();
  }
});

// Middleware for multer (used for file uploads)
const multer = require('multer');

const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, 'public', 'uploads');

// Check if the directory exists, and if not, create it
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Uploads directory created.');
}

// Set up multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads'); // Use absolute path
    console.log('Upload Directory:', uploadDir); // Log the upload directory path
    cb(null, uploadDir); // Ensure the upload folder is correctly referenced
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Use timestamp for uniqueness
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpg|jpeg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed'));
  }
});

/* NORMAL ROUTES */

// Location + weather and index
app.get('/', async (req, res) => {
  try {
    let weather = null;
    let city = null;

    // Always attempt to fetch weather data, regardless of authentication
    let ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    if (ip === '::1' || ip === '127.0.0.1') {
      ip = '8.8.8.8'; // Test IP for local environment
    }

    const ipApiUrl = `http://ip-api.com/json/${ip}`;
    const ipResponse = await axios.get(ipApiUrl);
    const location = ipResponse.data;

    if (location.status === 'success') {
      const { lat, lon, city: locationCity } = location;
      city = locationCity;

      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
      const weatherResponse = await axios.get(weatherUrl);
      weather = weatherResponse.data;
    }

    // Render index page with weather, city, and session data
    res.render('index', {
      title: 'Home',
      authenticated: req.session.authenticated || false,
      username: req.session.username || null,
      user: req.session.user || null,
      weather: weather,
      city: city || null
    });
  } catch (err) {
    console.error('Error fetching weather data:', err);
    res.render('index', { weather: null, city: null });
  }
});

// Upload profile picture
app.post('/upload-profile-picture', upload.single('profilePic'), async (req, res) => {
  console.log('File Upload Attempt:', req.file); // Log the file upload details
  if (req.file) {
    const profilePicPath = 'uploads/' + req.file.filename;
    console.log('Profile Pic Path:', profilePicPath); // Log the final file path

    try {
      const userCollection = database.db(MONGODB_DATABASE_USERS).collection('users');
      await userCollection.updateOne(
        { email: req.session.email }, // Find the logged-in user by email
        { $set: { profilePic: profilePicPath } } // Update the profilePic field
      );
      res.redirect('/profile'); // Redirect back to profile page
    } catch (error) {
      console.error('Error updating profile picture:', error);
      res.status(500).send('Error updating profile picture');
    }
  } else {
    res.send('Please upload a valid image file');
  }
});



// Home page
app.get('/', (req, res) => {
  try {
    res.render('index', {
      title: 'Home',
      authenticated: req.session.authenticated || false,
      username: req.session.username || null,
      user: req.session.user || null
    });
  } catch (error) {
    console.error('Error rendering home page:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// route to render about.ejs
app.get('/about', (req, res) => {
  res.render('about', {
    title: 'About',
    authenticated: req.session.authenticated || false,
    username: req.session.username || null,
    user: req.session.user || null
  });
});

// Main page
app.get('/main', (req, res) =>{
  res.render('main');
});


// Signup form
app.get('/signup', (req, res) => {
  try {
    res.render('signup', {
      title: 'Sign Up',
      errorMessage: null
    });
  } catch (error) {
    console.error('Error rendering signup page:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Signup form submission handler
app.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input using Joi
    const schema = Joi.object({
      name: Joi.string().max(50).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required()
    });

    const validationResult = schema.validate({ name, email, password });
    if (validationResult.error) {
      return res.render('signup', {
        title: 'Sign Up',
        errorMessage: validationResult.error.details[0].message
      });
    }

    const userCollection = database.db(MONGODB_DATABASE_USERS).collection('users');
    const existingUser = await userCollection.findOne({ email });

    // Check if user already exists
    if (existingUser) {
      return res.render('signup', {
        title: 'Sign Up',
        errorMessage: 'User with that email already exists!'
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user with default role 'user'
    await userCollection.insertOne({ name, email, password: hashedPassword, user_type: 'user' });

    // Set session data
    req.session.authenticated = true;
    req.session.username = name;
    req.session.email = email;
    req.session.cookie.maxAge = expireTime;

    res.redirect('/profile');
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).render('signup', {
      title: 'Sign Up',
      errorMessage: 'An unexpected error occurred. Please try again.'
    });
  }
});

// Login form
app.get('/login', (req, res) => {
  try {
    res.render('login', {
      title: 'Login',
      errorMessage: null
    });
  } catch (error) {
    console.error('Error rendering login page:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Login form submission handler
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    });

    const validationResult = schema.validate({ email, password });
    if (validationResult.error) {
      return res.render('login', {
        title: 'Login',
        errorMessage: validationResult.error.details[0].message
      });
    }

    const userCollection = database.db(MONGODB_DATABASE_USERS).collection('users');
    const user = await userCollection.findOne({ email });

    // If user not found
    if (!user) {
      return res.render('login', {
        title: 'Login',
        errorMessage: 'User not found'
      });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (validPassword) {
      // Set session info
      req.session.authenticated = true;
      req.session.username = user.name;
      req.session.email = user.email;
      req.session.user = user;
      req.session.cookie.maxAge = expireTime;

      res.redirect('/profile');
    } else {
      res.render('login', {
        title: 'Login',
        errorMessage: 'Incorrect password'
      });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).render('login', {
      title: 'Login',
      errorMessage: 'An unexpected error occurred. Please try again.'
    });
  }
});

// Profile page (protected route)
app.get('/profile', async (req, res) => {
    try {
      if (!req.session.authenticated) {
        return res.redirect('/');
      }
  
      const userCollection = database.db(MONGODB_DATABASE_USERS).collection('users');
      const user = await userCollection.findOne({ email: req.session.email });
  
      if (!user) return res.redirect('/');
  
      res.render('profile', {
        title: 'Profile',
        username: user.name,
        user: user // pass the full user object
      });      
    } catch (error) {
      console.error('Error rendering profile page:', error);
      res.status(500).render('500', { title: 'Server Error' });
    }
  });
  
// Logout handler
app.get('/logout', (req, res) => {
  try {
    req.session.destroy(); // Destroys the session
    res.redirect('/');
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

/* MIDDLEWARE */

// Middleware to check if a user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/login');
}

// Middleware to check if a user is authenticated and an admin
function isAdmin(req, res, next) {
  // Check if the user is not authenticated
  if (!req.session.authenticated) {
    return res.redirect('/login'); // Redirect to login page if not authenticated
  }

  // If authenticated, check if the user is an admin
  if (req.session.user && req.session.user.user_type === 'admin') {
    return next(); // Proceed to the next middleware or route handler if user is an admin
  }

  // If authenticated but not an admin, show the 403 Forbidden page
  res.status(403).render('403', { title: 'Forbidden' });
}

/* ADMIN ROUTES */

// Admin dashboard route
app.get('/admin', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const userCollection = database.db(MONGODB_DATABASE_USERS).collection('users');
    const users = await userCollection.find().toArray();

    res.render('admin', {
      title: 'Admin Dashboard',
      users,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error rendering admin dashboard:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Promote user to admin
app.get('/promote/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const userId = new ObjectId(req.params.id);
    const userCollection = database.db(MONGODB_DATABASE_USERS).collection('users');
    await userCollection.updateOne({ _id: userId }, { $set: { user_type: 'admin' } });
    res.redirect('/admin');
  } catch (error) {
    console.error('Error promoting user:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Demote admin to regular user
app.get('/demote/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const userId = new ObjectId(req.params.id);
    const userCollection = database.db(MONGODB_DATABASE_USERS).collection('users');
    await userCollection.updateOne({ _id: userId }, { $set: { user_type: 'user' } });
    res.redirect('/admin');
  } catch (error) {
    console.error('Error demoting user:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Page for creating a poll
app.get('/createPoll', (req, res) =>{
  res.render('createPoll');
})


// Adding a route to fetch all available polls from the database


/*Important details  */
// Database can be named anything (Ex. polls)
// corresponds to the MONGODB_DATABASE_POLLS variable in the .env file
// Collection should be named 'polls'
// Each document in the polls collection should represent one poll
// Some of the fields that could be in it  (in JSON format):

// {
 // "_id": ObjectId("..."),
 // "title": "Should public transport be free?",
 // "tags": ["#PublicOpinion", "#DailyLife"],
//  "available": true,
//  "choices": [
 //   { "text": "Yes", "votes": 12 },
  //  { "text": "No", "votes": 8 },
  //  { "text": "Maybe", "votes": 3 }
    // ],
  // "createdBy": "user123",
  // "createdAt": ISODate("2024-09-01T10:00:00Z")
    // }


// "_id": ObjectId("...") - automatically generated unique identifier for this poll my MongoDB 
// "title": "Should public transport be free?" - the title of the poll (a string)
// "tags": ["#PublicOpinion", "#DailyLife"] - an array of tags for the poll (strings)
// "available": true - Determines whether users are able to see the poll (boolean)

//"choices": [
 //   { "text": "Yes", "votes": 12 },
  //  { "text": "No", "votes": 8 },  - An array of objects 
  //  { "text": "Maybe", "votes": 3 } - stores each voting option and current 
    // ]                              number of votes

    // "createdBy": "user123" - User who created this poll
    //  "createdAt": ISODate("2024-09-01T10:00:00Z") - Timestampe when the poll was created

    /* Additional Notes */
    // Comments should be added to the list


app.get('/polls', async (req, res) => {
  try {
    // Getting polls collection from the database using the variable MONGODB_DATABASE_POLLS
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    const polls = await pollsCollection.find({ available: true }).toArray();
    // Renders the main.ejs template
    res.render('polls', {
      title: 'Available Polls',
      // passing list of polls to the template
      polls: polls || [],
      // Passing login status
      // Making sure a user is active and session is valid
      // If not system defaults to false / null
      authenticated: req.session.authenticated || false,
      username: req.session.username || null,
      user: req.session.user || null
    });

  } catch (error) {
    // Error handling if the main.ejs page doesn't exist
    console.error('Error fetching polls:', error);
    res.status(404).render('404', { title: 'Page Not Found' });
  }
});


// Adding a route to handle the submission of a vote on a poll

app.post('/vote', async (req, res) => {

// Making sure user is actually logged in to vote
if(!req.session.authenticated){
// If they are not a 403 page gets displayed to them, not allowed them to access this feature
  return res.status(403).render('403', { title: 'Forbidden' });
}

  const { pollId, choiceText } = req.body;
  // Variable to make sure user can only vote once on every poll
  const userVotedPolls = req.session.votedPolls || [];

  // Check if already voted on this poll
  if (userVotedPolls.includes(pollId)) {
    return res.status(403).send('You have already voted on this poll.');
  }

  try {
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');

    // Find the poll
    const poll = await pollsCollection.findOne({ _id: new ObjectId(pollId) });

    // Check if the poll exists
    if (!poll) {
      return res.status(404).send('Poll not found');
    }

    // Find the index of the selected choice
    const choiceIndex = poll.choices.findIndex(c => c.text === choiceText);

    if (choiceIndex === -1) {
      return res.status(400).send('Invalid choice');
    }

    // Increment the vote count for the selected choice
    poll.choices[choiceIndex].votes += 1;

    // Update the poll document in the database
    await pollsCollection.updateOne(
      { _id: new ObjectId(pollId) },
      { $set: { choices: poll.choices } }
    );

    // Mark poll as voted
    userVotedPolls.push(pollId);
    req.session.votedPolls = userVotedPolls;

    // Redirecting the user to the main.ejs page
    res.redirect('/main'); 
  } catch (error) {
    console.error('Error processing vote:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Page for creating a poll
app.get('/createPoll', (req, res) =>{
  res.render('createPoll');
})

// Handle creating a new poll
app.post('/createPoll', isAuthenticated, async (req, res) => {
  console.log('POST /createPoll hit', req.body);
  try {
    const {
      title,
      tags = '',
      options = [],
      importance,
      startDate,
      endDate,
      visibility
    } = req.body;

    // Removes any empty strings and trims whitespace
    const choices = options
      .filter(text => text && text.trim().length > 0)
      .map(text => ({ text: text.trim(), votes: 0})); // Each option starts at 0 votes
    
    if (choices.length < 2) {
      return res.status(400).send('Error 400: Please provide at least two options');
    }

    const tagArray = tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // Creating the poll document and all its values
    const pollDoc = {
      title:          title.trim(),
      tags:           tagArray,
      importance,
      startDate:      new Date(startDate),
      endDate:        new Date(endDate),
      visibility,
      createdBy:      req.session.email, // We could also use their user ID here instead
      createdAt:      new Date(),
      available:      true,
      choices
    }

    // Inserting the values into our database
    const pollsColl = database
      .db(process.env.MONGODB_DATABASE_POLLS)
      .collection('polls');

    const result = await pollsColl.insertOne(pollDoc);
    console.log('Inserted poll! _id:', result.insertedId); 

    // Redirect back to the polls page once done
    res.redirect('/polls');

  } catch (err) {
    console.error('Error creating poll:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Past polls page route
app.get('/pastpolls', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const pollsCollection = database
      .db(process.env.MONGODB_DATABASE_POLLS)
      .collection('polls');

    const sortOption = req.query.sort || 'all';

    let polls = await pollsCollection
      .find({ createdBy: req.session.email })
      .toArray();

    // Manual sorting if importance sort is selected
    if (sortOption === 'importance') {
      const importanceMap = { high: 3, medium: 2, low: 1 };

      polls.sort((a, b) => {
        const aVal = importanceMap[a.importance?.toLowerCase()] || 0;
        const bVal = importanceMap[b.importance?.toLowerCase()] || 0;
        return bVal - aVal; // Descending: High > Medium > Low
      });
    } else {
      // Default to alphabetical order by title
      polls.sort((a, b) => a.title.localeCompare(b.title));
    }

    res.render('pastPolls', {
      title: 'Past Polls',
      user: req.session.user,
      polls: polls,
      sort: sortOption
    });
  } catch (err) {
    console.error('Error fetching past polls:', err);
    res.status(500).send('Server Error');
  }
});

/* ERROR HANDLING */

// 404 handler (catch-all route)
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

/* SERVER */

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
