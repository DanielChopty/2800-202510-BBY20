// File: routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Joi = require('joi');
const { database } = require('../config/databaseConnection');
const { ObjectId } = require('mongodb');

const saltRounds = 12;

router.get('/signup', (req, res) => {
  res.render('signup', { title: 'Sign Up', errorMessage: null });
});

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const schema = Joi.object({
      name: Joi.string().max(50).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required()
    });
    const { error } = schema.validate({ name, email, password });
    if (error) return res.render('signup', { title: 'Sign Up', errorMessage: error.details[0].message });

    const userCollection = database.db(process.env.MONGODB_DATABASE_USERS).collection('users');
    const existingUser = await userCollection.findOne({ email });
    if (existingUser) return res.render('signup', { title: 'Sign Up', errorMessage: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await userCollection.insertOne({ name, email, password: hashedPassword, user_type: 'user', votedPolls: {} });

    req.session.authenticated = true;
    req.session.username = name;
    req.session.email = email;
    req.session.cookie.maxAge = 60 * 60 * 1000 * 24;
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).render('signup', { title: 'Sign Up', errorMessage: 'Unexpected error occurred' });
  }
});

router.get('/login', (req, res) => {
  res.render('login', { title: 'Login', errorMessage: null });
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    });
    const { error } = schema.validate({ email, password });
    if (error) return res.render('login', { title: 'Login', errorMessage: error.details[0].message });

    const userCollection = database.db(process.env.MONGODB_DATABASE_USERS).collection('users');
    const user = await userCollection.findOne({ email });
    if (!user) return res.render('login', { title: 'Login', errorMessage: 'User not found' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.render('login', { title: 'Login', errorMessage: 'Incorrect password' });

    req.session.authenticated = true;
    req.session.username = user.name;
    req.session.email = user.email;
    req.session.user = user;
    req.session.votedPolls = user.votedPolls || {};
    req.session.cookie.maxAge = 60 * 60 * 1000 * 24;

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).render('login', { title: 'Login', errorMessage: 'Unexpected error occurred' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.redirect('/dashboard');
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

module.exports = router;
