const UserModel = require('../models/user.model');
const AuthService = require('./auth.service');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UsersService = {
    /**
     * Get formatted user profile
     */
    async getProfile(user) {
        return user;
    },

    /**
     * List users with optional filtering
     */
    async listUsers({ role }) {
        return await UserModel.listUsers({ role });
    },

    /**
     * Create a new user
     * Delegates to AuthService.register but kept here for resource consistency
     */
    async createUser(payload) {
        return await AuthService.register(payload);
    },

    /**
     * Update user details
     * Handles complex logic for role changes and password updates
     */
    async updateUser(userId, payload) {
        // 1. Check if user exists
        const currentUser = await UserModel.findById(userId);
        if (!currentUser) {
            const error = new Error('User not found');
            error.status = 404;
            throw error;
        }

        const { password, ...updates } = payload;
        let temporaryPassword = null;
        let message = null;

        // 2. Check for role change to privileged role
        const isChangingToPrivilegedRole = updates.role &&
            ['it_agent', 'it_manager', 'system_admin'].includes(updates.role) &&
            currentUser.role === 'end_user';

        if (isChangingToPrivilegedRole) {
            if (password) {
                // Admin provided a password - use it
                const passwordHash = await bcrypt.hash(password, 10);
                await UserModel.updatePassword(userId, passwordHash);
            } else {
                // No password provided - generate temporary password
                temporaryPassword = crypto.randomBytes(8).toString('hex');
                const tempPasswordHash = await bcrypt.hash(temporaryPassword, 10);
                await UserModel.updatePassword(userId, tempPasswordHash);

                message = 'User role changed to privileged role. A temporary password has been generated. Please share this password with the user - they must use Email/Password login and should change their password on first login.';
            }
        } else if (password) {
            // Just updating password (if provided) without role change logic
            // Note: Currently the route only allowed password update during role change or if explicitly passed, 
            // but strictly speaking, standard password update should probably be a separate endpoint or guarded.
            // For now, we follow the logic: if password provided in update, update it.
            const passwordHash = await bcrypt.hash(password, 10);
            await UserModel.updatePassword(userId, passwordHash);
        }

        // 3. Update other fields
        const updatedUser = await UserModel.updateUser(userId, updates);

        return {
            user: updatedUser,
            temporary_password: temporaryPassword,
            message,
        };
    },

    /**
     * Reset password for a user (Admin only)
     */
    async resetPassword(userId) {
        const user = await UserModel.findById(userId);
        if (!user) {
            const error = new Error('User not found');
            error.status = 404;
            throw error;
        }

        // Generate temporary password
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const tempPasswordHash = await bcrypt.hash(tempPassword, 10);

        // Update password
        await UserModel.updatePassword(userId, tempPasswordHash);

        return {
            user,
            temporary_password: tempPassword,
            message: 'Password reset successful. A temporary password has been generated. Please share this password with the user - they must use Email/Password login and should change their password on first login.'
        };
    }
};

module.exports = UsersService;
