// File: routes/index.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const { OPENWEATHER_API_KEY } = process.env;

// GET / - Home route with weather
router.get('/', async (req, res) => {
  try {
    let weather = null;
    let city = null;
    let ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    if (ip === '::1' || ip === '127.0.0.1') ip = '8.8.8.8';

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

    res.render('index', {
      title: 'Home',
      authenticated: req.session.authenticated || false,
      username: req.session.username || null,
      user: req.session.user || null,
      weather,
      city
    });
  } catch (err) {
    console.error('Error fetching weather data:', err);
    res.render('index', {
      title: 'Home',
      authenticated: req.session.authenticated || false,
      username: req.session.username || null,
      user: req.session.user || null,
      weather: null,
      city: null
    });
  }
});

// GET /about - About page
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'About',
    user: req.session.user || null
  });
});

// GET /main - Main placeholder route
router.get('/main', (req, res) => {
  res.render('main');
});

module.exports = router;
