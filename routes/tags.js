// File: routes/tags.js
const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();
const { database } = require('../config/databaseConnection');
const { isAuthenticated } = require('../middleware/auth');

// GET /manageTags - Show tag management page
router.get('/manageTags', isAuthenticated, async (req, res) => {
  try {
    const pollsColl = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    const myPolls = await pollsColl.find({ createdBy: req.session.email }).toArray();
    const availableTags = ['#DailyLife', '#CulturalViews', '#FamilyMatters', '#MoralChoices', '#PersonalValues', '#PublicOpinion'];

    res.render('manageTags', {
      title: 'Manage Tags',
      polls: myPolls,
      availableTags
    });
  } catch (err) {
    console.error('Error fetching polls for tag management:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// POST /updateTags/:id - Update tags for a specific poll
router.post('/updateTags/:id', isAuthenticated, async (req, res) => {
  try {
    const pollId = req.params.id;
    const selectedTags = req.body.selectedTags || [];

    if (selectedTags.length === 0) {
      return res.redirect('/manageTags');
    }

    const pollsColl = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    await pollsColl.updateOne(
      { _id: new ObjectId(pollId), createdBy: req.session.email },
      { $set: { tags: selectedTags } }
    );

    res.redirect('/manageTags');
  } catch (err) {
    console.error('Error updating tags:', err);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

module.exports = router;
