// File: routes/stats.js
const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();
const { database } = require('../config/databaseConnection');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// GET /pollstats - Admin poll statistics
router.get('/pollstats', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const sortOption = req.query.sort || 'all';
    const pollsCollection = database
      .db(process.env.MONGODB_DATABASE_POLLS)
      .collection('polls');

    const polls = await pollsCollection.find({ createdBy: req.session.email }).toArray();

    const totalViews = polls.reduce((acc, poll) => acc + (poll.views || 0), 0);
    const averageViews = polls.length ? totalViews / polls.length : 0;
    const maxViews = Math.max(...polls.map(p => p.views || 0), averageViews);

    const totalSaves = polls.reduce((acc, poll) => acc + (poll.savedBy?.length || 0), 0);
    const averageSaves = polls.length ? totalSaves / polls.length : 0;
    const maxSaves = Math.max(...polls.map(p => p.savedBy?.length || 0), averageSaves);

    const totalComments = polls.reduce((acc, poll) => acc + (poll.comments?.length || 0), 0);
    const averageComments = polls.length ? totalComments / polls.length : 0;
    const maxComments = Math.max(...polls.map(p => p.comments?.length || 0), averageComments);

    // Sorting logic
    if (sortOption === 'views') {
      polls.sort((a, b) => (b.views || 0) - (a.views || 0) || a.title.localeCompare(b.title));
    } else if (sortOption === 'saves') {
      polls.sort((a, b) => (b.savedBy?.length || 0) - (a.savedBy?.length || 0) || a.title.localeCompare(b.title));
    } else if (sortOption === 'comments') {
      polls.sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0) || a.title.localeCompare(b.title));
    } else {
      polls.sort((a, b) => a.title.localeCompare(b.title));
    }

    res.render('pollStats', {
      title: 'Poll Statistics',
      user: req.session.user,
      polls,
      sort: sortOption,
      averageViews: averageViews.toFixed(2),
      averageSaves: averageSaves.toFixed(2),
      averageComments: averageComments.toFixed(2),
      maxViews,
      maxSaves,
      maxComments
    });
  } catch (err) {
    console.error('Error fetching poll statistics:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

module.exports = router;
