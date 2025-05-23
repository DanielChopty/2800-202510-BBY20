// File: routes/admin.js
const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();
const { database } = require('../config/databaseConnection');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Admin dashboard - view all users
router.get('/admin', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const userCollection = database.db(process.env.MONGODB_DATABASE_USERS).collection('users');
    const users = await userCollection.find().toArray();

    res.render('adminDashboard', {
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
router.get('/promote/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const userId = new ObjectId(req.params.id);
    const userCollection = database.db(process.env.MONGODB_DATABASE_USERS).collection('users');
    await userCollection.updateOne({ _id: userId }, { $set: { user_type: 'admin' } });
    res.redirect('/admin');
  } catch (error) {
    console.error('Error promoting user:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Demote admin to regular user
router.get('/demote/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const userId = new ObjectId(req.params.id);
    const userCollection = database.db(process.env.MONGODB_DATABASE_USERS).collection('users');
    await userCollection.updateOne({ _id: userId }, { $set: { user_type: 'user' } });
    res.redirect('/admin');
  } catch (error) {
    console.error('Error demoting user:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

module.exports = router;
