const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();
const { database } = require('../config/databaseConnection');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// GET /pastpolls - Admin-only view of polls created by the current user
router.get('/pastpolls', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const pollsCollection = database
      .db(process.env.MONGODB_DATABASE_POLLS)
      .collection('polls');

    const sortOption = req.query.sort || 'all';
    const importanceMap = { high: 3, medium: 2, low: 1 };

    let polls = await pollsCollection
      .find({ createdBy: req.session.email })
      .toArray();

    if (sortOption === 'importance') {
      polls.sort((a, b) => {
        const aImp = importanceMap[a.importance?.toLowerCase()] || 0;
        const bImp = importanceMap[b.importance?.toLowerCase()] || 0;
        return bImp !== aImp ? bImp - aImp : a.title.localeCompare(b.title);
      });
    } else if (sortOption === 'date') {
      polls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || a.title.localeCompare(b.title));
    } else {
      polls.sort((a, b) => a.title.localeCompare(b.title));
    }

    res.render('pastPolls', {
      title: 'Past Polls',
      user: req.session.user,
      polls,
      sort: sortOption
    });
  } catch (err) {
    console.error('Error fetching past polls:', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
