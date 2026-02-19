const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.model');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ status: 'error', message: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await UserModel.findById(payload.user_id);
    if (!user || !user.is_active) return res.status(401).json({ status: 'error', message: 'Invalid user' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
  }
}

function authorize(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Missing or invalid token' });
    }
    // Global admins can access everything
    if (req.user.role === 'system_admin') {
      return next();
    }
    if (!roles.length || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ status: 'error', message: 'Forbidden: insufficient permissions' });
  };
}

module.exports = { authenticate, authorize };
