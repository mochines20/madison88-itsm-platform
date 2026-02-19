const DashboardService = require('../services/dashboard.service');
const PulseService = require('../services/pulse.service');

const DashboardController = {
    async getSlaPerformance(req, res, next) {
        try {
            const location = ['it_agent', 'it_manager'].includes(req.user.role) ? req.user.location : null;
            const sla_performance = await DashboardService.getSlaPerformance(location);
            res.json({ status: 'success', data: { sla_performance } });
        } catch (err) {
            next(err);
        }
    },

    async getTicketVolume(req, res, next) {
        try {
            const location = ['it_agent', 'it_manager'].includes(req.user.role) ? req.user.location : null;
            const ticket_volume = await DashboardService.getTicketVolume(location);
            res.json({
                status: 'success',
                data: { ticket_volume },
            });
        } catch (err) {
            next(err);
        }
    },

    async getTeamPerformance(req, res, next) {
        try {
            const location = ['it_agent', 'it_manager'].includes(req.user.role) ? req.user.location : null;
            const team_performance = await DashboardService.getTeamPerformance(location);
            res.json({ status: 'success', data: { team_performance } });
        } catch (err) {
            next(err);
        }
    },

    async getAgingReport(req, res, next) {
        try {
            const location = ['it_agent', 'it_manager'].includes(req.user.role) ? req.user.location : null;
            const aging_report = await DashboardService.getAgingReport(location);
            res.json({ status: 'success', data: { aging_report } });
        } catch (err) {
            next(err);
        }
    },

    async getStatusSummary(req, res, next) {
        try {
            const location = ['it_agent', 'it_manager'].includes(req.user.role) ? req.user.location : null;
            const result = await DashboardService.getStatusSummary(location);
            res.json({ status: 'success', data: result });
        } catch (err) {
            next(err);
        }
    },

    async getSlaSummary(req, res, next) {
        try {
            const location = ['it_agent', 'it_manager'].includes(req.user.role) ? req.user.location : null;
            const summary = await DashboardService.getSlaSummary(location);
            res.json({ status: 'success', data: { summary } });
        } catch (err) {
            next(err);
        }
    },

    async getExportData(req, res, next) {
        try {
            const { format = 'json', start_date, end_date } = req.query;
            const location = ['it_agent', 'it_manager'].includes(req.user.role) ? req.user.location : null;
            const tickets = await DashboardService.getExportData({ start_date, end_date, location });

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=dashboard-export.csv');
                const header = 'ticket_number,category,priority,status,location,created_at,resolved_at,sla_due_date';
                const rows = tickets.map((row) => [
                    row.ticket_number,
                    row.category,
                    row.priority,
                    row.status,
                    row.location,
                    row.created_at,
                    row.resolved_at,
                    row.sla_due_date,
                ].join(','));
                return res.send([header, ...rows].join('\n'));
            }

            res.json({ status: 'success', data: { tickets } });
        } catch (err) {
            next(err);
        }
    },

    async getAdvancedReporting(req, res, next) {
        try {
            const result = await DashboardService.getAdvancedReporting();
            res.json({ status: 'success', data: result });
        } catch (err) {
            next(err);
        }
    },

    async getPulse(req, res, next) {
        try {
            const data = await PulseService.getPulseEvents();
            res.json({ status: 'success', data });
        } catch (err) {
            next(err);
        }
    },

    async bulkEscalateP1(req, res, next) {
        try {
            const escalatedTickets = await DashboardService.bulkEscalateP1(req.user.user_id);
            res.json({
                status: 'success',
                message: `Successfully escalated ${escalatedTickets.length} P1 tickets.`,
                data: { escalatedTickets }
            });
        } catch (err) {
            next(err);
        }
    },

    async getAgentStats(req, res, next) {
        try {
            const stats = await DashboardService.getAgentStats(req.user.user_id);
            res.json({ status: 'success', data: stats });
        } catch (err) {
            next(err);
        }
    },

    async broadcast(req, res, next) {
        try {
            const { message } = req.body;
            if (!message) return res.status(400).json({ status: 'error', message: 'Message is required' });

            const count = await DashboardService.broadcast(req.user.user_id, message);

            // Emit refresh event to all connected clients
            const io = req.app.get('io');
            if (io) io.emit('dashboard-refresh');

            res.json({
                status: 'success',
                message: `Broadcast sent to ${count} staff members.`,
                data: { count }
            });
        } catch (err) {
            next(err);
        }
    }
};

module.exports = DashboardController;
