/**
 * Tickets Routes
 * POST /api/tickets - Create ticket
 * GET /api/tickets - List tickets
 * GET /api/tickets/:id - Get ticket details
 * PATCH /api/tickets/:id - Update ticket
 * POST /api/tickets/:id/comments - Add comment
 * POST /api/tickets/:id/attachments - Upload attachment
 * GET /api/tickets/:id/audit-log - Get audit trail
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TicketsController = require('../controllers/tickets.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.xlsx', '.docx', '.msg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Unsupported file type'));
    }
    cb(null, true);
  }
});

/**
 * @route POST /api/tickets
 * @desc Create a new ticket (JSON body)
 */
router.post('/', authenticate, authorize(['end_user']), TicketsController.createTicket);

/**
 * @route POST /api/tickets/with-attachments
 * @desc Create a new ticket with attachments in one request (multipart/form-data). Use to avoid orphan tickets if attachment upload fails.
 */
router.post('/with-attachments', authenticate, authorize(['end_user']), upload.array('files', 5), TicketsController.createTicketWithAttachments);

/**
 * @route GET /api/tickets
 * @desc List all tickets with filters
 */
router.get('/', authenticate, TicketsController.listTickets);

/**
 * @route POST /api/tickets/bulk-assign
 * @desc Bulk assign tickets
 */
router.post('/bulk-assign', authenticate, TicketsController.bulkAssign);

/**
 * @route GET /api/tickets/:id
 * @desc Get single ticket details
 */
router.get('/:id', authenticate, TicketsController.getTicket);

/**
 * @route GET /api/tickets/:id/status-history
 * @desc Get ticket status history
 */
router.get('/:id/status-history', authenticate, TicketsController.getStatusHistory);

/**
 * @route GET /api/tickets/:id/priority-override-requests
 * @desc List priority override requests
 */
router.get('/:id/priority-override-requests', authenticate, TicketsController.listPriorityOverrideRequests);

/**
 * @route POST /api/tickets/:id/priority-override-requests
 * @desc Request priority override
 */
router.post('/:id/priority-override-requests', authenticate, TicketsController.requestPriorityOverride);

/**
 * @route PATCH /api/tickets/:id/priority-override-requests/:requestId
 * @desc Approve/reject priority override
 */
router.patch('/:id/priority-override-requests/:requestId', authenticate, TicketsController.reviewPriorityOverride);

/**
 * @route PATCH /api/tickets/:id
 * @desc Update ticket
 */
router.patch('/:id', authenticate, TicketsController.updateTicket);

/**
 * @route POST /api/tickets/:id/comments
 * @desc Add comment to ticket
 */
router.post('/:id/comments', authenticate, TicketsController.addComment);

/**
 * @route POST /api/tickets/:id/attachments
 * @desc Upload attachment to ticket
 */
router.post('/:id/attachments', authenticate, upload.array('files', 5), TicketsController.addAttachments);

/**
 * @route GET /api/tickets/:id/escalations
 * @desc List ticket escalations
 */
router.get('/:id/escalations', authenticate, TicketsController.listEscalations);

/**
 * @route POST /api/tickets/:id/escalations
 * @desc Create ticket escalation
 */
router.post('/:id/escalations', authenticate, TicketsController.createEscalation);

/**
 * @route GET /api/tickets/:id/audit-log
 * @desc Get ticket audit trail
 */
router.get('/:id/audit-log', authenticate, authorize(['system_admin', 'it_manager']), TicketsController.getAuditLog);

module.exports = router;
