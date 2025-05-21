// File: middleware/auth.js

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (!req.session.authenticated) {
    return res.redirect('/login');
  }
  if (req.session.user?.user_type === 'admin') {
    return next();
  }
  res.status(403).render('403', { title: 'Forbidden' });
}

module.exports = { isAuthenticated, isAdmin };
