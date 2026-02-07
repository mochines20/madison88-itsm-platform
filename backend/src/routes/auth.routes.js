/**
 * Authentication Routes
 * POST /api/auth/login - User login
 * POST /api/auth/logout - User logout
 * POST /api/auth/refresh-token - Refresh JWT token
 */

const express = require('express');
const AuthController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register new user
 */
router.post('/register', AuthController.register);

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and return JWT token
 */
router.post('/login', AuthController.login);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 */
router.post('/logout', async (req, res, next) => {
  try {
    // TODO: Implement logout logic (blacklist token, etc.)

    res.json({
      status: 'success',
      message: 'Logout successful'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh JWT token
 */
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Refresh token is required'
      });
    }

    // TODO: Verify refresh token and generate new access token

    res.json({
      status: 'success',
      data: {
        token: 'new_jwt_token'
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 */
router.get('/me', authenticate, AuthController.me);

module.exports = router;
