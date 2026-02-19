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
  async create({ email, first_name, last_name, full_name, passwordHash, role, department, location, phone }) {
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, full_name, role, department, location, phone, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW()) RETURNING *`,
      [email, passwordHash, first_name, last_name, full_name, role, department, location, phone]
    );
    return result.rows[0];
  },
  async updateLastLogin(userId) {
    await db.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [userId]);
  },

  async listUsers({ role, location, search } = {}) {
    const conditions = [];
    const values = [];

    if (role) {
      values.push(role);
      conditions.push(`role = $${values.length}`);
    }

    if (location) {
      values.push(location);
      conditions.push(`location = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(email ILIKE $${values.length} OR full_name ILIKE $${values.length})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT user_id, email, full_name, role, department, location, phone, is_active, created_at 
       FROM users ${whereClause} ORDER BY created_at DESC`,
      values
    );
    return result.rows;
  },

  async updateUser(userId, updates) {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');

    const result = await db.query(
      `UPDATE users SET ${setClause}, updated_at = NOW() WHERE user_id = $${keys.length + 1} RETURNING *`,
      [...values, userId]
    );
    return result.rows[0];
  },

  async updatePassword(userId, passwordHash) {
    const result = await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2 RETURNING user_id, email, full_name, role',
      [passwordHash, userId]
    );
    return result.rows[0];
  },

  async listByIds(userIds) {
    if (!userIds || !userIds.length) return [];
    const result = await db.query(
      'SELECT user_id, email, full_name, role FROM users WHERE user_id = ANY($1)',
      [userIds]
    );
    return result.rows;
  },
};

module.exports = UserModel;
