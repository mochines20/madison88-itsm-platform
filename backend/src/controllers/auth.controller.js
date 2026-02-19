const Joi = require('joi');
const AuthService = require('../services/auth.service');
const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().min(2).allow('', null),
  first_name: Joi.string().min(2).allow('', null),
  last_name: Joi.string().min(2).allow('', null),
  full_name: Joi.string().min(2).allow('', null),
  password: Joi.string().min(6).required(),
  role: Joi.string()
    .valid('end_user', 'it_agent', 'it_manager', 'system_admin')
    .default('end_user'),
  department: Joi.string().allow('', null),
  location: Joi.string().valid('Philippines', 'US', 'Indonesia', 'China', 'Other').allow('', null),
  phone: Joi.string().allow('', null),
}).required();

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
}).required();

const auth0LoginSchema = Joi.object({
  idToken: Joi.string().required(),
}).required();

function getAuth0Config() {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  if (!domain || !clientId) {
    throw new Error('AUTH0_DOMAIN and AUTH0_CLIENT_ID must be set');
  }
  const issuer = `https://${domain}/`;
  const jwksUri = `https://${domain}/.well-known/jwks.json`;
  return { domain, clientId, issuer, jwksUri };
}

async function verifyAuth0IdToken(idToken) {
  const { clientId, issuer, jwksUri } = getAuth0Config();

  const client = jwksRsa({
    jwksUri,
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
  });

  const getKey = (header, callback) => {
    client.getSigningKey(header.kid, (err, key) => {
      if (err) return callback(err);
      const signingKey = key.getPublicKey();
      return callback(null, signingKey);
    });
  };

  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getKey,
      {
        audience: clientId,
        issuer,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) return reject(err);
        return resolve(decoded);
      }
    );
  });
}

const AuthController = {
  async register(req, res, next) {
    try {
      const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          status: 'error',
          message: error.details.map((detail) => detail.message).join(', '),
        });
      }

      const hasName =
        value.full_name ||
        value.name ||
        (value.first_name && value.last_name);
      if (!hasName) {
        return res.status(400).json({
          status: 'error',
          message: 'Name is required',
        });
      }

      const { email, name, first_name, last_name, full_name, password, role, department, location, phone } = value;
      const user = await AuthService.register({
        email,
        name,
        first_name,
        last_name,
        full_name,
        password,
        role,
        department,
        location,
        phone,
      });
      res.status(201).json({ status: 'success', user });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          status: 'error',
          message: error.details.map((detail) => detail.message).join(', '),
        });
      }
      const { email, password } = value;
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

  async loginWithAuth0(req, res, next) {
    try {
      const { error, value } = auth0LoginSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          status: 'error',
          message: error.details.map((detail) => detail.message).join(', '),
        });
      }

      const claims = await verifyAuth0IdToken(value.idToken);
      const email = claims.email;
      const name = claims.name;
      const sub = claims.sub;

      if (!email) {
        return res.status(400).json({
          status: 'error',
          message: 'Auth0 token does not include email',
        });
      }

      const { token, user } = await AuthService.loginWithAuth0({ email, name, sub });
      res.json({ status: 'success', token, user });
    } catch (err) {
      next(err);
    }
  },

  async logout(req, res, next) {
    try {
      // TODO: Implement logout logic (blacklist token, etc.)
      res.json({
        status: 'success',
        message: 'Logout successful'
      });
    } catch (err) {
      next(err);
    }
  },

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({
          status: 'error',
          message: 'Refresh token is required'
        });
      }

      const result = await AuthService.refreshToken(refreshToken);
      res.json({
        status: 'success',
        data: result
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = AuthController;
