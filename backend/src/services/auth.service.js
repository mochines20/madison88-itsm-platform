const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.model');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const AuthService = {
  async register({ email, name, first_name, last_name, full_name, password, role, department, location, phone }) {
    const existing = await UserModel.findByEmail(email);
    if (existing) throw new Error('Email already registered');

    const resolvedFirst = first_name || (name ? name.split(' ')[0] : undefined);
    const resolvedLast = last_name || (name ? name.split(' ').slice(1).join(' ') : undefined);
    const resolvedFull = full_name || name || [resolvedFirst, resolvedLast].filter(Boolean).join(' ').trim();

    if (!resolvedFirst || !resolvedLast || !resolvedFull) {
      throw new Error('Name is required');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      email,
      first_name: resolvedFirst,
      last_name: resolvedLast,
      full_name: resolvedFull,
      passwordHash,
      role,
      department,
      location,
      phone,
    });
    return user;
  },

  async login({ email, password }) {
    const user = await UserModel.findByEmail(email);
    if (!user) throw new Error('Invalid email or password');
    if (!user.is_active) throw new Error('Account is inactive. Please contact your administrator.');
    if (!user.password_hash) throw new Error('Invalid email or password');
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new Error('Invalid email or password');
    await UserModel.updateLastLogin(user.user_id);
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    return { token, user };
  },

  verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  },

  async loginWithAuth0({ email, name, sub }) {
    // Find or create user based on Auth0 email
    let user = await UserModel.findByEmail(email);

    if (!user) {
      // Auto-create user if doesn't exist (you may want to change this behavior)
      const nameParts = name ? name.split(' ') : ['User', 'Account'];
      const first_name = nameParts[0] || 'User';
      const last_name = nameParts.slice(1).join(' ') || 'Account';
      const full_name = name || `${first_name} ${last_name}`;

      // Users table requires PASSWORD_HASH NOT NULL, so generate an unreachable random password hash
      const randomSecret = crypto.randomBytes(32).toString('hex') + (sub ? `:${sub}` : '');
      const passwordHash = await bcrypt.hash(randomSecret, 10);

      user = await UserModel.create({
        email,
        first_name,
        last_name,
        full_name,
        passwordHash,
        // Employee default role (can be updated by admin later)
        role: process.env.AUTH0_DEFAULT_ROLE || 'end_user',
        department: null,
        location: null,
        phone: null,
      });
    } else if (!user.is_active) {
      throw new Error('Account is inactive');
    } else if (user.role !== 'end_user') {
      // Force privileged roles to use local login as requested
      throw new Error('This account must use Email/Password login');
    }

    // Update last login
    await UserModel.updateLastLogin(user.user_id);

    // Generate our system JWT token
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return { token, user };
  },

  async refreshToken(refreshToken) {
    // TODO: Implement actual refresh token verification logic
    // For now, we'll just return a mock token if a refresh token is provided
    if (!refreshToken) throw new Error('Refresh token is required');

    // In a real implementation:
    // 1. Verify refreshToken (check signature, expiration, database whitelist)
    // 2. Get user from refreshToken
    // 3. Generate new access token

    return { token: 'new_jwt_token' };
  },
};

module.exports = AuthService;
