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
 * @route POST /api/auth/auth0-login
 * @desc Exchange Auth0 token for system JWT token
 */
router.post('/auth0-login', AuthController.loginWithAuth0);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 */
router.post('/logout', AuthController.logout);

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh JWT token
 */
router.post('/refresh-token', AuthController.refreshToken);

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 */
router.get('/me', authenticate, AuthController.me);

module.exports = router;
