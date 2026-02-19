const express = require('express');
const PDFDocument = require('pdfkit');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

router.get('/export', authenticate, authorize(['it_manager', 'system_admin']), async (req, res, next) => {
  try {
    const {
      format = 'csv',
      start_date,
      end_date,
      action_type,
      user_id,
      ticket_id,
    } = req.query;

    const db = req.app.get('db');
    const filters = [];
    const values = [];

    if (start_date) {
      values.push(start_date);
      filters.push(`a.timestamp >= $${values.length}`);
    }
    if (end_date) {
      values.push(end_date);
      filters.push(`a.timestamp <= $${values.length}`);
    }
    if (action_type) {
      values.push(action_type);
      filters.push(`a.action_type = $${values.length}`);
    }
    if (user_id) {
      values.push(user_id);
      filters.push(`a.user_id = $${values.length}`);
    }
    if (ticket_id) {
      values.push(ticket_id);
      filters.push(`a.ticket_idScope = $${values.length}`);
    }

    if (req.user.role === 'it_manager' && req.user.location) {
      values.push(req.user.location);
      filters.push(`(t.location = $${values.length} OR t.location IS NULL)`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT a.log_id, a.ticket_id, t.ticket_number, a.user_id, u.full_name,
              a.action_type, a.entity_type, a.entity_id, a.description,
              a.ip_address, a.user_agent, a.timestamp
       FROM audit_logs a
       LEFT JOIN tickets t ON t.ticket_id = a.ticket_id
       LEFT JOIN users u ON u.user_id = a.user_id
       ${whereClause}
       ORDER BY a.timestamp DESC`,
      values
    );

    if (format === 'json') {
      const sanitized = result.rows.map((row) => ({
        ticket_id: row.ticket_id,
        ticket_number: row.ticket_number,
        full_name: row.full_name,
        action_type: row.action_type,
        entity_type: row.entity_type,
        description: row.description,
        timestamp: row.timestamp,
      }));
      return res.json({ status: 'success', data: { audit_logs: sanitized } });
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-export.pdf');

      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
      doc.pipe(res);

      doc.fontSize(16).text('Audit Log Export', { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#555555');
      doc.text(`Generated: ${new Date().toISOString()}`);
      doc.moveDown(0.8);

      const headers = [
        'Timestamp',
        'Ticket',
        'Action',
        'Entity',
        'Description',
        'User',
      ];

      // Optimized for A4 Landscape (approx 770pt usable width)
      const columnWidths = [125, 90, 75, 75, 305, 100];
      const startX = doc.x;
      let y = doc.y;

      // Draw Headers
      doc.fontSize(10).fillColor('#111111').font('Helvetica-Bold');
      headers.forEach((header, index) => {
        doc.text(header, startX + columnWidths.slice(0, index).reduce((a, b) => a + b, 0), y, {
          width: columnWidths[index],
          align: 'left',
        });
      });

      y += 20;
      doc.moveTo(startX, y - 4).lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), y - 4).strokeColor('#333333').lineWidth(1).stroke();

      doc.fontSize(9).fillColor('#222222').font('Helvetica');
      for (const row of result.rows) {
        const values = [
          row.timestamp ? new Date(row.timestamp).toISOString() : '',
          row.ticket_number || row.ticket_id || '',
          row.action_type || '',
          row.entity_type || '',
          row.description || '',
          row.full_name || '',
        ];

        // Calculate required height for this row (based on wrapping columns)
        const rowHeights = values.map((val, idx) => doc.heightOfString(val, { width: columnWidths[idx] }));
        const maxHeight = Math.max(...rowHeights) + 12; // Add padding

        // Page break check
        if (y + maxHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          y = doc.page.margins.top;

          // Redraw headers on new page
          doc.fontSize(10).fillColor('#111111').font('Helvetica-Bold');
          headers.forEach((header, index) => {
            doc.text(header, startX + columnWidths.slice(0, index).reduce((a, b) => a + b, 0), y, {
              width: columnWidths[index],
              align: 'left',
            });
          });
          y += 20;
          doc.moveTo(startX, y - 4).lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), y - 4).strokeColor('#333333').lineWidth(1).stroke();
          doc.fontSize(9).fillColor('#222222').font('Helvetica');
        }

        // Render row data
        values.forEach((value, index) => {
          doc.text(value, startX + columnWidths.slice(0, index).reduce((a, b) => a + b, 0), y, {
            width: columnWidths[index],
            align: 'left',
          });
        });

        y += maxHeight;

        // Horizontal line between rows
        doc.moveTo(startX, y - 4)
          .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), y - 4)
          .strokeColor('#eeeeee')
          .lineWidth(0.5)
          .stroke();
      }

      doc.end();
      return;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-export.csv');

    const header = [
      'ticket_id',
      'ticket_number',
      'full_name',
      'action_type',
      'entity_type',
      'description',
      'timestamp',
    ].join(',');

    const rows = result.rows.map((row) => [
      escapeCsv(row.ticket_id),
      escapeCsv(row.ticket_number),
      escapeCsv(row.full_name),
      escapeCsv(row.action_type),
      escapeCsv(row.entity_type),
      escapeCsv(row.description),
      escapeCsv(row.timestamp),
    ].join(','));

    return res.send([header, ...rows].join('\n'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
