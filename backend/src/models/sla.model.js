const db = require('../config/database');

const SlaModel = {
  async listRules() {
    const result = await db.query(
      'SELECT * FROM sla_rules ORDER BY priority ASC, category ASC'
    );
    return result.rows;
  },

  async upsertRule({ priority, category, response_time_hours, resolution_time_hours, escalation_threshold_percent, is_active }) {
    const result = await db.query(
      `INSERT INTO sla_rules (priority, category, response_time_hours, resolution_time_hours, escalation_threshold_percent, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (priority, COALESCE(category, 'GLOBAL_DEFAULT'))
       DO UPDATE SET
         response_time_hours = EXCLUDED.response_time_hours,
         resolution_time_hours = EXCLUDED.resolution_time_hours,
         escalation_threshold_percent = EXCLUDED.escalation_threshold_percent,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()
       RETURNING *`,
      [priority, category || null, response_time_hours, resolution_time_hours, escalation_threshold_percent, is_active]
    );
    return result.rows[0];
  },

  async updateRule(slaId, updates) {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');

    const result = await db.query(
      `UPDATE sla_rules SET ${setClause}, updated_at = NOW() WHERE sla_id = $${keys.length + 1}
       RETURNING *`,
      [...values, slaId]
    );
    return result.rows[0];
  },

  async deleteRule(slaId) {
    const result = await db.query(
      'DELETE FROM sla_rules WHERE sla_id = $1 RETURNING *',
      [slaId]
    );
    return result.rows[0];
  },
};

module.exports = SlaModel;
