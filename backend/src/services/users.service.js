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
     * Update current user profile
     * Securely allows users to update their own info (email, name, password)
     */
    async updateMe(userId, payload) {
        const { password, ...updates } = payload;

        // Hash password if provided
        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            await UserModel.updatePassword(userId, passwordHash);
        }

        // Update other fields
        if (Object.keys(updates).length > 0) {
            // Refined Identity Sync Logic
            // 1. Sync first/last names if full_name is provided and not an email
            if (updates.full_name && !updates.full_name.includes('@')) {
                if (!updates.first_name || !updates.last_name) {
                    const parts = updates.full_name.trim().split(/\s+/);
                    updates.first_name = parts[0] || "";
                    updates.last_name = parts.slice(1).join(" ") || "";
                }
            }

            // 2. Sync full_name if first_name/last_name provided but full_name is not
            if ((updates.first_name || updates.last_name) && !updates.full_name) {
                const first = updates.first_name || "";
                const last = updates.last_name || "";
                updates.full_name = `${first} ${last}`.trim();
            }

            return await UserModel.updateUser(userId, updates);
        }

        // If only password was updated (or nothing), return the user record
        return await UserModel.findById(userId);
    },

    /**
     * List users with optional filtering
     */
    async listUsers({ role, location, search }) {
        return await UserModel.listUsers({ role, location, search });
    },

    /**
     * Create a new user
     * Delegates to AuthService.register but kept here for resource consistency
     */
    async createUser(payload) {
        const user = await AuthService.register(payload);

        // Auto-assign to regional teams if target is an IT Agent
        if (user.role === 'it_agent' && user.location) {
            await this._assignToRegionalTeams(user.user_id, user.location);
        }

        return user;
    },

    /**
     * Update user details
     * Handles complex logic for role changes, location updates, and password updates
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
            const passwordHash = await bcrypt.hash(password, 10);
            await UserModel.updatePassword(userId, passwordHash);
        }

        // 3. Update other fields
        // Refined Identity Sync Logic
        // 1. Sync first/last names if full_name is provided and not an email
        if (updates.full_name && !updates.full_name.includes('@')) {
            if (!updates.first_name || !updates.last_name) {
                const parts = updates.full_name.trim().split(/\s+/);
                updates.first_name = parts[0] || "";
                updates.last_name = parts.slice(1).join(" ") || "";
            }
        }

        // 2. Sync full_name if first_name/last_name provided but full_name is not
        if ((updates.first_name || updates.last_name) && !updates.full_name) {
            const first = updates.first_name || "";
            const last = updates.last_name || "";
            updates.full_name = `${first} ${last}`.trim();
        }

        const updatedUser = await UserModel.updateUser(userId, updates);

        // 4. Handle team auto-assignment on role or location change
        const roleChangedToAgent = updates.role === 'it_agent' && currentUser.role !== 'it_agent';
        const locationChanged = updates.location && updates.location !== currentUser.location;
        const isTargetAgent = updatedUser.role === 'it_agent';

        if (isTargetAgent && (roleChangedToAgent || locationChanged)) {
            await this._assignToRegionalTeams(updatedUser.user_id, updatedUser.location);
        }

        return {
            user: updatedUser,
            temporary_password: temporaryPassword,
            message,
        };
    },

    /**
     * Helper to assign a user to all teams in a specific location
     * @private
     */
    async _assignToRegionalTeams(userId, location) {
        if (!location) return;
        const TicketsModel = require('../models/tickets.model');
        try {
            const teams = await TicketsModel.listTeamsByLocation(location);
            if (teams && teams.length > 0) {
                for (const team of teams) {
                    await TicketsModel.addMemberToTeam(userId, team.team_id);
                }
                console.log(`Successfully auto-assigned user ${userId} to ${teams.length} teams in ${location}`);
            }
        } catch (err) {
            console.error(`Failed to auto-assign user ${userId} to teams in ${location}:`, err);
        }
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
    },

    /**
     * Add an existing user to a team by email
     * Enforces role and location boundaries for Managers
     */
    async addTeamMemberByEmail({ email, managerId, managerLocation }) {
        const user = await UserModel.findByEmail(email);
        if (!user) {
            const error = new Error('No user found with this email address');
            error.status = 404;
            throw error;
        }

        if (user.role !== 'it_agent') {
            const error = new Error('Only IT Agents can be added to the technical team');
            error.status = 400;
            throw error;
        }

        if (managerLocation && user.location !== managerLocation) {
            const error = new Error(`Location mismatch: You can only add agents from the ${managerLocation} region`);
            error.status = 403;
            throw error;
        }

        // Import TicketsModel dynamically to avoid circular dependency if any exists or just use it
        const TicketsModel = require('../models/tickets.model');
        const teams = await TicketsModel.listTeamsByLead(managerId);

        if (!teams || teams.length === 0) {
            const error = new Error('You do not have any teams assigned to lead');
            error.status = 403;
            throw error;
        }

        const membership = await TicketsModel.addMemberToTeam(user.user_id, teams[0].team_id);
        return { user, team: teams[0], membership };
    }
};

module.exports = UsersService;
