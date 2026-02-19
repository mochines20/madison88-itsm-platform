const db = require('../config/database');

const AssetsModel = {
  async listAssets({ status, asset_type, assigned_user_id, location }) {
    const where = [];
    const values = [];

    if (status) {
      values.push(status);
      where.push(`a.status = $${values.length}`);
    }
    if (asset_type) {
      values.push(asset_type);
      where.push(`a.asset_type = $${values.length}`);
    }
    if (assigned_user_id) {
      values.push(assigned_user_id);
      where.push(`a.assigned_user_id = $${values.length}`);
    }
    if (location) {
      values.push(location);
      where.push(`a.location = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT a.asset_id, a.asset_tag, a.serial_number, a.asset_type, a.model, a.manufacturer,
              a.assigned_user_id, a.location, a.purchase_date, a.warranty_expiration,
              a.last_maintenance_date, a.next_maintenance_date, a.cost, a.currency, a.status,
              a.created_at, a.updated_at,
              COUNT(t.ticket_id)::int AS ticket_count,
              SUM(CASE WHEN t.status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END)::int AS open_ticket_count,
              COALESCE(AVG(CASE WHEN t.status NOT IN ('Resolved', 'Closed')
                                 THEN EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 86400
                           END), 0) AS avg_open_age_days
       FROM it_assets a
       LEFT JOIN asset_tickets at ON at.asset_id = a.asset_id
       LEFT JOIN tickets t ON t.ticket_id = at.ticket_id
       ${whereClause}
       GROUP BY a.asset_id
       ORDER BY a.created_at DESC`,
      values
    );
    return result.rows;
  },

  async getAssetById(assetId) {
    const result = await db.query(
      `SELECT a.asset_id, a.asset_tag, a.serial_number, a.asset_type, a.model, a.manufacturer,
              a.assigned_user_id, a.location, a.purchase_date, a.warranty_expiration,
              a.last_maintenance_date, a.next_maintenance_date, a.cost, a.currency, a.status,
              a.created_at, a.updated_at,
              COUNT(t.ticket_id)::int AS ticket_count,
              SUM(CASE WHEN t.status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END)::int AS open_ticket_count,
              COALESCE(AVG(CASE WHEN t.status NOT IN ('Resolved', 'Closed')
                                 THEN EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 86400
                           END), 0) AS avg_open_age_days
       FROM it_assets a
       LEFT JOIN asset_tickets at ON at.asset_id = a.asset_id
       LEFT JOIN tickets t ON t.ticket_id = at.ticket_id
       WHERE a.asset_id = $1
       GROUP BY a.asset_id`,
      [assetId]
    );
    return result.rows[0];
  },

  async createAsset(data) {
    const result = await db.query(
      `INSERT INTO it_assets
        (asset_tag, serial_number, asset_type, model, manufacturer, assigned_user_id,
         location, purchase_date, warranty_expiration, last_maintenance_date,
         next_maintenance_date, cost, currency, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        data.asset_tag,
        data.serial_number,
        data.asset_type,
        data.model,
        data.manufacturer,
        data.assigned_user_id,
        data.location,
        data.purchase_date,
        data.warranty_expiration,
        data.last_maintenance_date,
        data.next_maintenance_date,
        data.cost,
        data.currency,
        data.status
      ]
    );
    return result.rows[0];
  },

  async updateAsset(assetId, updates) {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');

    const result = await db.query(
      `UPDATE it_assets SET ${setClause}, updated_at = NOW() WHERE asset_id = $${keys.length + 1} RETURNING *`,
      [...values, assetId]
    );
    return result.rows[0];
  },

  async listAssetTickets(assetId) {
    const result = await db.query(
      `SELECT at.association_id, at.asset_id, at.ticket_id, at.associated_at, t.ticket_number, t.title, t.status
       FROM asset_tickets at
       JOIN tickets t ON t.ticket_id = at.ticket_id
       WHERE at.asset_id = $1
       ORDER BY at.associated_at DESC`,
      [assetId]
    );
    return result.rows;
  },

  async listTicketAssets(ticketId) {
    const result = await db.query(
      `SELECT at.association_id, at.asset_id, at.ticket_id, at.associated_at,
              a.asset_tag, a.asset_type, a.manufacturer, a.model, a.status
       FROM asset_tickets at
       JOIN it_assets a ON a.asset_id = at.asset_id
       WHERE at.ticket_id = $1
       ORDER BY at.associated_at DESC`,
      [ticketId]
    );
    return result.rows;
  },

  async linkAssetTicket(assetId, ticketId) {
    const result = await db.query(
      `INSERT INTO asset_tickets (asset_id, ticket_id)
       VALUES ($1, $2)
       ON CONFLICT (asset_id, ticket_id) DO NOTHING
       RETURNING *`,
      [assetId, ticketId]
    );
    return result.rows[0];
  },

  async touchAsset(assetId) {
    const result = await db.query(
      'UPDATE it_assets SET updated_at = NOW() WHERE asset_id = $1 RETURNING asset_id',
      [assetId]
    );
    return result.rows[0];
  },
};

module.exports = AssetsModel;
