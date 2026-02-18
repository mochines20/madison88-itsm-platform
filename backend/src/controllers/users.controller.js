const UsersService = require('../services/users.service');
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

    async listUsers(req, res, next) {
        try {
            const role = req.query.role || null;
            const users = await UsersService.listUsers({ role });
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
                location: Joi.string().valid('Philippines', 'US', 'Indonesia', 'Other').allow('', null),
                phone: Joi.string().allow('', null),
            });
            const { error, value } = schema.validate(req.body, { abortEarly: false });
            if (error) {
                const err = new Error(error.details.map((d) => d.message).join(', '));
                err.status = 400;
                throw err;
            }

            const user = await UsersService.createUser(value);
            res.status(201).json({ status: 'success', data: { user } });
        } catch (err) {
            next(err);
        }
    },

    async updateUser(req, res, next) {
        try {
            const schema = Joi.object({
                role: Joi.string().valid('end_user', 'it_agent', 'it_manager', 'system_admin'),
                department: Joi.string().allow('', null),
                location: Joi.string().valid('Philippines', 'US', 'Indonesia', 'Other').allow('', null),
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
    }
};

module.exports = UsersController;
