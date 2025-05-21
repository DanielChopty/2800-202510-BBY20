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

// POST vote on a poll
router.post('/vote', isAuthenticated, async (req, res) => {
  const { pollId, choiceText } = req.body;
  const userVotedPolls = req.session.votedPolls || {};

  if (userVotedPolls[pollId]) {
    return res.status(403).send('You have already voted on this poll.');
  }

  try {
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    const poll = await pollsCollection.findOne({ _id: new ObjectId(pollId) });
    if (!poll) return res.status(404).send('Poll not found');

    const choiceIndex = poll.choices.findIndex(c => c.text === choiceText);
    if (choiceIndex === -1) return res.status(400).send('Invalid choice');

    poll.choices[choiceIndex].votes += 1;
    await pollsCollection.updateOne({ _id: new ObjectId(pollId) }, { $set: { choices: poll.choices } });

    const usersColl = database.db(process.env.MONGODB_DATABASE_USERS).collection('users');
    await usersColl.updateOne(
      { email: req.session.email },
      { $set: { [`votedPolls.${pollId}`]: choiceText } }
    );

    userVotedPolls[pollId] = choiceText;
    req.session.votedPolls = userVotedPolls;

    const returnTo = req.get('Referer') || '/polls';
    res.redirect(returnTo);
  } catch (err) {
    console.error('Error processing vote:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// POST unvote
router.post('/unvote', isAuthenticated, async (req, res) => {
  const { pollId } = req.body;
  const userVotedPolls = req.session.votedPolls || {};
  const choiceText = userVotedPolls[pollId];

  if (!choiceText) return res.redirect('/polls');

  try {
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    const poll = await pollsCollection.findOne({ _id: new ObjectId(pollId) });
    if (!poll) return res.redirect('/polls');

    const idx = poll.choices.findIndex(c => c.text === choiceText);
    if (idx > -1 && poll.choices[idx].votes > 0) {
      poll.choices[idx].votes -= 1;
      await pollsCollection.updateOne(
        { _id: new ObjectId(pollId) },
        { $set: { choices: poll.choices } }
      );
    }

    const usersColl = database.db(process.env.MONGODB_DATABASE_USERS).collection('users');
    await usersColl.updateOne(
      { email: req.session.email },
      { $unset: { [`votedPolls.${pollId}`]: "" } }
    );

    delete userVotedPolls[pollId];
    req.session.votedPolls = userVotedPolls;

    const returnTo = req.get('Referer') || '/polls';
    res.redirect(returnTo);
  } catch (err) {
    console.error('Error unvoting:', err);
    res.status(500).send('Error unvoting');
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

// POST /save-poll/:pollId - Save a poll to the current user's list
router.post('/save-poll/:pollId', isAuthenticated, async (req, res) => {
  try {
    const pollId = req.params.pollId;
    const userId = req.session.user._id;

    const userCollection = database.db(process.env.MONGODB_DATABASE_USERS).collection('users');
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');

    if (!ObjectId.isValid(pollId)) {
      return res.status(400).json({ message: 'Invalid poll ID' });
    }

    const user = await userCollection.findOne({ _id: new ObjectId(userId) });
    const poll = await pollsCollection.findOne({ _id: new ObjectId(pollId) });

    if (!user || !poll) {
      return res.status(404).json({ message: 'User or poll not found' });
    }

    if (!user.savedPolls) {
      await userCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { savedPolls: [] } });
      user.savedPolls = [];
    }

    const alreadySaved = user.savedPolls.some(id => id.equals(new ObjectId(pollId)));
    if (!alreadySaved) {
      await userCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $push: { savedPolls: new ObjectId(pollId) } }
      );

      if (!req.session.user.savedPolls) {
        req.session.user.savedPolls = [];
      }
      req.session.user.savedPolls.push(pollId);

      return res.status(200).json({ message: 'Poll saved successfully' });
    } else {
      return res.status(200).json({ message: 'Poll already saved' });
    }
  } catch (error) {
    console.error('Error saving poll:', error);
    res.status(500).json({ message: 'Failed to save poll' });
  }
});

// DELETE /unsave-poll/:pollId - Remove a saved poll
router.delete('/unsave-poll/:pollId', isAuthenticated, async (req, res) => {
  try {
    const pollId = req.params.pollId;
    const userId = req.session.user._id;

    const userCollection = database.db(process.env.MONGODB_DATABASE_USERS).collection('users');

    if (!ObjectId.isValid(pollId)) {
      return res.status(400).json({ message: 'Invalid poll ID' });
    }

    await userCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $pull: { savedPolls: new ObjectId(pollId) } }
    );

    if (Array.isArray(req.session.user.savedPolls)) {
      req.session.user.savedPolls = req.session.user.savedPolls.filter(id => id.toString() !== pollId.toString());
    }

    return res.status(200).json({ message: 'Poll unsaved successfully' });
  } catch (error) {
    console.error('Error unsaving poll:', error);
    res.status(500).json({ message: 'Failed to unsave poll' });
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
