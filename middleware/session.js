// File: middleware/session.js
const session = require('express-session');
const MongoStore = require('connect-mongo');

const {
  MONGODB_USER,
  MONGODB_PASSWORD,
  MONGODB_HOST,
  MONGODB_DATABASE_SESSIONS,
  MONGODB_SESSION_SECRET,
  NODE_SESSION_SECRET
} = process.env;

const sessionMiddleware = session({
  secret: NODE_SESSION_SECRET,
  store: MongoStore.create({
    mongoUrl: `mongodb+srv://${MONGODB_USER}:${MONGODB_PASSWORD}@${MONGODB_HOST}/${MONGODB_DATABASE_SESSIONS}?retryWrites=true&w=majority`,
    collectionName: 'sessions',
    crypto: { secret: MONGODB_SESSION_SECRET }
  }),
  saveUninitialized: false,
  resave: true
});

module.exports = { sessionMiddleware };
