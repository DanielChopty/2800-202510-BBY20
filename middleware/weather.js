// File: middleware/weather.js
const axios = require('axios');
const { OPENWEATHER_API_KEY } = process.env;

module.exports = async function fetchWeather(req, res, next) {
  res.locals.authenticated = req.session.authenticated || false;
  res.locals.user = req.session.user || null;

  try {
    let ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    if (ip === '::1' || ip === '127.0.0.1') ip = '8.8.8.8';

    const ipApiUrl = `http://ip-api.com/json/${ip}`;
    const ipResponse = await axios.get(ipApiUrl);
    const location = ipResponse.data;

    if (location.status === 'success') {
      const { lat, lon, city } = location;
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
      const weatherResponse = await axios.get(weatherUrl);

      res.locals.city = city;
      res.locals.weather = weatherResponse.data;
    } else {
      res.locals.city = null;
      res.locals.weather = null;
    }
  } catch (err) {
    console.error('Weather middleware error:', err);
    res.locals.city = null;
    res.locals.weather = null;
  }

  next();
};
