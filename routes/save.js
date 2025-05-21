// File: routes/save.js
const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();
const { database } = require('../config/databaseConnection');
const { isAuthenticated } = require('../middleware/auth');

// POST /save-poll/:pollId
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

// DELETE /unsave-poll/:pollId
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

module.exports = router;
