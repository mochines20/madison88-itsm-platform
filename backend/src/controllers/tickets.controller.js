const TicketsService = require('../services/tickets.service');

const IDEMPOTENCY_TTL_SEC = 24 * 60 * 60; // 24 hours

function emitTicketUpdate(io, ticketId, event = 'ticket-updated', payload = null) {
  if (!io) return;
  try {
    io.to(`ticket-${ticketId}`).emit(event, payload || { ticketId });
    io.emit('dashboard-refresh', { ticketId });
  } catch {
    // ignore
  }
}

const TicketsController = {
  async createTicket(req, res, next) {
    try {
      const redisClient = req.app.get('redis');
      const idemKey = req.headers['x-idempotency-key'];
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'] || '',
        sessionId: req.headers['x-session-id'] || null,
      };

      const run = async () => {
        const result = await TicketsService.createTicket({
          payload: req.body,
          user: req.user,
          meta,
        });
        const io = req.app.get('io');
        emitTicketUpdate(io, result.ticket.ticket_id, 'ticket-created', { ticket: result.ticket });
        return { status: 201, body: { status: 'success', data: result } };
      };

      if (idemKey && redisClient) {
        try {
          const cached = await redisClient.get(`idempotency:${idemKey}`);
          if (cached) {
            const { status, body } = JSON.parse(cached);
            return res.status(status).json(body);
          }
        } catch {
          // proceed
        }
        const result = await run();
        try {
          await redisClient.setEx(`idempotency:${idemKey}`, IDEMPOTENCY_TTL_SEC, JSON.stringify(result));
        } catch {
          // ignore
        }
        return res.status(result.status).json(result.body);
      }
      const result = await run();
      res.status(result.status).json(result.body);
    } catch (err) {
      if (err.status === 409 && err.possible_duplicates) {
        return res.status(409).json({
          status: 'error',
          message: err.message,
          possible_duplicates: err.possible_duplicates,
        });
      }
      next(err);
    }
  },

  async createTicketWithAttachments(req, res, next) {
    try {
      const payload = { ...req.body, confirm_duplicate: req.body.confirm_duplicate === 'true' || req.body.confirm_duplicate === true };
      const redisClient = req.app.get('redis');
      const idemKey = req.headers['x-idempotency-key'];
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'] || '',
        sessionId: req.headers['x-session-id'] || null,
      };

      const run = async () => {
        const result = await TicketsService.createTicketWithAttachments({
          payload,
          files: req.files || [],
          user: req.user,
          meta,
        });
        const io = req.app.get('io');
        emitTicketUpdate(io, result.ticket.ticket_id, 'ticket-created', { ticket: result.ticket });
        return { status: 201, body: { status: 'success', data: result } };
      };

      if (idemKey && redisClient) {
        try {
          const cached = await redisClient.get(`idempotency:${idemKey}`);
          if (cached) {
            const { status, body } = JSON.parse(cached);
            return res.status(status).json(body);
          }
        } catch {
          // proceed
        }
        const result = await run();
        try {
          await redisClient.setEx(`idempotency:${idemKey}`, IDEMPOTENCY_TTL_SEC, JSON.stringify(result));
        } catch {
          // ignore
        }
        return res.status(result.status).json(result.body);
      }
      const result = await run();
      res.status(result.status).json(result.body);
    } catch (err) {
      if (err.status === 409 && err.possible_duplicates) {
        return res.status(409).json({
          status: 'error',
          message: err.message,
          possible_duplicates: err.possible_duplicates,
        });
      }
      next(err);
    }
  },

  async listTickets(req, res, next) {
    try {
      const result = await TicketsService.listTickets({
        query: req.query,
        user: req.user,
      });
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  },

  async getTicket(req, res, next) {
    try {
      const result = await TicketsService.getTicketDetails({
        ticketId: req.params.id,
        user: req.user,
      });
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateTicket(req, res, next) {
    try {
      const result = await TicketsService.updateTicket({
        ticketId: req.params.id,
        payload: req.body,
        user: req.user,
        meta: {
          ip: req.ip,
          userAgent: req.headers['user-agent'] || '',
          sessionId: req.headers['x-session-id'] || null,
        },
      });
      const io = req.app.get('io');
      emitTicketUpdate(io, req.params.id, 'ticket-updated', { ticket: result.ticket });
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  },

  async addComment(req, res, next) {
    try {
      const result = await TicketsService.addComment({
        ticketId: req.params.id,
        payload: req.body,
        user: req.user,
        meta: {
          ip: req.ip,
          userAgent: req.headers['user-agent'] || '',
          sessionId: req.headers['x-session-id'] || null,
        },
      });
      const io = req.app.get('io');
      emitTicketUpdate(io, req.params.id, 'ticket-comment', { ticketId: req.params.id, comment: result.comment });
      res.status(201).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  },

  async addAttachments(req, res, next) {
    try {
      const result = await TicketsService.addAttachments({
        ticketId: req.params.id,
        files: req.files || [],
        user: req.user,
        meta: {
          ip: req.ip,
          userAgent: req.headers['user-agent'] || '',
          sessionId: req.headers['x-session-id'] || null,
        },
      });
      res.status(201).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  },

  async getAuditLog(req, res, next) {
    try {
      const result = await TicketsService.getAuditLog({
        ticketId: req.params.id,
        user: req.user,
      });
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  },

  async getStatusHistory(req, res, next) {
    try {
      const result = await TicketsService.getStatusHistory({
        ticketId: req.params.id,
        user: req.user,
      });
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  },

  async listEscalations(req, res, next) {
    try {
      const result = await TicketsService.listEscalations({
        ticketId: req.params.id,
        user: req.user,
      });
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  },

  async createEscalation(req, res, next) {
    try {
      const result = await TicketsService.createEscalation({
        ticketId: req.params.id,
        payload: req.body,
        user: req.user,
        meta: {
          ip: req.ip,
          userAgent: req.headers['user-agent'] || '',
          sessionId: req.headers['x-session-id'] || null,
        },
      });
      res.status(201).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  },

  async listPriorityOverrideRequests(req, res, next) {
    try {
      const requests = await TicketsService.listPriorityOverrideRequests({
        ticketId: req.params.id,
        user: req.user,
      });
      res.json({ status: 'success', data: { requests } });
    } catch (err) {
      next(err);
    }
  },

  async requestPriorityOverride(req, res, next) {
    try {
      const result = await TicketsService.requestPriorityOverride({
        ticketId: req.params.id,
        payload: req.body,
        user: req.user,
        meta: {
          ip: req.ip,
          userAgent: req.headers['user-agent'] || '',
          sessionId: req.headers['x-session-id'] || null,
        },
      });
      res.status(201).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  },

  async reviewPriorityOverride(req, res, next) {
    try {
      const result = await TicketsService.reviewPriorityOverride({
        ticketId: req.params.id,
        requestId: req.params.requestId,
        payload: req.body,
        user: req.user,
        meta: {
          ip: req.ip,
          userAgent: req.headers['user-agent'] || '',
          sessionId: req.headers['x-session-id'] || null,
        },
      });
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  },

  async bulkAssign(req, res, next) {
    try {
      const result = await TicketsService.bulkAssignTickets({
        payload: req.body,
        user: req.user,
        meta: {
          ip: req.ip,
          userAgent: req.headers['user-agent'] || '',
          sessionId: req.headers['x-session-id'] || null,
        },
      });
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = TicketsController;
