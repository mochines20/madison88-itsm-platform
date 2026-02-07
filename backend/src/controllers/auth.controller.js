const AuthService = require('../services/auth.service');

const AuthController = {
  async register(req, res, next) {
    try {
      const { email, name, password, role, department, location, phone } = req.body;
      const user = await AuthService.register({ email, name, password, role, department, location, phone });
      res.status(201).json({ status: 'success', user });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const { token, user } = await AuthService.login({ email, password });
      res.json({ status: 'success', token, user });
    } catch (err) {
      next(err);
    }
  },

  async me(req, res, next) {
    try {
      res.json({ status: 'success', user: req.user });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = AuthController;
