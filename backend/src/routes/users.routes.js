const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const UsersController = require('../controllers/users.controller');

const router = express.Router();

// Get current user profile
router.get('/me', authenticate, UsersController.getMe);

// List users (admin or manager)
router.get('/', authenticate, authorize(['system_admin', 'it_manager']), UsersController.listUsers);

// Create user (admin only)
router.post('/', authenticate, authorize(['system_admin']), UsersController.createUser);

// Update user (admin only)
router.patch('/:id', authenticate, authorize(['system_admin']), UsersController.updateUser);

// Reset password for a user (admin only)
router.post('/:id/reset-password', authenticate, authorize(['system_admin']), UsersController.resetPassword);

module.exports = router;
