const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { database } = require('../config/databaseConnection');
const upload = require('../config/multerConfig');
const { isAuthenticated } = require('../middleware/auth');

// GET /profile - user profile page
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const userCollection = database.db(process.env.MONGODB_DATABASE_USERS).collection('users');
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');

    const user = await userCollection.findOne({ email: req.session.email });
    if (!user) return res.redirect('/');

    // Fetch saved polls
    let savedPollsData = [];
    if (user.savedPolls?.length > 0) {
      savedPollsData = await pollsCollection
        .find({ _id: { $in: user.savedPolls.map(id => new ObjectId(id)) } })
        .toArray();
    }

    // Fetch available polls and count how many the user hasn't voted on
    const allAvailablePolls = await pollsCollection.find({ available: true }).toArray();
    const votedPolls = user.votedPolls || {};
    const newPollCount = allAvailablePolls.filter(p => !votedPolls[p._id.toString()]).length;

    // Handle message from feelings input
    const personalizedMessage = req.session.personalizedMessage || '';
    req.session.personalizedMessage = '';

    res.render('profile', {
      title: 'Profile',
      username: user.name,
      user,
      savedPolls: savedPollsData,
      personalizedMessage,
      newPollCount
    });
  } catch (error) {
    console.error('Error rendering profile page:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// POST /upload-profile-picture - handle profile pic upload
router.post('/upload-profile-picture', upload.single('profilePic'), async (req, res) => {
  if (!req.file) return res.send('Please upload a valid image file');

  const profilePicPath = 'uploads/' + req.file.filename;

  try {
    const userCollection = database.db(process.env.MONGODB_DATABASE_USERS).collection('users');
    await userCollection.updateOne(
      { email: req.session.email },
      { $set: { profilePic: profilePicPath } }
    );

    req.session.user.profilePic = profilePicPath;

    const pollsColl = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    await pollsColl.updateMany(
      { "comments.commenter": req.session.user.name },
      { $set: { "comments.$[c].commenterPFP": profilePicPath } },
      { arrayFilters: [{ "c.commenter": req.session.user.name }] }
    );

    res.redirect('/profile');
  } catch (error) {
    console.error('Error updating profile picture:', error);
    res.status(500).send('Error updating profile picture');
  }
});

// POST /update-feelings - generate a personalized message
router.post('/update-feelings', async (req, res) => {
  try {
    const feelings = req.body.feelings;
    let personalizedMessage = '';

    if (feelings) {
      const firstLetter = feelings.trim().charAt(0).toLowerCase();

      const messages = {
        a: ['An apple a day keeps the doctor away!', 'Always aim for the stars!', 'Adversity builds character.'],
        b: ['Bouncing back from challenges makes you stronger!', 'Be the change you wish to see.', 'Bravery is not the absence of fear, but the strength to face it.'],
        c: ['Creativity is the key to unlocking new possibilities.', 'Change is the only constant in life.', 'Courage is resistance to fear, mastery of fear, not absence of fear.'],
        d: ['Dare to dream big and make it happen!', 'Determination is the key to success.', 'Don’t let yesterday take up too much of today.'],
        e: ['Every day is a new opportunity to shine!', 'Embrace the journey, not just the destination.', 'Energy and persistence conquer all things.'],
        f: ['Feelings are like waves; they come and go.', 'Fear is a natural reaction to moving closer to the truth.', 'Follow your dreams, they know the way.'],
        g: ['Great things are coming your way!', 'Growth is the key to progress.', 'Good things come to those who hustle.'],
        h: ['Happiness is a journey, not a destination.', 'Hard work beats talent when talent doesn’t work hard.', 'Hope is the thing with feathers.'],
        i: ['Inspiration is everywhere, just open your eyes!', 'It always seems impossible until it’s done.', 'Imagination is more important than knowledge.'],
        j: ['Jump into the future with excitement and curiosity!', 'Just keep going; don’t stop.', 'Joy is the simplest form of gratitude.'],
        k: ['Keep going, the best is yet to come!', 'Kindness is a language which the deaf can hear and the blind can see.', 'Knowledge is power.'],
        l: ['Life is a beautiful ride, enjoy the journey!', 'Learn as if you will live forever.', 'Love yourself first and everything else falls into line.'],
        m: ['Make today amazing by making it yours.', 'Motivation is what gets you started. Habit is what keeps you going.', 'Mistakes are proof that you are trying.'],
        n: ['Never give up on yourself, you’ve got this!', 'Nothing worth having comes easy.', 'No one is you and that is your power.'],
        o: ['Opportunities are everywhere, seize them!', 'Only in the darkness can you see the stars.', 'One day or day one. You decide.'],
        p: ['Positivity is a magnet for good things!', 'Push yourself because no one else is going to do it for you.', 'Patience is not the ability to wait, but the ability to keep a good attitude while waiting.'],
        q: ['Questions lead to discovery, so keep asking!', 'Quality over quantity.', 'Quick minds think alike.'],
        r: ['Reach for the stars, you’re capable of greatness!', 'Relax and let it flow.', 'Resilience is the key to overcoming any obstacle.'],
        s: ['Sometimes the smallest step in the right direction can end up being the biggest step of your life.', 'Success is the sum of small efforts, repeated day in and day out.', 'Start where you are. Use what you have. Do what you can.'],
        t: ['Take time to appreciate the little things.', 'The best time to plant a tree was 20 years ago. The second best time is now.', 'The only way to do great work is to love what you do.'],
        u: ['Understand that setbacks are just setups for comebacks!', 'Use your power to create a life you love.', 'Unity is strength.'],
        v: ['Victory is sweetest when you’ve faced challenges.', 'Vision without action is merely a dream.', 'Value the moments that make you smile.'],
        w: ['Winning starts with believing in yourself.', 'With hard work and determination, everything is possible.', 'What we think, we become.'],
        x: ['X marks the spot where your adventure begins!', 'Xcellence is the key to success.', 'Xplore new possibilities every day.'],
        y: ['You are stronger than you think!', 'You miss 100% of the shots you don’t take.', 'You are what you believe yourself to be.'],
        z: ['Zoom into the future with confidence and courage!', 'Zest for life is the key to happiness.', 'Zero regrets, just lessons learned.']
      };

      const letterMessages = messages[firstLetter] || ['Thanks for sharing! You are unique and awesome!'];
      personalizedMessage = letterMessages[Math.floor(Math.random() * letterMessages.length)];
    }

    const userCollection = database.db(process.env.MONGODB_DATABASE_USERS).collection('users');
    const pollsCollection = database.db(process.env.MONGODB_DATABASE_POLLS).collection('polls');
    const user = await userCollection.findOne({ email: req.session.email });

    let savedPollsData = [];
    if (user.savedPolls?.length > 0) {
      savedPollsData = await pollsCollection.find({ _id: { $in: user.savedPolls.map(id => new ObjectId(id)) } }).toArray();
    }

    if (!user) return res.redirect('/');

    res.render('profile', {
      title: 'Profile',
      username: user.name,
      user,
      savedPolls: savedPollsData,
      personalizedMessage
    });
  } catch (error) {
    console.error('Error updating feelings:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

module.exports = router;
