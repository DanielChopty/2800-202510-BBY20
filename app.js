// Load environment variables from .env
require('dotenv').config();

// Import core modules
const express = require('express');
const path = require('path');

// Import session and weather middleware
const { sessionMiddleware } = require('./middleware/session');
const fetchWeather = require('./middleware/weather');

// Import route modules
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const pollsRoutes = require('./routes/polls');
const adminRoutes = require('./routes/admin');
const pollStatsRoutes = require('./routes/pollStats');
const tagsRoutes = require('./routes/tags');
const indexRoutes = require('./routes/index');
const dashboardRoutes = require('./routes/dashboard');
const pastPollsRoutes = require('./routes/pastPolls');

const app = express();
const PORT = process.env.PORT || 8080;

// Set EJS as templating engine and public assets path
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Use session middleware
app.use(sessionMiddleware);

// Use weather middleware for all routes
app.use(fetchWeather);

// Custom middleware to pass session data to views
app.use((req, res, next) => {
  res.locals.authenticated = req.session.authenticated || false;
  res.locals.user = req.session.user || null;
  res.locals.username = req.session.username || null;
  res.locals.votedPolls = req.session.votedPolls || {};
  next();
});

// Mount all routes
app.use('/', indexRoutes);
app.use('/', authRoutes);
app.use('/', profileRoutes);
app.use('/', pollsRoutes);
app.use('/', adminRoutes);
app.use('/', pollStatsRoutes);
app.use('/', tagsRoutes);
app.use('/', dashboardRoutes);
app.use('/', pastPollsRoutes);

// 404 catch-all
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
