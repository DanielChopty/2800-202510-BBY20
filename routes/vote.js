// File: routes/vote.js
const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();
const { database } = require('../config/databaseConnection');
const { isAuthenticated } = require('../middleware/auth');

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

module.exports = router;
