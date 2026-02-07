// User model for PostgreSQL (using pg)
// This is a simple data access layer, not an ORM
const db = require('../config/database');

const UserModel = {
  async findByEmail(email) {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },
  async findById(userId) {
    const result = await db.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    return result.rows[0];
  },
  async create({ email, name, passwordHash, role, department, location, phone }) {
    const result = await db.query(
      `INSERT INTO users (email, name, password, role, department, location, phone, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW()) RETURNING *`,
      [email, name, passwordHash, role, department, location, phone]
    );
    return result.rows[0];
  },
  async updateLastLogin(userId) {
    await db.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [userId]);
  },
};

module.exports = UserModel;
