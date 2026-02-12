const db = require('../config/database');

const TicketsModel = {
  async getLatestTicketNumber(year) {
    const result = await db.query(
      'SELECT ticket_number FROM tickets WHERE ticket_number LIKE $1 ORDER BY created_at DESC LIMIT 1',
      [`TKT-${year}-%`]
    );
    return result.rows[0]?.ticket_number || null;
  },

  async getSlaRule(priority) {
    const result = await db.query('SELECT * FROM sla_rules WHERE priority = $1 AND is_active = true', [priority]);
    return result.rows[0];
  },

  async createTicket(data) {
    const result = await db.query(
      `INSERT INTO tickets
        (ticket_number, user_id, category, subcategory, priority, title, description, business_impact, status, location, tags, ticket_type, sla_due_date, sla_response_due, assigned_team, assigned_to, assigned_at, assigned_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        data.ticket_number,
        data.user_id,
        data.category,
        data.subcategory,
        data.priority,
        data.title,
        data.description,
        data.business_impact,
        data.status,
        data.location,
        data.tags,
        data.ticket_type || 'incident',
        data.sla_due_date,
        data.sla_response_due,
        data.assigned_team || null,
        data.assigned_to || null,
        data.assigned_at || null,
        data.assigned_by || null,
      ]
    );
    return result.rows[0];
  },

  async getClassificationRules() {
    const result = await db.query(
      `SELECT * FROM classification_rules WHERE is_active = true ORDER BY order_priority ASC, created_at ASC`
    );
    return result.rows;
  },

  async getRoutingRule({ category, subcategory, location }) {
    const result = await db.query(
      `SELECT * FROM routing_rules
       WHERE is_active = true
         AND category = $1
         AND (subcategory = $2 OR subcategory IS NULL)
         AND (location = $3 OR location IS NULL)
       ORDER BY order_priority ASC
       LIMIT 1`,
      [category, subcategory || null, location || null]
    );
    return result.rows[0];
  },

  async getLeastLoadedAgent(teamId) {
    const result = await db.query(
      `SELECT tm.user_id, COUNT(t.ticket_id) AS open_count
       FROM team_members tm
       LEFT JOIN tickets t
         ON t.assigned_to = tm.user_id
        AND t.status NOT IN ('Resolved', 'Closed')
       WHERE tm.team_id = $1 AND tm.is_active = true
       GROUP BY tm.user_id
       ORDER BY open_count ASC
       LIMIT 1`,
      [teamId]
    );
    return result.rows[0]?.user_id || null;
  },

  async listTickets(filters, pagination) {
    const where = [];
    const values = [];

    if (filters.status) {
      values.push(filters.status);
      where.push(`status = $${values.length}`);
    }
    if (filters.priority) {
      values.push(filters.priority);
      where.push(`priority = $${values.length}`);
    }
    if (filters.category) {
      values.push(filters.category);
      where.push(`category = $${values.length}`);
    }
    if (filters.location) {
      values.push(filters.location);
      where.push(`location = $${values.length}`);
    }
    if (filters.q) {
      values.push(`%${filters.q}%`);
      const idx = values.length;
      where.push(
        `(title ILIKE $${idx} OR description ILIKE $${idx} OR ticket_number ILIKE $${idx} OR COALESCE(tags, '') ILIKE $${idx})`
      );
    }
    if (filters.tags && filters.tags.length) {
      for (const tag of filters.tags) {
        values.push(`%${tag}%`);
        where.push(`COALESCE(tags, '') ILIKE $${values.length}`);
      }
    }
    if (filters.date_from) {
      values.push(filters.date_from);
      where.push(`created_at >= $${values.length}`);
    }
    if (filters.date_to) {
      values.push(filters.date_to);
      where.push(`created_at <= $${values.length}`);
    }
    if (filters.assigned_to) {
      values.push(filters.assigned_to);
      where.push(`assigned_to = $${values.length}`);
    }
    if (filters.assigned_to_is_null) {
      where.push('assigned_to IS NULL');
    }
    if (filters.exclude_archived) {
      where.push('(is_archived IS NULL OR is_archived = false)');
      where.push("status NOT IN ('Resolved', 'Closed')");
    }
    const hasTeamIds = filters.assigned_team_ids && filters.assigned_team_ids.length;
    const hasMemberIds = filters.assigned_to_in && filters.assigned_to_in.length;
    if (hasTeamIds && hasMemberIds) {
      values.push(filters.assigned_team_ids);
      const teamIdx = values.length;
      values.push(filters.assigned_to_in);
      const memberIdx = values.length;
      where.push(`(assigned_team = ANY($${teamIdx}) OR assigned_to = ANY($${memberIdx}))`);
    } else {
      if (hasTeamIds) {
        values.push(filters.assigned_team_ids);
        where.push(`assigned_team = ANY($${values.length})`);
      }
      if (hasMemberIds) {
        values.push(filters.assigned_to_in);
        where.push(`assigned_to = ANY($${values.length})`);
      }
    }
    if (filters.user_id) {
      values.push(filters.user_id);
      where.push(`user_id = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (pagination.page - 1) * pagination.limit;

    const countResult = await db.query(`SELECT COUNT(*) FROM tickets ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(pagination.limit, offset);
    const orderBy = [
      "(EXISTS (SELECT 1 FROM ticket_escalations e WHERE e.ticket_id = tickets.ticket_id) OR (tickets.sla_due_date IS NOT NULL AND tickets.created_at IS NOT NULL AND tickets.status NOT IN ('Resolved','Closed') AND (EXTRACT(EPOCH FROM (NOW() - tickets.created_at)) / NULLIF(EXTRACT(EPOCH FROM (tickets.sla_due_date - tickets.created_at)), 0) * 100) >= 80)) DESC NULLS LAST",
      "(tickets.sla_breached = true OR (tickets.sla_due_date IS NOT NULL AND tickets.sla_due_date < NOW() AND tickets.status NOT IN ('Resolved','Closed'))) DESC NULLS LAST",
      "CASE tickets.priority WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 WHEN 'P4' THEN 4 ELSE 5 END ASC",
      'tickets.created_at DESC',
    ].join(', ');
    const result = await db.query(
      `SELECT * FROM tickets ${whereClause} ORDER BY ${orderBy} LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return {
      tickets: result.rows,
      pagination: { page: pagination.page, limit: pagination.limit, total },
    };
  },

  async getTicketById(ticketId) {
    const result = await db.query('SELECT * FROM tickets WHERE ticket_id = $1', [ticketId]);
    return result.rows[0];
  },

  async listResolvedTicketsForAutoClose() {
    const result = await db.query(
      `SELECT * FROM tickets
       WHERE status = 'Resolved'
         AND resolved_at IS NOT NULL
         AND closed_at IS NULL
         AND (is_archived IS NULL OR is_archived = false)`
    );
    return result.rows;
  },

  async listTicketsByIds(ticketIds) {
    if (!ticketIds || !ticketIds.length) return [];
    const result = await db.query('SELECT * FROM tickets WHERE ticket_id = ANY($1)', [ticketIds]);
    return result.rows;
  },

  async listTeamIdsForUser(userId) {
    const result = await db.query(
      `SELECT team_id FROM teams WHERE team_lead_id = $1
       UNION
       SELECT team_id FROM team_members WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    return result.rows.map((row) => row.team_id);
  },

  async listTeamMemberIdsForTeams(teamIds) {
    if (!teamIds || !teamIds.length) return [];
    const result = await db.query(
      `SELECT user_id FROM team_members WHERE team_id = ANY($1) AND is_active = true
       UNION
       SELECT team_lead_id AS user_id FROM teams WHERE team_id = ANY($1)`,
      [teamIds]
    );
    return result.rows.map((row) => row.user_id);
  },

  async getTeamLeadIdByTeamId(teamId) {
    if (!teamId) return null;
    const result = await db.query(
      'SELECT team_lead_id FROM teams WHERE team_id = $1',
      [teamId]
    );
    return result.rows[0]?.team_lead_id || null;
  },

  async listTeamLeadIdsForAssignee(userId) {
    if (!userId) return [];
    const result = await db.query(
      `SELECT t.team_lead_id
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.team_id
       WHERE tm.user_id = $1 AND tm.is_active = true`,
      [userId]
    );
    return result.rows.map((row) => row.team_lead_id).filter(Boolean);
  },

  async listSlaEscalationCandidates({ thresholdPercent, statuses }) {
    const result = await db.query(
      `SELECT *
       FROM tickets
       WHERE status = ANY($1)
         AND sla_due_date IS NOT NULL
         AND created_at IS NOT NULL
         AND sla_due_date > created_at
         AND (
           EXTRACT(EPOCH FROM (NOW() - created_at))
           / NULLIF(EXTRACT(EPOCH FROM (sla_due_date - created_at)), 0)
         ) * 100 >= $2`,
      [statuses, thresholdPercent]
    );
    return result.rows;
  },

  async hasSlaEscalation(ticketId) {
    const result = await db.query(
      `SELECT 1 FROM ticket_escalations
       WHERE ticket_id = $1 AND reason ILIKE 'SLA threshold%'
       LIMIT 1`,
      [ticketId]
    );
    return result.rows.length > 0;
  },

  async updateTicket(ticketId, updates) {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');

    const result = await db.query(
      `UPDATE tickets SET ${setClause}, updated_at = NOW() WHERE ticket_id = $${keys.length + 1} RETURNING *`,
      [...values, ticketId]
    );
    return result.rows[0];
  },

  async updateTicketsAssignment({ ticketIds, assignedTo, assignedBy }) {
    if (!ticketIds || !ticketIds.length) return [];
    const result = await db.query(
      `UPDATE tickets
       SET assigned_to = $1,
           assigned_at = NOW(),
           assigned_by = $2,
           updated_at = NOW()
       WHERE ticket_id = ANY($3)
       RETURNING *`,
      [assignedTo, assignedBy, ticketIds]
    );
    return result.rows;
  },

  async createComment(data) {
    const result = await db.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, comment_text, is_internal)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.ticket_id, data.user_id, data.comment_text, data.is_internal]
    );
    return result.rows[0];
  },

  async getComments(ticketId) {
    const result = await db.query(
      `SELECT c.*, u.full_name, u.role
       FROM ticket_comments c
       JOIN users u ON u.user_id = c.user_id
       WHERE c.ticket_id = $1
       ORDER BY c.created_at ASC`,
      [ticketId]
    );
    return result.rows;
  },

  async createAttachment(data) {
    const result = await db.query(
      `INSERT INTO ticket_attachments (ticket_id, file_name, file_path, file_size, file_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.ticket_id, data.file_name, data.file_path, data.file_size, data.file_type, data.uploaded_by]
    );
    return result.rows[0];
  },

  async getAttachments(ticketId) {
    const result = await db.query(
      `SELECT * FROM ticket_attachments WHERE ticket_id = $1 AND is_deleted = false ORDER BY uploaded_at ASC`,
      [ticketId]
    );
    return result.rows;
  },

  async createAuditLog(data) {
    const result = await db.query(
      `INSERT INTO audit_logs
        (ticket_id, user_id, action_type, entity_type, entity_id, old_value, new_value, description, ip_address, user_agent, session_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        data.ticket_id,
        data.user_id,
        data.action_type,
        data.entity_type,
        data.entity_id,
        data.old_value || null,
        data.new_value || null,
        data.description || null,
        data.ip_address || null,
        data.user_agent || null,
        data.session_id || null,
      ]
    );
    return result.rows[0];
  },

  async getAuditLogs(ticketId) {
    const result = await db.query(
      `SELECT a.*, u.full_name, u.role
       FROM audit_logs a
       JOIN users u ON u.user_id = a.user_id
       WHERE a.ticket_id = $1
       ORDER BY a.timestamp DESC`,
      [ticketId]
    );
    return result.rows;
  },

  async createStatusHistory({ ticket_id, old_status, new_status, changed_by, change_reason }) {
    const result = await db.query(
      `INSERT INTO ticket_status_history
        (ticket_id, old_status, new_status, changed_by, change_reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [ticket_id, old_status || null, new_status, changed_by || null, change_reason || null]
    );
    return result.rows[0];
  },

  async listStatusHistory(ticketId) {
    const result = await db.query(
      `SELECT h.*, u.full_name, u.role
       FROM ticket_status_history h
       LEFT JOIN users u ON u.user_id = h.changed_by
       WHERE h.ticket_id = $1
       ORDER BY h.changed_at DESC`,
      [ticketId]
    );
    return result.rows;
  },

  async createEscalation({ ticket_id, reason, severity, escalated_by }) {
    const result = await db.query(
      `INSERT INTO ticket_escalations
        (ticket_id, reason, severity, escalated_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ticket_id, reason, severity || 'medium', escalated_by || null]
    );
    return result.rows[0];
  },

  async listEscalations(ticketId) {
    const result = await db.query(
      `SELECT e.*, u.full_name AS escalated_by_name
       FROM ticket_escalations e
       LEFT JOIN users u ON u.user_id = e.escalated_by
       WHERE e.ticket_id = $1
       ORDER BY e.escalated_at DESC`,
      [ticketId]
    );
    return result.rows;
  },

  async findPotentialDuplicates({ title, description, excludeTicketId, userId, createdAfter }) {
    const needle = `%${title || description || ''}%`;
    const conditions = ['($1::uuid IS NULL OR ticket_id <> $1)', '(title ILIKE $2 OR description ILIKE $2)'];
    const values = [excludeTicketId || null, needle];
    if (userId) {
      values.push(userId);
      conditions.push(`user_id = $${values.length}`);
    }
    if (createdAfter) {
      values.push(createdAfter);
      conditions.push(`created_at >= $${values.length}`);
    }
    const result = await db.query(
      `SELECT ticket_id, ticket_number, title, status, created_at
       FROM tickets
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 5`,
      values
    );
    return result.rows;
  },

  async deleteTicket(ticketId) {
    const result = await db.query('DELETE FROM tickets WHERE ticket_id = $1 RETURNING ticket_id', [ticketId]);
    return result.rows[0];
  },
};

module.exports = TicketsModel;
