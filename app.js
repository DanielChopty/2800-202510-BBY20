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
const axios = require('axios'); // using axios for weather data


const saltRounds = 12; // Number of rounds for bcrypt hashing

// Load environment variables
const {
  MONGODB_USER,
  MONGODB_PASSWORD,
  MONGODB_HOST,
  MONGODB_DATABASE_USERS,
  MONGODB_DATABASE_SESSIONS,
  MONGODB_DATABASE_POLLS,
  MONGODB_SESSION_SECRET,
  NODE_SESSION_SECRET,
  PORT,
  OPENWEATHER_API_KEY
} = process.env;

const path = require('path');
const app = express();

const port = PORT || 8080;
const expireTime = 60 * 60 * 1000; // 1 hour session expiration


// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

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
  res.locals.username = req.session.username || null;
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

// 
app.use((req, res, next) => {
  res.locals.votedPolls = req.session.votedPolls || {};
  next();
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

      req.session.user.profilePic = profilePicPath; // Update session data with new profile picture path
      const pollsColl = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
      await pollsColl.updateMany(
        { "comments.commenter": req.session.user.name },
        { $set: { "comments.$[c].commenterPFP": profilePicPath } }, // Update all comments made by the user
        { arrayFilters: [{ "c.commenter": req.session.user.name }] } // Filter to update only the user's comments
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
      user: req.session.user || null,
      weather: null 
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
    await userCollection.insertOne({ name, email, password: hashedPassword, user_type: 'user', votedPolls: {} });

    // Set session data
    req.session.authenticated = true;
    req.session.username = name;
    req.session.email = email;
    req.session.cookie.maxAge = expireTime;

    res.render('dashboard', { user: req.session.user });
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
      req.session.votedPolls = user.votedPolls || {};
      req.session.cookie.maxAge = expireTime;

      res.redirect('/dashboard');
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

// Dashboard page (after logging in)
app.get('/dashboard', (req, res) => {
  const user = req.session.user; //get user from session
  if (!req.session.authenticated) {
    return res.redirect('/login'); //redirect to login page if user isn't logged in
  }

  // Temporary activity data (can be connected to a database later)
  const recentActivity = [
    { type: 'Voted', description: 'Voted on Park Renovation', date: 'May 10, 2025' },
    { type: 'Commented', description: 'Shared opinion on public transit plan', date: 'May 9, 2025' }
  ];

 res.render('citizenDashboard', {
    username: user.username,
    user: req.session.user, 
    recentActivity: recentActivity
});
});

// Profile page (protected route)
app.get('/profile', async (req, res) => {
  try {
    // Check if the user is authenticated
    if (!req.session.authenticated) {
      return res.redirect('/');
    }

    // Connect to users and polls collections in separate databases
    const userCollection = database.db(MONGODB_DATABASE_USERS).collection('users');
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');

    // Fetch the user based on their email
    const user = await userCollection.findOne({ email: req.session.email });

    // If the user does not exist in the database, redirect them to the home page
    if (!user) {
      return res.redirect('/');
    }

    // Fetch saved polls if any exist
    let savedPollsData = [];
    if (user.savedPolls && user.savedPolls.length > 0) {
      savedPollsData = await pollsCollection
        .find({ _id: { $in: user.savedPolls.map(id => new ObjectId(id)) } })
        .toArray();
    }

    // Read the personalized message from the session
    const personalizedMessage = req.session.personalizedMessage || '';
    req.session.personalizedMessage = ''; // Clear it after using

    // Render profile with the saved polls and personalized message
    res.render('profile', {
      title: 'Profile',
      username: user.name,
      user: user,
      savedPolls: savedPollsData,
      personalizedMessage: personalizedMessage
    });
    
  } catch (error) {
    console.error('Error rendering profile page:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// SURPRISE CHALLENGE 2 (AI MAGIC)

// The magic is that the AI generated the messages for the feelings below and helped me to
// randomly display them based on the first letter of the user's input.

// Route to handle form submission for feelings 
app.post('/update-feelings', async (req, res) => {
  try {
    // Get the feelings input from the request body (user's feelings text)
    const feelings = req.body.feelings;
    let personalizedMessage = ''; // Initialize personalizedMessage as an empty string

    if (feelings) {
      // Get the first letter of the feelings input and convert it to lowercase
      // Trim spaces and get first character
      const firstLetter = feelings.trim().charAt(0).toLowerCase();

       // Define a set of three predefined messages for each letter of the alphabet
      // Each letter corresponds to an array of messages that can be randomly selected
      const messages = {
        'a': [
          'An apple a day keeps the doctor away!',
          'Always aim for the stars!',
          'Adversity builds character.'
        ],
        'b': [
          'Bouncing back from challenges makes you stronger!',
          'Be the change you wish to see.',
          'Bravery is not the absence of fear, but the strength to face it.'
        ],
        'c': [
          'Creativity is the key to unlocking new possibilities.',
          'Change is the only constant in life.',
          'Courage is resistance to fear, mastery of fear, not absence of fear.'
        ],
        'd': [
          'Dare to dream big and make it happen!',
          'Determination is the key to success.',
          'Don’t let yesterday take up too much of today.'
        ],
        'e': [
          'Every day is a new opportunity to shine!',
          'Embrace the journey, not just the destination.',
          'Energy and persistence conquer all things.'
        ],
        'f': [
          'Feelings are like waves; they come and go.',
          'Fear is a natural reaction to moving closer to the truth.',
          'Follow your dreams, they know the way.'
        ],
        'g': [
          'Great things are coming your way!',
          'Growth is the key to progress.',
          'Good things come to those who hustle.'
        ],
        'h': [
          'Happiness is a journey, not a destination.',
          'Hard work beats talent when talent doesn’t work hard.',
          'Hope is the thing with feathers.'
        ],
        'i': [
          'Inspiration is everywhere, just open your eyes!',
          'It always seems impossible until it’s done.',
          'Imagination is more important than knowledge.'
        ],
        'j': [
          'Jump into the future with excitement and curiosity!',
          'Just keep going; don’t stop.',
          'Joy is the simplest form of gratitude.'
        ],
        'k': [
          'Keep going, the best is yet to come!',
          'Kindness is a language which the deaf can hear and the blind can see.',
          'Knowledge is power.'
        ],
        'l': [
          'Life is a beautiful ride, enjoy the journey!',
          'Learn as if you will live forever.',
          'Love yourself first and everything else falls into line.'
        ],
        'm': [
          'Make today amazing by making it yours.',
          'Motivation is what gets you started. Habit is what keeps you going.',
          'Mistakes are proof that you are trying.'
        ],
        'n': [
          'Never give up on yourself, you’ve got this!',
          'Nothing worth having comes easy.',
          'No one is you and that is your power.'
        ],
        'o': [
          'Opportunities are everywhere, seize them!',
          'Only in the darkness can you see the stars.',
          'One day or day one. You decide.'
        ],
        'p': [
          'Positivity is a magnet for good things!',
          'Push yourself because no one else is going to do it for you.',
          'Patience is not the ability to wait, but the ability to keep a good attitude while waiting.'
        ],
        'q': [
          'Questions lead to discovery, so keep asking!',
          'Quality over quantity.',
          'Quick minds think alike.'
        ],
        'r': [
          'Reach for the stars, you’re capable of greatness!',
          'Relax and let it flow.',
          'Resilience is the key to overcoming any obstacle.'
        ],
        's': [
          'Sometimes the smallest step in the right direction can end up being the biggest step of your life.',
          'Success is the sum of small efforts, repeated day in and day out.',
          'Start where you are. Use what you have. Do what you can.'
        ],
        't': [
          'Take time to appreciate the little things.',
          'The best time to plant a tree was 20 years ago. The second best time is now.',
          'The only way to do great work is to love what you do.'
        ],
        'u': [
          'Understand that setbacks are just setups for comebacks!',
          'Use your power to create a life you love.',
          'Unity is strength.'
        ],
        'v': [
          'Victory is sweetest when you’ve faced challenges.',
          'Vision without action is merely a dream.',
          'Value the moments that make you smile.'
        ],
        'w': [
          'Winning starts with believing in yourself.',
          'With hard work and determination, everything is possible.',
          'What we think, we become.'
        ],
        'x': [
          'X marks the spot where your adventure begins!',
          'Xcellence is the key to success.',
          'Xplore new possibilities every day.'
        ],
        'y': [
          'You are stronger than you think!',
          'You miss 100% of the shots you don’t take.',
          'You are what you believe yourself to be.'
        ],
        'z': [
          'Zoom into the future with confidence and courage!',
          'Zest for life is the key to happiness.',
          'Zero regrets, just lessons learned.'
        ],
      };

      // Pick a random message from the array of messages for the first letter
      const letterMessages = messages[firstLetter] || ['Thanks for sharing! You are unique and awesome!'];
      personalizedMessage = letterMessages[Math.floor(Math.random() * letterMessages.length)];
    }

    // Store in session for the redirected GET /profile route
    req.session.personalizedMessage = personalizedMessage;

    // Redirect to trigger fresh GET request and preserve full session behavior
    res.redirect('/profile');
  } catch (error) {
    console.error('Error updating feelings:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});
  
// About page (public or protected, choose based on need)
app.get('/about', (req, res) => {
  res.render('about', {
    title: 'About',
    user: req.session.user || null // send user to header.ejs
  });
});

// Logout handler
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/dashboard'); // redirect to header when error occurs
    }
    res.clearCookie('connect.sid'); // deleting session cookies
    res.redirect('/'); // head over to top page after logout
  });
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
app.get('/createPoll', isAuthenticated, (req, res) => {
  const created = req.query.created === 'true';
  res.render('createPoll', { created });
});


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
      user: req.session.user || null,
      votedPolls: req.session.votedPolls || []
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
  const userVotedPolls = req.session.votedPolls || {};

  // Check if already voted on this poll
  if (userVotedPolls[pollId]) {
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

    // Record the poll in user's votedPolls array
    const usersColl = database.db(process.env.MONGODB_DATABASE_USERS).collection('users');
    await usersColl.updateOne(
      { email: req.session.email },
      { $set: { [`votedPolls.${pollId}`]: choiceText } } // Add pollId to the user's votedPolls array only if it isn't present
    );

    // Mark poll as voted in just the session
    userVotedPolls[pollId] = choiceText;
    req.session.votedPolls = userVotedPolls;

    // Redirecting the user to the main.ejs page
    const returnTo = req.get('Referer') || '/polls';
    res.redirect(returnTo);

  } catch (err) {
    console.err('Error processing vote:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

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
      visibility,
      description
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
      description: description?.trim() || '',
      createdBy:      req.session.email, // We could also use their user ID here instead
      createdAt:      new Date(),
      available:      true,
      comments:       [],
      choices,
      views: 0
    }

    // Inserting the values into our database
    const pollsColl = database
      .db(process.env.MONGODB_DATABASE_POLLS)
      .collection('polls');

    const result = await pollsColl.insertOne(pollDoc);
    console.log('Inserted poll! _id:', result.insertedId); 

    // Redirect back to the polls page once done
    res.render('createPoll', { created: true });

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

    const importanceMap = { high: 3, medium: 2, low: 1 };

    if (sortOption === 'importance') {
      // Sort by importance descending, then alphabetically by title
      polls.sort((a, b) => {
        const aImportance = importanceMap[a.importance?.toLowerCase()] || 0;
        const bImportance = importanceMap[b.importance?.toLowerCase()] || 0;

        if (bImportance !== aImportance) {
          return bImportance - aImportance;
        } else {
          return a.title.localeCompare(b.title);
        }
      });
    } else if (sortOption === 'date') {
      // Sort by createdAt descending, then alphabetically by title
      polls.sort((a, b) => {
        const dateDiff = new Date(b.createdAt) - new Date(a.createdAt);
        return dateDiff !== 0 ? dateDiff : a.title.localeCompare(b.title);
      });
    } else {
      // Default: Sort alphabetically by title
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

// Delete poll route (used in pastPolls.ejs)
app.post('/deletepoll/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    await pollsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.redirect('/pastpolls?deleted=true');
  } catch (err) {
    console.error('Error deleting poll:', err);
    res.status(500).send('Server Error');
  }
});

// Edit poll route (used in pastPolls.ejs)
app.post('/editpoll/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { title, importance, available, options = [], description } = req.body;

    // Validate options: Remove empty/whitespace-only options
    const choices = Array.isArray(options)
      ? options.filter(opt => opt && opt.trim().length > 0).map(opt => ({ text: opt.trim(), votes: 0 }))
      : [];

    // Ensure at least two valid options are provided
    if (choices.length < 2) {
      return res.status(400).send('Please provide at least two valid options.');
    }

    // Handle tags input
    const tags = Array.isArray(req.body.tags) 
      ? req.body.tags 
      : (req.body.tags ? [req.body.tags] : []);

    const pollsCollection = database
      .db(process.env.MONGODB_DATABASE_POLLS)
      .collection('polls');

    // Update the poll document
    await pollsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          title: title.trim(),
          importance,
          available: available === 'true',
          description: description?.trim() || '',
          choices,
          tags 
        }
      }
    );

    res.redirect('/pastpolls?edited=true');
  } catch (error) {
    console.error('Error editing poll:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

app.get('/pollstats', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const sortOption = req.query.sort || 'all';

    const pollsCollection = database
      .db(process.env.MONGODB_DATABASE_POLLS)
      .collection('polls');

    let polls = await pollsCollection
      .find({ createdBy: req.session.email })
      .toArray();

    // Views calculations
const totalViews = polls.reduce((sum, p) => sum + (p.views || 0), 0);
const averageViews = polls.length ? totalViews / polls.length : 0;
const maxViews = Math.max(...polls.map(p => p.views || 0), averageViews);

// Saves calculations
const totalSaves = polls.reduce((sum, p) => sum + (p.savedBy?.length || 0), 0);
const averageSaves = polls.length ? totalSaves / polls.length : 0;
const maxSaves = Math.max(...polls.map(p => p.savedBy?.length || 0), averageSaves);

    // Sort alphabetically by default
    polls.sort((a, b) => a.title.localeCompare(b.title));

    res.render('pollstats', {
      title: 'Poll Statistics',
      user: req.session.user,
      polls,
      sort: sortOption,
      averageViews: averageViews.toFixed(2),
      averageSaves: averageSaves.toFixed(2),
      maxViews,
      maxSaves
    });
  } catch (err) {
    console.error('Error fetching poll statistics:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// GET: Display all user's polls and their tags
app.get('/manageTags', isAuthenticated, async (req, res) => {
  try {
    const pollsColl = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    const myPolls = await pollsColl.find({ createdBy: req.session.email }).toArray();
    const availableTags = ['#DailyLife', '#CulturalViews', '#FamilyMatters', '#MoralChoices', '#PersonalValues', '#PublicOpinion']; // Example list of tags
    res.render('manageTags', { title: 'Manage Tags', polls: myPolls, availableTags });
  } catch (err) {
    console.error('Error fetching polls:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});



// POST: Handle updating specific tags of a poll
app.post('/updateTags/:id', isAuthenticated, async (req, res) => {
  try {
    const pollId = req.params.id;
    const selectedTags = req.body.selectedTags || []; // Get selected tags from the form

    // If no tags were selected, do nothing
    if (selectedTags.length === 0) {
      return res.redirect('/manageTags');
    }

    const pollsColl = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    await pollsColl.updateOne(
      { _id: new ObjectId(pollId), createdBy: req.session.email },
      { $set: { tags: selectedTags } } // Update tags to the selected ones
    );

    res.redirect('/manageTags'); // Redirect back to the manage tags page
  } catch (err) {
    console.error('Error updating tags:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Unvote option allowing a user to remove their vote
app.post('/unvote', async (req, res) => {
  
  if(!req.session.authenticated) {
    return res.status(403).render('403', { title: 'Forbidden' });
  }

  const { pollId } = req.body;
  const userVotedPolls = req.session.votedPolls || {};
  const choiceText = userVotedPolls[pollId];

  // If they never voted on this poll, just redirect back
  if (!choiceText) {
    return res.redirect('/polls');
  }

  try {
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
  
    const poll = await pollsCollection.findOne({ _id: new ObjectId(pollId) });
    if (!poll) {
      return res.redirect('/polls');
    }

    const idx = poll.choices.findIndex(c => c.text === choiceText);
    if (idx > -1 && poll.choices[idx].votes > 0) {
      poll.choices[idx].votes -= 1;
      await pollsCollection.updateOne(
        { _id: new ObjectId(pollId) },
        { $set: { choices: poll.choices } }
      );
    }

    const usersColl = database.db(process.env.MONGODB_DATABASE_USERS).collection('users');
    await usersColl.updateOne(
      { email: req.session.email },
      { $unset: { [`votedPolls.${pollId}`]: "" } }
    );

    delete userVotedPolls[pollId]; 
    req.session.votedPolls = userVotedPolls; 
    const returnTo = req.get('Referer') || '/polls';
    res.redirect(returnTo);

  } catch (err) {
    console.error('Error unvoting:', err);
    res.status(500).send('Error unvoting');
  }
});

// Dedicated poll details page
app.get('/poll/:id', async (req, res) => {
  try {
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    const poll = await pollsCollection.findOne({ _id: new ObjectId(req.params.id)});
  
    if (!poll || !poll.available) {
      return res.status(404).render('404', { title: 'Poll Not Found' });
    }

    await pollsCollection.updateOne(
  { _id: new ObjectId(req.params.id) },
  { $inc: { views: 1 } }
);


    const votedPolls = req.session.votedPolls || {};
    res.render('pollDetail', {
      title: poll.title,
      poll,
      votedPolls
    
    });
  } catch (err) {
    console.error('Error fetching poll details:', err);
    res.status(500).send('Error fetching poll details');

  }
});
  
/* Everything related to saving and unsaving user polls */
  

// checking if the user is logged in 
function requireLogin(req, res, next) {
  if (!req.session.authenticated) {
    return res.redirect('/');
  }
  next();
}


// Route to save a poll to a user's profile
app.post('/save-poll/:pollId', requireLogin, async (req, res) => {
  try {
    const pollId = req.params.pollId;
    const userId = req.session.user._id;

     const userCollection = database.db(MONGODB_DATABASE_USERS).collection('users');
     const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');

    // Validate if pollId is a valid ObjectId
    if (!ObjectId.isValid(pollId)) {
      return res.status(400).json({ message: 'Invalid poll ID' });
    }

    const user = await userCollection.findOne({ _id: new ObjectId(userId) });
    const poll = await pollsCollection.findOne({ _id: new ObjectId(pollId) });

    if (!user || !poll) {
      return res.status(404).json({ message: 'User or poll not found' });
    }

    // Check if savedPolls array exists, if not create it
    if (!user.savedPolls) {
      await userCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { savedPolls: [] } }
      );
      user.savedPolls = []; // Update local user object
    }

    // Check if the poll is already saved
    if (!user.savedPolls.some(savedId => savedId.equals(new ObjectId(pollId)))) {
      await userCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $push: { savedPolls: new ObjectId(pollId) } }
      );
      return res.status(200).json({ message: 'Poll saved successfully' });
    } else {
      return res.status(200).json({ message: 'Poll already saved' });
    }
    // When there is an error saving a poll
  } catch (error) {
    console.error('Error saving poll:', error);
    res.status(500).json({ message: 'Failed to save poll' });
  }
});


// Route to unsave a poll from a user's profile
app.delete('/unsave-poll/:pollId', requireLogin, async (req, res) => {
  try {
    const pollId = req.params.pollId;
    const userId = req.session.user._id;

     const userCollection = database.db(MONGODB_DATABASE_USERS).collection('users');
     const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');

    // Validate if pollId is a valid ObjectId
    if (!ObjectId.isValid(pollId)) {
      return res.status(400).json({ message: 'Invalid poll ID' });
    }

    const user = await userCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove the poll ID from the savedPolls array
    await userCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $pull: { savedPolls: new ObjectId(pollId) } }
    );
    return res.status(200).json({ message: 'Poll unsaved successfully' });
  } catch (error) {
    console.error('Error unsaving poll:', error);
    res.status(500).json({ message: 'Failed to unsave poll' });
  }
});

// Add a new comment on a poll
app.post('/poll/:id/comment', isAuthenticated, async (req, res) => {
  const pollId = req.params.id;
  const text   = (req.body.commentText || "").trim();
  if (!text) return res.redirect(`/poll/${pollId}`);

  try {
    const pollsColl = database
      .db(process.env.MONGODB_DATABASE_POLLS)
      .collection('polls');

    const comment = {
      commenter:  req.session.user.name,   // display name
      commenterPFP: req.session.user.profilePic || 'default.jpg', // default profile picture
      text,
      createdAt:  new Date()
    };

    await pollsColl.updateOne(
      { _id: new ObjectId(pollId) },
      { $push: { comments: comment } }
    );
    res.redirect(`/poll/${pollId}#comments`);
  } catch (err) {
    console.error(err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// DELETE a comment that the current user posted
app.post('/poll/:id/comment/delete', isAuthenticated, async (req, res) => {
  const pollId     = req.params.id;
  const createdAt  = new Date(req.body.createdAt);   // timestamp of the comment
  const username   = req.session.user.name;          // name of the logged-in user

  try {
    const pollsColl = database
      .db(process.env.MONGODB_DATABASE_POLLS)
      .collection('polls');

    // Only pull the comment if it was createdBy this user at exactly that timestamp
    await pollsColl.updateOne(
      { _id: new ObjectId(pollId) },
      { 
        $pull: { 
          comments: { 
            commenter: username, 
            createdAt: createdAt 
          } 
        } 
      }
    );

    // Redirect back to the same poll
    res.redirect(`/poll/${pollId}#comments`);
  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});


/* ERROR HANDLING */

// 404 handler (catch-all route)
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

/* SERVER */

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
  