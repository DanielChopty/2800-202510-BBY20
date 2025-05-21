// File: routes/polls.js
const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();
const { database } = require('../config/databaseConnection');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// GET all available polls
router.get('/polls', async (req, res) => {
  try {
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    const polls = await pollsCollection.find({ available: true }).toArray();

    polls.forEach(poll => {
      if (typeof poll.tags === 'string') {
        poll.tags = poll.tags.split(',').map(tag => tag.trim());
      } else if (!Array.isArray(poll.tags)) {
        poll.tags = [];
      }
    });

    res.render('polls', {
      title: 'Available Polls',
      polls: polls || [],
      authenticated: req.session.authenticated || false,
      username: req.session.username || null,
      user: req.session.user || null,
      votedPolls: req.session.votedPolls || [],
      savedPollIds: req.session.user?.savedPolls?.map(p => p.toString()) || []
    });
  } catch (error) {
    console.error('Error fetching polls:', error);
    res.status(404).render('404', { title: 'Page Not Found' });
  }
});

// GET dedicated poll detail page
router.get('/poll/:id', async (req, res) => {
  try {
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    const poll = await pollsCollection.findOne({ _id: new ObjectId(req.params.id)});

    if (poll) {
      if (typeof poll.tags === 'string') {
        poll.tags = poll.tags.split(',').map(tag => tag.trim());
      } else if (!Array.isArray(poll.tags)) {
        poll.tags = [];
      }
    }

    if (!poll || !poll.available) {
      return res.status(404).render('404', { title: 'Poll Not Found' });
    }

    await pollsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $inc: { views: 1 } }
    );

    const votedPolls = req.session.votedPolls || {};
    res.render('pollDetail', {
      title: poll.title,
      poll,
      votedPolls
    });
  } catch (err) {
    console.error('Error fetching poll details:', err);
    res.status(500).send('Error fetching poll details');
  }
});

router.get('/createPoll', isAuthenticated, isAdmin, (req, res) => {
  const created = req.query.created === 'true';
  res.render('createPoll', { created });
});

// POST /createPoll - Handle poll creation form submission
router.post('/createPoll', isAuthenticated, async (req, res) => {
  console.log('POST /createPoll hit', req.body);
  try {
    const {
      title,
      tags = '',
      options = [],
      importance,
      startDate,
      endDate,
      visibility,
      description
    } = req.body;

    const choices = Array.isArray(options)
      ? options.filter(opt => opt && opt.trim().length > 0).map(opt => ({ text: opt.trim(), votes: 0 }))
      : [];

    if (choices.length < 2) {
      return res.status(400).send('Please provide at least two valid poll options.');
    }

    const tagArray = tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    const pollDoc = {
      title: title.trim(),
      tags: tagArray,
      importance,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      visibility,
      description: description?.trim() || '',
      createdBy: req.session.email,
      createdAt: new Date(),
      available: true,
      choices,
      comments: [],
      views: 0,
      savedBy: []
    };

    const pollsCollection = database
      .db(process.env.MONGODB_DATABASE_POLLS)
      .collection('polls');

    const result = await pollsCollection.insertOne(pollDoc);
    console.log('Inserted poll with _id:', result.insertedId);

    res.redirect('/createPoll?created=true');
  } catch (err) {
    console.error('Error creating poll:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// POST /poll/:id/comment - Add a new comment to a poll
router.post('/poll/:id/comment', isAuthenticated, async (req, res) => {
  const pollId = req.params.id;
  const text = (req.body.commentText || "").trim();
  if (!text) return res.redirect(`/poll/${pollId}`);

  try {
    const pollsCollection = database
      .db(process.env.MONGODB_DATABASE_POLLS)
      .collection('polls');

    const comment = {
      commenter: req.session.user.name,
      commenterPFP: req.session.user.profilePic || 'default.jpg',
      text,
      createdAt: new Date()
    };

    await pollsCollection.updateOne(
      { _id: new ObjectId(pollId) },
      { $push: { comments: comment } }
    );

    res.redirect(`/poll/${pollId}#comments`);
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

module.exports = router;
