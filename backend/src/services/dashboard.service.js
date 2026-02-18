const db = require('../config/database');

const DashboardService = {
    async getSlaPerformance() {
        try {
            const result = await db.query('SELECT * FROM sla_performance_summary');
            const performance = result.rows.reduce((acc, row) => {
                acc[row.priority] = {
                    total: parseInt(row.total_tickets, 10),
                    met: parseInt(row.sla_met, 10),
                    breached: parseInt(row.sla_breached, 10),
                    compliance: parseFloat(row.sla_compliance_percent) || 0,
                };
                return acc;
            }, {});

            // Ensure all priorities (P1-P4) are present
            const priorities = ['P1', 'P2', 'P3', 'P4'];
            priorities.forEach(priority => {
                if (!performance[priority]) {
                    performance[priority] = {
                        total: 0,
                        met: 0,
                        breached: 0,
                        compliance: 0,
                    };
                }
            });

            return performance;
        } catch (err) {
            // Fallback: Calculate from resolved/closed tickets
            const fallback = await db.query(
                `SELECT priority,
                COUNT(*)::int AS total,
                SUM(CASE WHEN COALESCE(sla_breached, false) = false THEN 1 ELSE 0 END)::int AS met,
                SUM(CASE WHEN COALESCE(sla_breached, false) = true THEN 1 ELSE 0 END)::int AS breached
         FROM tickets
         WHERE status IN ('Resolved', 'Closed')
         GROUP BY priority`
            );
            const performance = fallback.rows.reduce((acc, row) => {
                const total = parseInt(row.total, 10);
                const met = parseInt(row.met, 10);
                const breached = parseInt(row.breached, 10);
                acc[row.priority] = {
                    total,
                    met,
                    breached,
                    compliance: total > 0 ? Number(((met / total) * 100).toFixed(2)) : 0,
                };
                return acc;
            }, {});

            // Ensure all priorities (P1-P4) are present
            const priorities = ['P1', 'P2', 'P3', 'P4'];
            priorities.forEach(priority => {
                if (!performance[priority]) {
                    performance[priority] = {
                        total: 0,
                        met: 0,
                        breached: 0,
                        compliance: 0,
                    };
                }
            });

            return performance;
        }
    },

    async getTicketVolume() {
        const group = async (column) => {
            const res = await db.query(`SELECT ${column} as key, COUNT(*)::int as value FROM tickets GROUP BY ${column}`);
            return res.rows;
        };

        const [by_status, by_category, by_priority, by_location] = await Promise.all([
            group('status'),
            group('category'),
            group('priority'),
            group('location'),
        ]);

        return {
            by_status,
            by_category,
            by_priority,
            by_location,
        };
    },

    async getTeamPerformance() {
        const result = await db.query('SELECT * FROM team_performance_summary');
        return { teams: result.rows };
    },

    async getAgingReport() {
        try {
            const result = await db.query('SELECT * FROM aging_tickets');
            return {
                over_7_days: result.rows.filter((row) => row.age_category === 'over_7_days'),
                over_14_days: result.rows.filter((row) => row.age_category === 'over_14_days'),
                over_30_days: result.rows.filter((row) => row.age_category === 'over_30_days'),
            };
        } catch (err) {
            const result = await db.query(
                `SELECT
           SUM(CASE WHEN created_at <= NOW() - INTERVAL '7 days'
                     AND created_at > NOW() - INTERVAL '14 days' THEN 1 ELSE 0 END)::int AS over_7_days_count,
           SUM(CASE WHEN created_at <= NOW() - INTERVAL '14 days'
                     AND created_at > NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END)::int AS over_14_days_count,
           SUM(CASE WHEN created_at <= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END)::int AS over_30_days_count
         FROM tickets
         WHERE status NOT IN ('Resolved','Closed')`
            );
            return {
                over_7_days: [],
                over_14_days: [],
                over_30_days: [],
                ...result.rows[0],
            };
        }
    },

    async getStatusSummary() {
        const result = await db.query('SELECT status, COUNT(*)::int AS count FROM tickets GROUP BY status');
        const status_counts = result.rows.reduce((acc, row) => {
            acc[row.status] = parseInt(row.count, 10);
            return acc;
        }, {});

        const open = (status_counts['New'] || 0) + (status_counts['In Progress'] || 0);
        const summary = {
            open,
            in_progress: status_counts['In Progress'] || 0,
            pending: status_counts['Pending'] || 0,
            resolved: status_counts['Resolved'] || 0,
            closed: status_counts['Closed'] || 0,
            reopened: status_counts['Reopened'] || 0,
        };

        return { status_counts, summary };
    },

    async getSlaSummary() {
        const result = await db.query(
            `SELECT
         COUNT(CASE WHEN status NOT IN ('Resolved','Closed')
                   AND sla_due_date IS NOT NULL
                   AND sla_due_date < NOW() THEN 1 END)::int AS total_breached,
         COUNT(CASE WHEN status NOT IN ('Resolved','Closed')
                   AND sla_due_date IS NOT NULL
                   AND sla_due_date < NOW() THEN 1 END)::int AS critical_breached
       FROM tickets`
        );
        return result.rows[0] || { total_breached: 0, critical_breached: 0 };
    },

    async getExportData({ start_date, end_date }) {
        const filters = [];
        const values = [];
        if (start_date) {
            values.push(start_date);
            filters.push(`created_at >= $${values.length}`);
        }
        if (end_date) {
            values.push(end_date);
            filters.push(`created_at <= $${values.length}`);
        }
        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const result = await db.query(
            `SELECT ticket_number, category, priority, status, location, created_at, resolved_at, sla_due_date
       FROM tickets ${whereClause} ORDER BY created_at DESC`,
            values
        );
        return result.rows;
    },

    async getAdvancedReporting() {
        const mttrResult = await db.query(
            `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) AS mttr_hours
       FROM tickets WHERE resolved_at IS NOT NULL`
        );
        const mttr_hours = Number(mttrResult.rows[0]?.mttr_hours || 0);

        const mttaResult = await db.query(
            `WITH first_response AS (
         SELECT t.ticket_id, MIN(c.created_at) AS first_response_at
         FROM tickets t
         JOIN ticket_comments c ON c.ticket_id = t.ticket_id
         JOIN users u ON u.user_id = c.user_id
         WHERE u.role IN ('it_agent','it_manager','system_admin')
         GROUP BY t.ticket_id
       )
       SELECT AVG(EXTRACT(EPOCH FROM (fr.first_response_at - t.created_at)) / 3600) AS mtta_hours
       FROM tickets t
       JOIN first_response fr ON fr.ticket_id = t.ticket_id`
        );
        const mtta_hours = Number(mttaResult.rows[0]?.mtta_hours || 0);

        const reopenStats = await db.query(
            `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN reopened_count > 0 THEN 1 ELSE 0 END)::int AS reopened_tickets,
              AVG(reopened_count)::numeric AS avg_reopens
       FROM tickets`
        );
        const reopen_total = reopenStats.rows[0]?.total || 0;
        const reopened_tickets = reopenStats.rows[0]?.reopened_tickets || 0;
        const reopen_rate = reopen_total > 0 ? Number(((reopened_tickets / reopen_total) * 100).toFixed(2)) : 0;
        const avg_reopen_count = Number(reopenStats.rows[0]?.avg_reopens || 0);

        const volumeTrend = await db.query(
            `SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*)::int AS count
       FROM tickets
       GROUP BY day
       ORDER BY day DESC
       LIMIT 30`
        );

        const slaTrend = await db.query(
            `SELECT DATE_TRUNC('day', sla_due_date)::date AS day, COUNT(*)::int AS count
       FROM tickets
       WHERE sla_due_date IS NOT NULL
         AND sla_due_date < NOW()
         AND status NOT IN ('Resolved','Closed')
       GROUP BY day
       ORDER BY day DESC
       LIMIT 30`
        );

        const agentPerf = await db.query(
            `SELECT u.user_id, u.full_name,
              COUNT(t.ticket_id)::int AS resolved_count,
              AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) AS avg_resolution_hours
       FROM tickets t
       JOIN users u ON u.user_id = t.assigned_to
       WHERE t.resolved_at IS NOT NULL
       GROUP BY u.user_id, u.full_name
       ORDER BY resolved_count DESC
       LIMIT 10`
        );

        const pendingChangeApprovals = await db.query(
            `SELECT COUNT(*)::int AS count
       FROM change_requests
       WHERE status = 'submitted'`
        );

        const pendingPriorityOverrides = await db.query(
            `SELECT COUNT(*)::int AS count
       FROM ticket_priority_override_requests
       WHERE status = 'pending'`
        );

        const escalationsOpen = await db.query(
            `SELECT COUNT(*)::int AS count
       FROM tickets t
       JOIN sla_rules s ON s.priority = t.priority AND s.is_active = true
       WHERE t.status NOT IN ('Resolved','Closed')
         AND t.sla_due_date IS NOT NULL
         AND t.created_at IS NOT NULL
         AND EXTRACT(EPOCH FROM (NOW() - t.created_at)) / NULLIF(EXTRACT(EPOCH FROM (t.sla_due_date - t.created_at)), 0) * 100 >= s.escalation_threshold_percent`
        );

        const topTags = await db.query(
            `SELECT LOWER(TRIM(tag)) AS tag, COUNT(*)::int AS count
       FROM tickets t
       CROSS JOIN LATERAL unnest(string_to_array(COALESCE(t.tags, ''), ',')) AS tag
       WHERE t.tags IS NOT NULL AND t.tags <> ''
       GROUP BY tag
       ORDER BY count DESC
       LIMIT 10`
        );

        const slaByPriority = await db.query(
            `SELECT priority,
              COUNT(*)::int AS total,
              SUM(CASE WHEN sla_due_date IS NOT NULL
                        AND sla_due_date < NOW()
                        AND status NOT IN ('Resolved','Closed') THEN 1 ELSE 0 END)::int AS breached
       FROM tickets
       GROUP BY priority
       ORDER BY priority`
        );

        const slaByTeam = await db.query(
            `SELECT tm.team_id, tm.team_name,
              COUNT(t.ticket_id)::int AS total,
              SUM(CASE WHEN t.sla_due_date IS NOT NULL
                        AND t.sla_due_date < NOW()
                        AND t.status NOT IN ('Resolved','Closed') THEN 1 ELSE 0 END)::int AS breached
       FROM teams tm
       LEFT JOIN tickets t ON t.assigned_team = tm.team_id
       GROUP BY tm.team_id, tm.team_name
       ORDER BY tm.team_name`
        );

        const slaWeekly = await db.query(
            `SELECT DATE_TRUNC('week', created_at)::date AS week_start,
              COUNT(*)::int AS total,
              SUM(CASE WHEN sla_due_date IS NOT NULL
                        AND sla_due_date < NOW()
                        AND status NOT IN ('Resolved','Closed') THEN 1 ELSE 0 END)::int AS breached
       FROM tickets
       GROUP BY week_start
       ORDER BY week_start DESC
       LIMIT 12`
        );

        const agingBuckets = await db.query(
            `SELECT
         SUM(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 ELSE 0 END)::int AS bucket_0_1,
         SUM(CASE WHEN created_at < NOW() - INTERVAL '1 day'
                   AND created_at >= NOW() - INTERVAL '3 days' THEN 1 ELSE 0 END)::int AS bucket_2_3,
         SUM(CASE WHEN created_at < NOW() - INTERVAL '3 days'
                   AND created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)::int AS bucket_4_7,
         SUM(CASE WHEN created_at < NOW() - INTERVAL '7 days'
                   AND created_at >= NOW() - INTERVAL '14 days' THEN 1 ELSE 0 END)::int AS bucket_8_14,
         SUM(CASE WHEN created_at < NOW() - INTERVAL '14 days' THEN 1 ELSE 0 END)::int AS bucket_15_plus
       FROM tickets
       WHERE status NOT IN ('Resolved','Closed')`
        );

        const agentWorkload = await db.query(
            `SELECT u.user_id, u.full_name,
              COUNT(t.ticket_id)::int AS assigned_total,
              SUM(CASE WHEN t.status NOT IN ('Resolved','Closed') THEN 1 ELSE 0 END)::int AS active_count,
              SUM(CASE WHEN t.status NOT IN ('Resolved','Closed')
                        AND t.sla_due_date IS NOT NULL
                        AND t.sla_due_date < NOW() THEN 1 ELSE 0 END)::int AS overdue_count
       FROM users u
       LEFT JOIN tickets t ON t.assigned_to = u.user_id
       WHERE u.role IN ('it_agent','it_manager','system_admin')
       GROUP BY u.user_id, u.full_name
       ORDER BY active_count DESC NULLS LAST
       LIMIT 12`
        );

        const agentStatusMatrix = await db.query(
            `SELECT u.user_id, u.full_name,
              SUM(CASE WHEN t.status = 'New' THEN 1 ELSE 0 END)::int AS new_count,
              SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END)::int AS in_progress_count,
              SUM(CASE WHEN t.status = 'Pending' THEN 1 ELSE 0 END)::int AS pending_count,
              SUM(CASE WHEN t.status = 'Resolved' THEN 1 ELSE 0 END)::int AS resolved_count,
              SUM(CASE WHEN t.status = 'Closed' THEN 1 ELSE 0 END)::int AS closed_count,
              SUM(CASE WHEN t.status = 'Reopened' THEN 1 ELSE 0 END)::int AS reopened_count
       FROM users u
       LEFT JOIN tickets t ON t.assigned_to = u.user_id
       WHERE u.role = 'it_agent'
       GROUP BY u.user_id, u.full_name
       ORDER BY u.full_name`
        );

        return {
            summary: {
                mttr_hours,
                mtta_hours,
                reopen_rate,
                avg_reopen_count,
            },
            trends: {
                tickets_by_day: volumeTrend.rows,
                sla_breaches_by_day: slaTrend.rows,
                sla_compliance_by_week: slaWeekly.rows.map((row) => ({
                    week_start: row.week_start,
                    total: row.total,
                    breached: row.breached,
                    compliance: row.total ? Number((((row.total - row.breached) / row.total) * 100).toFixed(2)) : 0,
                })),
            },
            sla_compliance_by_priority: slaByPriority.rows.map((row) => ({
                priority: row.priority,
                total: row.total,
                breached: row.breached,
                compliance: row.total ? Number((((row.total - row.breached) / row.total) * 100).toFixed(2)) : 0,
            })),
            sla_compliance_by_team: slaByTeam.rows.map((row) => ({
                team_id: row.team_id,
                team_name: row.team_name,
                total: row.total,
                breached: row.breached,
                compliance: row.total ? Number((((row.total - row.breached) / row.total) * 100).toFixed(2)) : 0,
            })),
            agent_performance: agentPerf.rows,
            agent_workload: agentWorkload.rows,
            agent_status_matrix: agentStatusMatrix.rows,
            approvals_pending: {
                change_requests: pendingChangeApprovals.rows[0]?.count || 0,
                priority_overrides: pendingPriorityOverrides.rows[0]?.count || 0,
            },
            escalations_open: escalationsOpen.rows[0]?.count || 0,
            aging_buckets: agingBuckets.rows[0] || {
                bucket_0_1: 0,
                bucket_2_3: 0,
                bucket_4_7: 0,
                bucket_8_14: 0,
                bucket_15_plus: 0,
            },
            top_tags: topTags.rows,
        };
    }
};

module.exports = DashboardService;
