const UsersService = require('../services/users.service');
const TicketsModel = require('../models/tickets.model');
const Joi = require('joi');

const UsersController = {
    async getMe(req, res, next) {
        try {
            // req.user is already set by authenticate middleware
            res.json({ status: 'success', user: req.user });
        } catch (err) {
            next(err);
        }
    },

    async updateMe(req, res, next) {
        try {
            const schema = Joi.object({
                first_name: Joi.string(),
                last_name: Joi.string(),
                full_name: Joi.string(),
                email: Joi.string().email(),
                password: Joi.string().min(6),
                phone: Joi.string().allow('', null),
                department: Joi.string().allow('', null)
            }).min(1);

            const { error, value } = schema.validate(req.body, { abortEarly: false });
            if (error) {
                const err = new Error(error.details.map((d) => d.message).join(', '));
                err.status = 400;
                throw err;
            }

            const updatedUser = await UsersService.updateMe(req.user.user_id, value);
            // Strip sensitive fields before sending to client
            const { password_hash, ...safeUser } = updatedUser;
            res.json({ status: 'success', data: { user: safeUser } });
        } catch (err) {
            next(err);
        }
    },

    async listUsers(req, res, next) {
        try {
            const role = req.query.role || null;
            let location = req.query.location || null;
            const search = req.query.search || null;

            // Strict isolation: IT Managers only see users in their own location
            if (req.user.role === 'it_manager' && req.user.location) {
                location = req.user.location;
            }

            const users = await UsersService.listUsers({ role, location, search });
            res.json({ status: 'success', data: { users } });
        } catch (err) {
            next(err);
        }
    },

    async createUser(req, res, next) {
        try {
            const schema = Joi.object({
                email: Joi.string().email().required(),
                first_name: Joi.string().required(),
                last_name: Joi.string().required(),
                full_name: Joi.string().required(),
                password: Joi.string().min(6).required(),
                role: Joi.string().valid('end_user', 'it_agent', 'it_manager', 'system_admin').required(),
                department: Joi.string().allow('', null),
                location: Joi.string().valid('Philippines', 'US', 'Indonesia', 'China', 'Other').allow('', null),
                phone: Joi.string().allow('', null),
            });
            const { error, value } = schema.validate(req.body, { abortEarly: false });
            if (error) {
                const err = new Error(error.details.map((d) => d.message).join(', '));
                err.status = 400;
                throw err;
            }

            // Security enforcement for IT Managers
            if (req.user.role === 'it_manager') {
                // IT Managers can only create IT Agents
                value.role = 'it_agent';
                // IT Managers can only create users in their own location
                value.location = req.user.location;
            }

            const user = await UsersService.createUser(value);

            // Auto-enroll in manager's primary team if applicable
            if (req.user.role === 'it_manager') {
                try {
                    const teams = await TicketsModel.listTeamsByLead(req.user.user_id);
                    if (teams && teams.length > 0) {
                        await TicketsModel.addMemberToTeam(user.user_id, teams[0].team_id);
                    }
                } catch (teamErr) {
                    console.error('Failed to auto-assign agent to team:', teamErr);
                    // We don't fail the whole request since the user was created successfully
                }
            }

            res.status(201).json({ status: 'success', data: { user } });
        } catch (err) {
            next(err);
        }
    },

    async updateUser(req, res, next) {
        try {
            const schema = Joi.object({
                email: Joi.string().email(),
                first_name: Joi.string(),
                last_name: Joi.string(),
                full_name: Joi.string(),
                role: Joi.string().valid('end_user', 'it_agent', 'it_manager', 'system_admin'),
                department: Joi.string().allow('', null),
                location: Joi.string().valid('Philippines', 'US', 'Indonesia', 'China', 'Other').allow('', null),
                phone: Joi.string().allow('', null),
                is_active: Joi.boolean(),
                // Optional password for role changes or direct updates
                password: Joi.string().min(6).allow('', null),
            }).min(1);

            const { error, value } = schema.validate(req.body, { abortEarly: false });
            if (error) {
                const err = new Error(error.details.map((d) => d.message).join(', '));
                err.status = 400;
                throw err;
            }

            const result = await UsersService.updateUser(req.params.id, value);

            // result contains user, temporary_password (optional), message (optional)
            res.json({
                status: 'success',
                data: result
            });
        } catch (err) {
            next(err);
        }
    },

    async resetPassword(req, res, next) {
        try {
            const result = await UsersService.resetPassword(req.params.id);
            res.json({
                status: 'success',
                data: result
            });
        } catch (err) {
            next(err);
        }
    },

    async addTeamMemberByEmail(req, res, next) {
        try {
            const schema = Joi.object({
                email: Joi.string().email().required()
            });
            const { error, value } = schema.validate(req.body);
            if (error) {
                const err = new Error(error.details[0].message);
                err.status = 400;
                throw err;
            }

            const result = await UsersService.addTeamMemberByEmail({
                email: value.email,
                managerId: req.user.user_id,
                managerLocation: req.user.role === 'it_manager' ? req.user.location : null
            });

            res.json({
                status: 'success',
                message: 'Agent successfully added to your team',
                data: result
            });
        } catch (err) {
            next(err);
        }
    }
};

module.exports = UsersController;
