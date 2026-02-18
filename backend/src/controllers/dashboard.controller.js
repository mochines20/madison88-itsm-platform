const DashboardService = require('../services/dashboard.service');

const DashboardController = {
    async getSlaPerformance(req, res, next) {
        try {
            const sla_performance = await DashboardService.getSlaPerformance();
            res.json({ status: 'success', data: { sla_performance } });
        } catch (err) {
            next(err);
        }
    },

    async getTicketVolume(req, res, next) {
        try {
            const ticket_volume = await DashboardService.getTicketVolume();
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
            const team_performance = await DashboardService.getTeamPerformance();
            res.json({ status: 'success', data: { team_performance } });
        } catch (err) {
            next(err);
        }
    },

    async getAgingReport(req, res, next) {
        try {
            const aging_report = await DashboardService.getAgingReport();
            res.json({ status: 'success', data: { aging_report } });
        } catch (err) {
            next(err);
        }
    },

    async getStatusSummary(req, res, next) {
        try {
            const result = await DashboardService.getStatusSummary();
            res.json({ status: 'success', data: result });
        } catch (err) {
            next(err);
        }
    },

    async getSlaSummary(req, res, next) {
        try {
            const summary = await DashboardService.getSlaSummary();
            res.json({ status: 'success', data: { summary } });
        } catch (err) {
            next(err);
        }
    },

    async getExportData(req, res, next) {
        try {
            const { format = 'json', start_date, end_date } = req.query;
            const tickets = await DashboardService.getExportData({ start_date, end_date });

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
};

module.exports = DashboardController;
