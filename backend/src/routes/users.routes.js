const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const UserModel = require('../models/user.model');

const router = express.Router();

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
  res.json({ status: 'success', user: req.user });
});

// List all users (admin only)
router.get('/', authenticate, authorize(['admin', 'IT Manager']), async (req, res) => {
  // TODO: Add pagination
  const result = await req.app.get('db').query('SELECT * FROM users');
  res.json({ status: 'success', users: result.rows });
});

// Update user (admin only)
router.patch('/:id', authenticate, authorize(['admin', 'IT Manager']), async (req, res) => {
  // TODO: Implement update logic
  res.status(501).json({ status: 'error', message: 'Not implemented' });
});

module.exports = router;
