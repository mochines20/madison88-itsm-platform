/**
 * Dashboard Routes
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const DashboardController = require('../controllers/dashboard.controller');
const router = express.Router();

// SLA Performance
router.get('/sla-performance', authenticate, authorize(['it_manager', 'system_admin']), DashboardController.getSlaPerformance);

// Ticket Volume
router.get('/ticket-volume', authenticate, authorize(['it_manager', 'system_admin']), DashboardController.getTicketVolume);

// Team Performance
router.get('/team-performance', authenticate, authorize(['it_manager', 'system_admin']), DashboardController.getTeamPerformance);

// Aging Report
router.get('/aging-report', authenticate, authorize(['it_manager', 'system_admin']), DashboardController.getAgingReport);

// Status Summary
router.get('/status-summary', authenticate, authorize(['it_manager', 'system_admin']), DashboardController.getStatusSummary);

// SLA Summary (Admin)
router.get('/sla-summary', authenticate, authorize(['system_admin']), DashboardController.getSlaSummary);

// Export Data
router.get('/export', authenticate, authorize(['it_manager', 'system_admin']), DashboardController.getExportData);

// Advanced Reporting
router.get('/advanced-reporting', authenticate, authorize(['it_manager', 'system_admin']), DashboardController.getAdvancedReporting);

// IT Pulse (Real-time events) - Accessible to all authenticated users
router.get('/pulse', authenticate, DashboardController.getPulse);

// Executive Actions (Admin only)
router.get('/agent-stats', authenticate, authorize(['it_agent', 'it_manager', 'system_admin']), DashboardController.getAgentStats);

router.post('/bulk-escalate-p1', authenticate, authorize(['system_admin']), DashboardController.bulkEscalateP1);
router.post('/broadcast', authenticate, authorize(['system_admin', 'it_manager']), DashboardController.broadcast);

module.exports = router;
