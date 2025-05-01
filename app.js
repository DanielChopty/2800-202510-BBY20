require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const { database } = require('./databaseConnection');
const saltRounds = 12;
const multer = require('multer');
const path = require('path');

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database_sessions = process.env.MONGODB_DATABASE_SESSIONS;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

const app = express();
const port = process.env.PORT || 3000;
const expireTime = 60 * 60 * 1000;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowed = /jpeg|jpg|png|gif/;
    const isValid = allowed.test(file.mimetype);
    cb(null, isValid);
  }
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database_sessions}?retryWrites=true&w=majority`,
  collectionName: 'sessions',
  crypto: { secret: mongodb_session_secret },
});

app.use(session({
  secret: node_session_secret,
  store: mongoStore,
  saveUninitialized: false,
  resave: true
}));

app.get('/', (req, res) => {
  if (req.session.authenticated) {
    res.render('index', {
      authenticated: true,
      username: req.session.username
    });
  } else {
    res.render('index', {
      authenticated: false,
      username: null
    });
  }
});

app.get('/signup', (req, res) => {
  res.render('signup', { errorMessage: null });
});

app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  const schema = Joi.object({
    name: Joi.string().max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  });

  const validationResult = schema.validate({ name, email, password });
  if (validationResult.error) {
    return res.render('signup', { errorMessage: validationResult.error.details[0].message });
  }

  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const userCollection = database.db(process.env.MONGODB_DATABASE).collection('users');
  const existingUser = await userCollection.findOne({ email });
  if (existingUser) {
    return res.render('signup', { errorMessage: 'User with that email already exists!' });
  }

  await userCollection.insertOne({ name, email, password: hashedPassword });

  req.session.authenticated = true;
  req.session.username = name;
  req.session.cookie.maxAge = expireTime;

  res.redirect('/profile');
});

app.get('/login', (req, res) => {
  res.render('login', { errorMessage: null });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  const validationResult = schema.validate({ email, password });
  if (validationResult.error) {
    return res.render('login', { errorMessage: validationResult.error.details[0].message });
  }

  const userCollection = database.db(process.env.MONGODB_DATABASE).collection('users');
  const user = await userCollection.findOne({ email });
  if (!user) {
    return res.render('login', { errorMessage: 'User not found' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (validPassword) {
    req.session.authenticated = true;
    req.session.username = user.name;
    req.session.cookie.maxAge = expireTime;
    res.redirect('/profile');
  } else {
    res.render('login', { errorMessage: 'Incorrect password' });
  }
});

// Upload profile picture and update DB
app.post('/upload-profile-pic', upload.single('profilePic'), async (req, res) => {
  if (!req.session.username) return res.redirect('/login');
  const profilePicPath = '/uploads/' + req.file.filename;

  try {
    await database.connect();
    const users = database.db().collection('users');
    await users.updateOne(
      { username: req.session.username },
      { $set: { profilePic: profilePicPath } }
    );
    res.redirect('/profile');
  } catch (err) {
    console.error('Error saving profile picture to DB:', err);
    res.status(500).send('Internal server error');
  }
});

// Display profile with picture
app.get('/profile', async (req, res) => {
  if (!req.session.username) return res.redirect('/login');

  try {
    await database.connect();
    const users = database.db().collection('users');
    const user = await users.findOne({ username: req.session.username });
    if (!user) return res.status(404).send("User not found");

    res.render('profile', {
      username: user.username,
      user
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).send('Internal server error');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
