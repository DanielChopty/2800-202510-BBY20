// File: routes/pastPolls.js
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

// POST /editpoll/:id - Update a poll by ID
router.post('/editpoll/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const pollId = req.params.id;
    const {
      title,
      description,
      options,
      importance,
      startDate,
      endDate,
      available,
      tags = []
    } = req.body;

    const cleanedOptions = Array.isArray(options)
      ? options.filter(opt => opt && opt.trim()).map(opt => ({ text: opt.trim(), votes: 0 }))
      : [];

    const updateDoc = {
      title: title.trim(),
      description: description?.trim() || '',
      choices: cleanedOptions,
      importance: importance || 'Low',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      available: available === 'true',
      tags: Array.isArray(tags) ? tags.map(tag => tag.trim()) : []
    };

    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    await pollsCollection.updateOne({ _id: new ObjectId(pollId) }, { $set: updateDoc });

    res.redirect('/pastpolls?edited=true');
  } catch (err) {
    console.error('Error editing poll:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// POST /deletepoll/:id - Delete a poll by ID
router.post('/deletepoll/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const pollId = req.params.id;
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');

    await pollsCollection.deleteOne({ _id: new ObjectId(pollId) });
    res.redirect('/pastpolls?deleted=true');
  } catch (err) {
    console.error('Error deleting poll:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

router.post('/delete-all-polls', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    await pollsCollection.deleteMany({ createdBy: req.session.email });
    res.redirect('/pastpolls?deletedAll=true');
  } catch (err) {
    console.error('Error deleting all polls:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

module.exports = router;
