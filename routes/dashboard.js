// File: routes/dashboard.js
const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');

// GET /dashboard - available to all authenticated users
router.get('/dashboard', isAuthenticated, (req, res) => {
  const user = req.session.user;

  const recentActivity = [
    { type: 'Voted', description: 'Voted on Park Renovation', date: 'May 10, 2025' },
    { type: 'Commented', description: 'Shared opinion on public transit plan', date: 'May 9, 2025' }
  ];

  res.render('citizenDashboard', {
    username: user.username,
    user: user,
    recentActivity
  });
});

module.exports = router;
