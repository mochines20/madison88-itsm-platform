const Joi = require('joi');
const path = require('path');
const AppError = require('../utils/AppError');
const TicketsModel = require('../models/tickets.model');
const AssetsModel = require('../models/assets.model');
const SlaModel = require('../models/sla.model');
const PriorityOverrideModel = require('../models/priority-override.model');
const UserModel = require('../models/user.model');
const NotificationService = require('./notification.service');
const NotificationsModel = require('../models/notifications.model');

const DEFAULT_RESPONSE_HOURS = Number(process.env.DEFAULT_SLA_RESPONSE_HOURS) || 4;
const DEFAULT_RESOLUTION_HOURS = Number(process.env.DEFAULT_SLA_RESOLUTION_HOURS) || 24;
const DUPLICATE_CHECK_HOURS = Number(process.env.DUPLICATE_CHECK_HOURS) || 24;
const ATTACHMENT_REQUIRED = process.env.ATTACHMENT_REQUIRED === 'true';

const createSchema = Joi.object({
  title: Joi.string().min(5).max(255).required(),
  description: Joi.string().min(10).required(),
  business_impact: Joi.string().min(10).required(),
  category: Joi.string().valid('Hardware', 'Software', 'Access Request', 'Account Creation', 'Network', 'Other').required(),
  location: Joi.string().valid('Philippines', 'US', 'Indonesia', 'Other').required(),
  subcategory: Joi.string().allow('', null),
  tags: Joi.string().allow('', null),
  priority: Joi.string().valid('P1', 'P2', 'P3', 'P4').allow('', null),
  ticket_type: Joi.string().valid('incident', 'request').default('incident'),
});

const updateSchema = Joi.object({
  status: Joi.string().valid('New', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Reopened'),
  priority: Joi.string().valid('P1', 'P2', 'P3', 'P4'),
  title: Joi.string().min(5).max(255),
  description: Joi.string().min(10),
  business_impact: Joi.string().min(10),
  assigned_to: Joi.string().uuid().allow(null, ''),
  assigned_team: Joi.string().uuid().allow(null, ''),
  priority_override_reason: Joi.string().allow('', null),
  resolution_summary: Joi.string().min(5).allow('', null),
  resolution_category: Joi.string().min(3).allow('', null),
  root_cause: Joi.string().min(3).allow('', null),
  status_change_reason: Joi.string().allow('', null),
}).min(1);

const commentSchema = Joi.object({
  comment_text: Joi.string().min(2).required(),
  is_internal: Joi.boolean().default(false),
});

const priorityOverrideSchema = Joi.object({
  requested_priority: Joi.string().valid('P1', 'P2', 'P3', 'P4').required(),
  reason: Joi.string().min(5).required(),
});

const bulkAssignSchema = Joi.object({
  ticket_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
  assigned_to: Joi.string().uuid().required(),
});

const PRIORITY_KEYWORDS = {
  P1: ['outage', 'down', 'security breach', 'breach', 'data loss', 'unavailable', 'critical'],
  P2: ['degradation', 'slow', 'vip', 'partial outage', 'mission critical'],
  P3: ['issue', 'problem', 'request', 'performance'],
  P4: ['information', 'feature request', 'question', 'documentation'],
};

async function getSlaRuleMap() {
  const rules = await SlaModel.listRules();
  return rules.reduce((acc, rule) => {
    acc[rule.priority] = rule;
    return acc;
  }, {});
}

function computeSlaStatus(ticket, rule) {
  if (!ticket || !ticket.sla_due_date || !rule) {
    return {
      response_remaining_minutes: null,
      resolution_remaining_minutes: null,
      response_breached: false,
      resolution_breached: false,
      escalated: false,
    };
  }

  const now = new Date();
  const createdAt = new Date(ticket.created_at);
  const responseDue = ticket.sla_response_due ? new Date(ticket.sla_response_due) : null;
  const resolutionDue = new Date(ticket.sla_due_date);

  const responseRemaining = responseDue ? Math.ceil((responseDue - now) / 60000) : null;
  const resolutionRemaining = Math.ceil((resolutionDue - now) / 60000);

  const responseBreached = responseDue ? now > responseDue : false;
  const resolutionBreached = now > resolutionDue;

  const totalWindowMs = resolutionDue - createdAt;
  const elapsedMs = now - createdAt;
  const elapsedPercent = totalWindowMs > 0 ? (elapsedMs / totalWindowMs) * 100 : 0;
  const escalated = elapsedPercent >= (rule.escalation_threshold_percent || 100);

  return {
    response_remaining_minutes: responseRemaining,
    resolution_remaining_minutes: resolutionRemaining,
    response_breached: responseBreached,
    resolution_breached: resolutionBreached,
    escalated,
  };
}

function normalizeText(value) {
  return (value || '').toLowerCase();
}

function detectPriority({ description, businessImpact, role }) {
  const text = `${normalizeText(description)} ${normalizeText(businessImpact)}`;
  const roleBoost = role === 'system_admin' || role === 'it_manager' ? 'vip' : '';
  const combined = `${text} ${roleBoost}`.trim();

  if (PRIORITY_KEYWORDS.P1.some((k) => combined.includes(k))) return 'P1';
  if (PRIORITY_KEYWORDS.P2.some((k) => combined.includes(k))) return 'P2';
  if (PRIORITY_KEYWORDS.P3.some((k) => combined.includes(k))) return 'P3';
  return 'P4';
}

function matchClassificationRule(rules, { description, businessImpact }) {
  const text = `${normalizeText(description)} ${normalizeText(businessImpact)}`;
  for (const rule of rules) {
    const keywords = (rule.keywords || []).map((k) => k.toLowerCase());
    if (!keywords.length) continue;
    const matches = keywords.filter((k) => text.includes(k));
    const isMatch = rule.matching_type === 'all' ? matches.length === keywords.length : matches.length > 0;
    if (isMatch) return rule;
  }
  return null;
}

function addBusinessDays(startDate, businessDays) {
  const result = new Date(startDate);
  let added = 0;
  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }
  return result;
}

function appendTag(tagString, tag) {
  const existing = (tagString || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!existing.includes(tag)) existing.push(tag);
  return existing.join(', ');
}

function mapPriorityToSeverity(priority) {
  switch (priority) {
    case 'P1':
      return 'critical';
    case 'P2':
      return 'high';
    case 'P3':
      return 'medium';
    default:
      return 'low';
  }
}

async function buildSla(priority) {
  const rule = await TicketsModel.getSlaRule(priority);
  const now = new Date();
  const responseHours = rule ? rule.response_time_hours : DEFAULT_RESPONSE_HOURS;
  const resolutionHours = rule ? rule.resolution_time_hours : DEFAULT_RESOLUTION_HOURS;
  const responseDue = new Date(now.getTime() + responseHours * 60 * 60 * 1000);
  const resolutionDue = new Date(now.getTime() + resolutionHours * 60 * 60 * 1000);
  return { sla_due_date: resolutionDue, sla_response_due: responseDue };
}

async function generateTicketNumber() {
  const year = new Date().getFullYear();
  const latest = await TicketsModel.getLatestTicketNumber(year);
  const next = latest ? parseInt(latest.split('-').pop(), 10) + 1 : 1;
  return `TKT-${year}-${String(next).padStart(4, '0')}`;
}

const TicketsService = {
  async createTicket({ payload, user, meta }) {
    if (user.role !== 'end_user') throw new AppError('Forbidden', 403);
    if (ATTACHMENT_REQUIRED) {
      throw new AppError('When ATTACHMENT_REQUIRED is enabled, use POST /tickets/with-attachments with at least one file.', 400);
    }
    const { error, value } = createSchema.validate(payload, { abortEarly: false });
    if (error) throw new AppError(error.details.map((d) => d.message).join(', '), 400);

    const createdAfter = new Date(Date.now() - DUPLICATE_CHECK_HOURS * 60 * 60 * 1000);
    const possible_duplicates = await TicketsModel.findPotentialDuplicates({
      title: value.title,
      description: value.description,
      userId: user.user_id,
      createdAfter,
    });
    if (possible_duplicates.length && !payload.confirm_duplicate) {
      const err = new AppError('Possible duplicate ticket. Submit with confirm_duplicate: true to create anyway.', 409);
      err.possible_duplicates = possible_duplicates;
      throw err;
    }

    const rules = await TicketsModel.getClassificationRules();
    const matchedRule = matchClassificationRule(rules, {
      description: value.description,
      businessImpact: value.business_impact,
    });
    const priority = value.priority || matchedRule?.assigned_priority || detectPriority({
      description: value.description,
      businessImpact: value.business_impact,
      role: user.role,
    });

    const ticket_number = await generateTicketNumber();
    const sla = await buildSla(priority);

    const routingRule = await TicketsModel.getRoutingRule({
      category: value.category,
      subcategory: value.subcategory,
      location: value.location,
    });

    const assigned_team = routingRule?.assigned_team || null;
    let assigned_to = null;
    let assigned_at = null;
    let assigned_by = null;
    if (assigned_team) {
      const agentId = await TicketsModel.getLeastLoadedAgent(assigned_team);
      if (agentId) {
        assigned_to = agentId;
        assigned_at = new Date();
        assigned_by = null;
      }
    }

    const ticket = await TicketsModel.createTicket({
      ticket_number,
      user_id: user.user_id,
      category: value.category,
      subcategory: value.subcategory || null,
      priority: routingRule?.priority_override || priority,
      title: value.title,
      description: value.description,
      business_impact: value.business_impact,
      status: 'New',
      location: value.location,
      tags: value.tags || null,
      ticket_type: value.ticket_type || 'incident',
      assigned_team,
      assigned_to,
      assigned_at,
      assigned_by,
      ...sla,
    });

    await TicketsModel.createStatusHistory({
      ticket_id: ticket.ticket_id,
      old_status: null,
      new_status: ticket.status,
      changed_by: user.user_id,
      change_reason: 'Ticket created',
    });

    await TicketsModel.createAuditLog({
      ticket_id: ticket.ticket_id,
      user_id: user.user_id,
      action_type: 'created',
      entity_type: 'ticket',
      entity_id: ticket.ticket_id,
      new_value: JSON.stringify(ticket),
      description: 'Ticket created',
      ip_address: meta.ip,
      user_agent: meta.userAgent,
      session_id: meta.sessionId,
    });

    if (assigned_team) {
      await TicketsModel.createAuditLog({
        ticket_id: ticket.ticket_id,
        user_id: user.user_id,
        action_type: 'routed',
        entity_type: 'ticket',
        entity_id: ticket.ticket_id,
        new_value: JSON.stringify({ assigned_team }),
        description: 'Ticket routed to team queue',
        ip_address: meta.ip,
        user_agent: meta.userAgent,
        session_id: meta.sessionId,
      });
    }

    const possible_duplicates = await TicketsModel.findPotentialDuplicates({
      title: value.title,
      description: value.description,
      excludeTicketId: ticket.ticket_id,
    });

    const adminUsers = await UserModel.listUsers({ role: 'system_admin' });
    const adminEmailOverride = process.env.ADMIN_NOTIFICATION_EMAIL;
    const requester = await UserModel.findById(user.user_id);
    const adminEmailRecipients = adminEmailOverride
      ? [{ email: adminEmailOverride }]
      : adminUsers;

    await NotificationService.sendNewTicketNotice({
      ticket,
      requester,
      recipients: adminEmailRecipients,
    });

    if (adminUsers.length) {
      const message = `${ticket.ticket_number}: ${ticket.title}`;
      for (const admin of adminUsers) {
        await NotificationsModel.createNotification({
          user_id: admin.user_id,
          ticket_id: ticket.ticket_id,
          type: 'ticket_created',
          title: 'New ticket',
          message,
        });
      }
    }

    return { ticket, possible_duplicates };
  },

  async createTicketWithAttachments({ payload, files, user, meta }) {
    if (user.role !== 'end_user') throw new AppError('Forbidden', 403);
    if (ATTACHMENT_REQUIRED && (!files || files.length === 0)) {
      throw new AppError('At least one attachment is required when ATTACHMENT_REQUIRED is enabled.', 400);
    }
    const { error, value } = createSchema.validate(payload, { abortEarly: false });
    if (error) throw new AppError(error.details.map((d) => d.message).join(', '), 400);

    const createdAfter = new Date(Date.now() - DUPLICATE_CHECK_HOURS * 60 * 60 * 1000);
    const possible_duplicates = await TicketsModel.findPotentialDuplicates({
      title: value.title,
      description: value.description,
      userId: user.user_id,
      createdAfter,
    });
    if (possible_duplicates.length && !payload.confirm_duplicate) {
      const err = new AppError('Possible duplicate ticket. Submit with confirm_duplicate: true to create anyway.', 409);
      err.possible_duplicates = possible_duplicates;
      throw err;
    }

    const rules = await TicketsModel.getClassificationRules();
    const matchedRule = matchClassificationRule(rules, {
      description: value.description,
      businessImpact: value.business_impact,
    });
    const priority = value.priority || matchedRule?.assigned_priority || detectPriority({
      description: value.description,
      businessImpact: value.business_impact,
      role: user.role,
    });

    const ticket_number = await generateTicketNumber();
    const sla = await buildSla(priority);

    const routingRule = await TicketsModel.getRoutingRule({
      category: value.category,
      subcategory: value.subcategory,
      location: value.location,
    });

    const assigned_team = routingRule?.assigned_team || null;
    let assigned_to = null;
    let assigned_at = null;
    let assigned_by = null;
    if (assigned_team) {
      const agentId = await TicketsModel.getLeastLoadedAgent(assigned_team);
      if (agentId) {
        assigned_to = agentId;
        assigned_at = new Date();
        assigned_by = null;
      }
    }

    const ticket = await TicketsModel.createTicket({
      ticket_number,
      user_id: user.user_id,
      category: value.category,
      subcategory: value.subcategory || null,
      priority: routingRule?.priority_override || priority,
      title: value.title,
      description: value.description,
      business_impact: value.business_impact,
      status: 'New',
      location: value.location,
      tags: value.tags || null,
      ticket_type: value.ticket_type || 'incident',
      assigned_team,
      assigned_to,
      assigned_at,
      assigned_by,
      ...sla,
    });

    await TicketsModel.createStatusHistory({
      ticket_id: ticket.ticket_id,
      old_status: null,
      new_status: ticket.status,
      changed_by: user.user_id,
      change_reason: 'Ticket created',
    });

    await TicketsModel.createAuditLog({
      ticket_id: ticket.ticket_id,
      user_id: user.user_id,
      action_type: 'created',
      entity_type: 'ticket',
      entity_id: ticket.ticket_id,
      new_value: JSON.stringify(ticket),
      description: 'Ticket created',
      ip_address: meta.ip,
      user_agent: meta.userAgent,
      session_id: meta.sessionId,
    });

    if (assigned_team) {
      await TicketsModel.createAuditLog({
        ticket_id: ticket.ticket_id,
        user_id: user.user_id,
        action_type: 'routed',
        entity_type: 'ticket',
        entity_id: ticket.ticket_id,
        new_value: JSON.stringify({ assigned_team }),
        description: 'Ticket routed to team queue',
        ip_address: meta.ip,
        user_agent: meta.userAgent,
        session_id: meta.sessionId,
      });
    }

    if (files && files.length) {
      try {
        for (const file of files) {
          const fileName = file.filename || path.basename(file.path || '');
          const filePath = fileName ? `uploads/${fileName}` : file.path;
          await TicketsModel.createAttachment({
            ticket_id: ticket.ticket_id,
            file_name: file.originalname,
            file_path: filePath,
            file_size: file.size,
            file_type: file.mimetype,
            uploaded_by: user.user_id,
          });
        }
        await TicketsModel.createAuditLog({
          ticket_id: ticket.ticket_id,
          user_id: user.user_id,
          action_type: 'attachment_added',
          entity_type: 'ticket_attachment',
          entity_id: ticket.ticket_id,
          new_value: JSON.stringify({ count: files.length }),
          description: 'Attachments uploaded on create',
          ip_address: meta.ip,
          user_agent: meta.userAgent,
          session_id: meta.sessionId,
        });
      } catch (attachErr) {
        await TicketsModel.deleteTicket(ticket.ticket_id);
        throw new AppError(attachErr.message || 'Failed to save attachments; ticket was not created.', 500);
      }
    }

    const possible_duplicates = await TicketsModel.findPotentialDuplicates({
      title: value.title,
      description: value.description,
      excludeTicketId: ticket.ticket_id,
    });

    const adminUsers = await UserModel.listUsers({ role: 'system_admin' });
    const adminEmailOverride = process.env.ADMIN_NOTIFICATION_EMAIL;
    const requester = await UserModel.findById(user.user_id);
    const adminEmailRecipients = adminEmailOverride
      ? [{ email: adminEmailOverride }]
      : adminUsers;

    await NotificationService.sendNewTicketNotice({
      ticket,
      requester,
      recipients: adminEmailRecipients,
    });

    if (adminUsers.length) {
      const message = `${ticket.ticket_number}: ${ticket.title}`;
      for (const admin of adminUsers) {
        await NotificationsModel.createNotification({
          user_id: admin.user_id,
          ticket_id: ticket.ticket_id,
          type: 'ticket_created',
          title: 'New ticket',
          message,
        });
      }
    }

    return { ticket, possible_duplicates };
  },

  async listTickets({ query, user }) {
    const { status, priority, category, assigned_to, unassigned, include_archived, page = 1, limit = 50, q, tags, date_from, date_to } = query;
    const parsedTags = typeof tags === 'string'
      ? tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : [];
    const filters = { status, priority, category, q, tags: parsedTags, date_from, date_to };
    if (include_archived !== 'true' && !['Resolved', 'Closed'].includes(status)) {
      filters.exclude_archived = true;
    }

    if (user.role === 'end_user') {
      filters.user_id = user.user_id;
    } else if (user.role === 'it_agent') {
      filters.assigned_to = user.user_id;
    } else if (user.role === 'it_manager') {
      const teamIds = await TicketsModel.listTeamIdsForUser(user.user_id);
      if (assigned_to) {
        filters.assigned_to = assigned_to;
      } else if (unassigned === 'true') {
        filters.assigned_to_is_null = true;
        if (teamIds.length) {
          filters.assigned_team_ids = teamIds;
        } else {
          return { tickets: [], pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total: 0 } };
        }
      } else if (teamIds.length) {
        const memberIds = await TicketsModel.listTeamMemberIdsForTeams(teamIds);
        filters.assigned_team_ids = teamIds;
        if (memberIds.length) filters.assigned_to_in = memberIds;
      } else {
        return { tickets: [], pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total: 0 } };
      }
    } else if (user.role === 'system_admin') {
      if (assigned_to) filters.assigned_to = assigned_to;
      if (unassigned === 'true') filters.assigned_to_is_null = true;
    } else {
      filters.user_id = user.user_id;
    }
    const pagination = { page: parseInt(page, 10), limit: parseInt(limit, 10) };
    const data = await TicketsModel.listTickets(filters, pagination);
    const slaRuleMap = await getSlaRuleMap();
    const tickets = data.tickets.map((ticket) => ({
      ...ticket,
      sla_status: computeSlaStatus(ticket, slaRuleMap[ticket.priority]),
    }));
    return { ...data, tickets };
  },

  async getTicketDetails({ ticketId, user }) {
    const ticket = await TicketsModel.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');
    if (user.role === 'end_user' && ticket.user_id !== user.user_id) throw new Error('Forbidden');
    if (user.role === 'it_agent') {
      if (ticket.assigned_to !== user.user_id && ticket.user_id !== user.user_id) {
        throw new Error('Forbidden');
      }
    }
    if (user.role === 'it_manager') {
      const teamIds = await TicketsModel.listTeamIdsForUser(user.user_id);
      if (teamIds.length) {
        const memberIds = await TicketsModel.listTeamMemberIdsForTeams(teamIds);
        const inTeam = teamIds.includes(ticket.assigned_team);
        const assignedToMember = ticket.assigned_to && memberIds.includes(ticket.assigned_to);
        if (!inTeam && !assignedToMember && ticket.assigned_to !== user.user_id) {
          throw new Error('Forbidden');
        }
      } else if (ticket.assigned_to !== user.user_id) {
        throw new Error('Forbidden');
      }
    }
    if (user.role === 'system_admin') {
      // full access
    }
    const slaRuleMap = await getSlaRuleMap();
    const sla_status = computeSlaStatus(ticket, slaRuleMap[ticket.priority]);
    const comments = await TicketsModel.getComments(ticketId);
    const visibleComments = user.role === 'end_user'
      ? comments.filter((comment) => !comment.is_internal)
      : comments;
    const attachments = await TicketsModel.getAttachments(ticketId);
    const assets = await AssetsModel.listTicketAssets(ticketId);
    return { ticket: { ...ticket, sla_status }, comments: visibleComments, attachments, assets };
  },

  async updateTicket({ ticketId, payload, user, meta }) {
    const { error, value } = updateSchema.validate(payload, { abortEarly: false });
    if (error) throw new Error(error.details.map((d) => d.message).join(', '));

    if (value.assigned_to === '') value.assigned_to = null;
    if (value.assigned_team === '') value.assigned_team = null;

    const existing = await TicketsModel.getTicketById(ticketId);
    if (!existing) throw new Error('Ticket not found');

    const statusChanged = value.status && value.status !== existing.status;
    const statusReason = value.status_change_reason;
    delete value.status_change_reason;

    if (user.role === 'end_user') {
      if (existing.user_id !== user.user_id) throw new Error('Forbidden');
      if (!['New', 'Pending'].includes(existing.status)) {
        throw new Error('Ticket can only be edited while New or Pending');
      }
      const allowedFields = ['title', 'description', 'business_impact'];
      const invalidFields = Object.keys(value).filter((key) => !allowedFields.includes(key));
      if (invalidFields.length) throw new Error('Forbidden');

      const updated = await TicketsModel.updateTicket(ticketId, value);
      await TicketsModel.createAuditLog({
        ticket_id: ticketId,
        user_id: user.user_id,
        action_type: 'updated',
        entity_type: 'ticket',
        entity_id: ticketId,
        old_value: JSON.stringify(existing),
        new_value: JSON.stringify(updated),
        description: 'Ticket updated by requester',
        ip_address: meta.ip,
        user_agent: meta.userAgent,
        session_id: meta.sessionId,
      });

      return { ticket: updated };
    }

    if (value.priority && user.role === 'it_agent') {
      throw new Error('Forbidden');
    }
    if (value.priority && user.role === 'it_manager') {
      throw new Error('Use priority override request');
    }
    if (value.priority && user.role === 'system_admin') {
      if (!value.priority_override_reason) throw new Error('Priority override reason required');
      value.overridden_by = user.user_id;
      value.overridden_at = new Date();
    }

    if (user.role === 'it_agent') {
      const isAssigned = existing.assigned_to === user.user_id;
      const isUnassigned = !existing.assigned_to;
      if (!isAssigned && !isUnassigned) throw new Error('Forbidden');
    }

    if (value.assigned_to && (user.role === 'it_agent' || user.role === 'end_user')) {
      throw new Error('Forbidden');
    }

    const assignedChanged = Object.prototype.hasOwnProperty.call(value, 'assigned_to')
      && value.assigned_to !== (existing.assigned_to || null);
    if (assignedChanged) {
      value.assigned_at = value.assigned_to ? new Date() : null;
      value.assigned_by = user.user_id;
    }

    if (statusChanged && ['Resolved', 'Closed'].includes(value.status)) {
      if (!value.resolution_summary || !value.resolution_category || !value.root_cause) {
        throw new Error('Resolution summary, category, and root cause are required');
      }
      if (
        existing.assigned_to !== user.user_id
        && !['it_manager', 'system_admin'].includes(user.role)
      ) {
        throw new Error('Forbidden');
      }
    }

    if (statusChanged && value.status === 'Resolved') {
      value.resolved_at = new Date();
      value.resolved_by = user.user_id;
      value.is_archived = true;
      value.archived_at = new Date();
    }

    if (statusChanged && value.status === 'Closed') {
      value.closed_at = new Date();
      value.closed_by = user.user_id;
      value.is_archived = true;
      value.archived_at = new Date();
    }

    if (statusChanged && value.status === 'Reopened') {
      value.reopened_count = (existing.reopened_count || 0) + 1;
      value.is_archived = false;
      value.archived_at = null;
    }

    const updated = await TicketsModel.updateTicket(ticketId, value);

    if (assignedChanged && value.assigned_to) {
      const assignee = await UserModel.findById(value.assigned_to);
      let leadIds = [];
      if (updated.assigned_team) {
        const leadId = await TicketsModel.getTeamLeadIdByTeamId(updated.assigned_team);
        if (leadId) leadIds = [leadId];
      } else {
        leadIds = await TicketsModel.listTeamLeadIdsForAssignee(value.assigned_to);
      }
      const leads = await UserModel.listByIds(leadIds);

      await NotificationService.sendTicketAssignedNotice({
        ticket: updated,
        assignee,
        leads,
      });

      const recipients = [assignee, ...leads].filter(Boolean);
      const uniqueRecipientIds = Array.from(new Set(recipients.map((r) => r.user_id).filter(Boolean)));
      if (uniqueRecipientIds.length) {
        const message = `${updated.ticket_number}: ${updated.title}`;
        for (const recipientId of uniqueRecipientIds) {
          await NotificationsModel.createNotification({
            user_id: recipientId,
            ticket_id: updated.ticket_id,
            type: 'ticket_assigned',
            title: 'Ticket assigned',
            message,
          });
        }
      }
    }

    if (statusChanged) {
      await TicketsModel.createStatusHistory({
        ticket_id: ticketId,
        old_status: existing.status,
        new_status: value.status,
        changed_by: user.user_id,
        change_reason: statusReason,
      });
    }

    if (statusChanged && ['Resolved', 'Closed'].includes(value.status)) {
      const requester = await UserModel.findById(existing.user_id);
      if (value.status === 'Resolved') {
        await NotificationService.sendTicketResolvedNotice({
          ticket: updated,
          requester,
        });
      }

      const titlePrefix = value.status === 'Resolved'
        ? 'Ticket resolved'
        : 'Ticket closed';
      const message = `${updated.ticket_number}: ${updated.title}`;
      await NotificationsModel.createNotification({
        user_id: existing.user_id,
        ticket_id: updated.ticket_id,
        type: value.status === 'Resolved' ? 'ticket_resolved' : 'ticket_closed',
        title: titlePrefix,
        message,
      });

      if (existing.assigned_to && existing.assigned_to !== existing.user_id) {
        await NotificationsModel.createNotification({
          user_id: existing.assigned_to,
          ticket_id: updated.ticket_id,
          type: value.status === 'Resolved' ? 'ticket_resolved' : 'ticket_closed',
          title: titlePrefix,
          message,
        });
      }
    }

    await TicketsModel.createAuditLog({
      ticket_id: ticketId,
      user_id: user.user_id,
      action_type: 'updated',
      entity_type: 'ticket',
      entity_id: ticketId,
      old_value: JSON.stringify(existing),
      new_value: JSON.stringify(updated),
      description: 'Ticket updated',
      ip_address: meta.ip,
      user_agent: meta.userAgent,
      session_id: meta.sessionId,
    });

    return { ticket: updated };
  },

  async addComment({ ticketId, payload, user, meta }) {
    const { error, value } = commentSchema.validate(payload, { abortEarly: false });
    if (error) throw new Error(error.details.map((d) => d.message).join(', '));

    const ticket = await TicketsModel.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');
    if (user.role === 'end_user' && ticket.user_id !== user.user_id) throw new Error('Forbidden');
    if (user.role === 'it_agent' && ticket.assigned_to !== user.user_id && ticket.user_id !== user.user_id) {
      throw new Error('Forbidden');
    }

    if (user.role === 'end_user' && value.is_internal) {
      throw new Error('Forbidden');
    }

    if (['it_agent', 'it_manager', 'system_admin'].includes(user.role) && !ticket.first_response_at) {
      await TicketsModel.updateTicket(ticketId, { first_response_at: new Date() });
    }

    const comment = await TicketsModel.createComment({
      ticket_id: ticketId,
      user_id: user.user_id,
      comment_text: value.comment_text,
      is_internal: value.is_internal,
    });

    await TicketsModel.createAuditLog({
      ticket_id: ticketId,
      user_id: user.user_id,
      action_type: 'commented',
      entity_type: 'ticket_comment',
      entity_id: comment.comment_id,
      new_value: JSON.stringify(comment),
      description: 'Comment added',
      ip_address: meta.ip,
      user_agent: meta.userAgent,
      session_id: meta.sessionId,
    });

    return { comment };
  },

  async addAttachments({ ticketId, files, user, meta }) {
    const ticket = await TicketsModel.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');
    if (user.role === 'end_user' && ticket.user_id !== user.user_id) {
      throw new Error('Forbidden');
    }
    if (user.role === 'it_agent' && ticket.assigned_to !== user.user_id && ticket.user_id !== user.user_id) {
      throw new Error('Forbidden');
    }

    const attachments = [];
    for (const file of files) {
      const fileName = file.filename || path.basename(file.path || '');
      const filePath = fileName ? `uploads/${fileName}` : file.path;
      const attachment = await TicketsModel.createAttachment({
        ticket_id: ticketId,
        file_name: file.originalname,
        file_path: filePath,
        file_size: file.size,
        file_type: file.mimetype,
        uploaded_by: user.user_id,
      });
      attachments.push(attachment);
    }

    if (attachments.length) {
      await TicketsModel.createAuditLog({
        ticket_id: ticketId,
        user_id: user.user_id,
        action_type: 'attachment_added',
        entity_type: 'ticket_attachment',
        entity_id: attachments[0].attachment_id,
        new_value: JSON.stringify(attachments),
        description: 'Attachment uploaded',
        ip_address: meta.ip,
        user_agent: meta.userAgent,
        session_id: meta.sessionId,
      });
    }

    return { attachments };
  },

  async getAuditLog({ ticketId, user }) {
    const ticket = await TicketsModel.getTicketById(ticketId);
    if (!ticket) throw new AppError('Ticket not found', 404);
    if (user.role === 'system_admin') {
      const audit_logs = await TicketsModel.getAuditLogs(ticketId);
      return { audit_logs };
    }
    if (user.role === 'it_manager') {
      const teamIds = await TicketsModel.listTeamIdsForUser(user.user_id);
      const memberIds = teamIds.length ? await TicketsModel.listTeamMemberIdsForTeams(teamIds) : [];
      const canAccess = teamIds.includes(ticket.assigned_team) || (ticket.assigned_to && memberIds.includes(ticket.assigned_to));
      if (!canAccess) throw new AppError('Forbidden', 403);
      const audit_logs = await TicketsModel.getAuditLogs(ticketId);
      return { audit_logs };
    }
    throw new AppError('Forbidden', 403);
  },

  async getStatusHistory({ ticketId, user }) {
    const ticket = await TicketsModel.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');
    if (user.role === 'end_user' && ticket.user_id !== user.user_id) throw new Error('Forbidden');
    if (user.role === 'it_agent' && ticket.assigned_to !== user.user_id && ticket.user_id !== user.user_id) {
      throw new Error('Forbidden');
    }
    const history = await TicketsModel.listStatusHistory(ticketId);
    return { history };
  },

  async listEscalations({ ticketId, user }) {
    const ticket = await TicketsModel.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');
    if (user.role === 'end_user' && ticket.user_id !== user.user_id) throw new Error('Forbidden');
    if (user.role === 'it_agent' && ticket.assigned_to !== user.user_id && ticket.user_id !== user.user_id) {
      throw new Error('Forbidden');
    }
    const escalations = await TicketsModel.listEscalations(ticketId);
    return { escalations };
  },

  async createEscalation({ ticketId, payload, user, meta }) {
    const schema = Joi.object({
      reason: Joi.string().min(5).required(),
      severity: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    });
    const { error, value } = schema.validate(payload, { abortEarly: false });
    if (error) throw new Error(error.details.map((d) => d.message).join(', '));

    const ticket = await TicketsModel.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    if (['it_agent', 'it_manager', 'system_admin'].includes(user.role)) {
      if (ticket.assigned_to !== user.user_id) throw new Error('Forbidden');
    } else {
      throw new Error('Forbidden');
    }

    const escalation = await TicketsModel.createEscalation({
      ticket_id: ticketId,
      reason: value.reason,
      severity: value.severity,
      escalated_by: user.user_id,
    });

    const requester = await UserModel.findById(ticket.user_id);
    const assignee = ticket.assigned_to ? await UserModel.findById(ticket.assigned_to) : null;
    await NotificationService.sendEscalationNotice({
      ticket,
      escalation,
      requester,
      assignee,
    });

    await TicketsModel.createAuditLog({
      ticket_id: ticketId,
      user_id: user.user_id,
      action_type: 'escalated',
      entity_type: 'ticket_escalation',
      entity_id: escalation.escalation_id,
      new_value: JSON.stringify(escalation),
      description: 'Ticket escalated',
      ip_address: meta.ip,
      user_agent: meta.userAgent,
      session_id: meta.sessionId,
    });

    return { escalation };
  },

  async listPriorityOverrideRequests({ ticketId, user }) {
    if (!['it_manager', 'system_admin'].includes(user.role)) throw new Error('Forbidden');
    return PriorityOverrideModel.listByTicket(ticketId);
  },

  async requestPriorityOverride({ ticketId, payload, user, meta }) {
    if (!['it_manager', 'system_admin'].includes(user.role)) throw new Error('Forbidden');
    const { error, value } = priorityOverrideSchema.validate(payload, { abortEarly: false });
    if (error) throw new Error(error.details.map((d) => d.message).join(', '));

    const ticket = await TicketsModel.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const pending = await PriorityOverrideModel.getPendingByTicket(ticketId);
    if (pending) throw new Error('Pending priority override request already exists');

    const request = await PriorityOverrideModel.createRequest({
      ticket_id: ticketId,
      requested_priority: value.requested_priority,
      reason: value.reason,
      requested_by: user.user_id,
      status: user.role === 'system_admin' ? 'approved' : 'pending',
    });

    await TicketsModel.createAuditLog({
      ticket_id: ticketId,
      user_id: user.user_id,
      action_type: 'priority_override_requested',
      entity_type: 'priority_override',
      entity_id: request.request_id,
      new_value: JSON.stringify(request),
      description: 'Priority override requested',
      ip_address: meta.ip,
      user_agent: meta.userAgent,
      session_id: meta.sessionId,
    });

    if (user.role === 'system_admin') {
      const updated = await TicketsModel.updateTicket(ticketId, {
        priority: value.requested_priority,
        priority_override_reason: value.reason,
        overridden_by: user.user_id,
        overridden_at: new Date(),
      });
      await PriorityOverrideModel.updateRequest(request.request_id, {
        reviewed_by: user.user_id,
        reviewed_at: new Date(),
      });
      await TicketsModel.createAuditLog({
        ticket_id: ticketId,
        user_id: user.user_id,
        action_type: 'priority_override_approved',
        entity_type: 'priority_override',
        entity_id: request.request_id,
        new_value: JSON.stringify(updated),
        description: 'Priority override approved and applied',
        ip_address: meta.ip,
        user_agent: meta.userAgent,
        session_id: meta.sessionId,
      });
    }

    return { request };
  },

  async reviewPriorityOverride({ ticketId, requestId, payload, user, meta }) {
    if (user.role !== 'system_admin') throw new Error('Forbidden');
    const schema = Joi.object({ status: Joi.string().valid('approved', 'rejected').required() });
    const { error, value } = schema.validate(payload, { abortEarly: false });
    if (error) throw new Error(error.details.map((d) => d.message).join(', '));

    const ticket = await TicketsModel.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const request = await PriorityOverrideModel.getRequestById(requestId);
    if (!request || request.ticket_id !== ticketId) throw new Error('Request not found');
    if (request.status !== 'pending') throw new Error('Request already processed');

    const updatedRequest = await PriorityOverrideModel.updateRequest(requestId, {
      status: value.status,
      reviewed_by: user.user_id,
      reviewed_at: new Date(),
    });

    if (value.status === 'approved') {
      const updated = await TicketsModel.updateTicket(ticketId, {
        priority: request.requested_priority,
        priority_override_reason: request.reason,
        overridden_by: user.user_id,
        overridden_at: new Date(),
      });
      await TicketsModel.createAuditLog({
        ticket_id: ticketId,
        user_id: user.user_id,
        action_type: 'priority_override_approved',
        entity_type: 'priority_override',
        entity_id: request.request_id,
        new_value: JSON.stringify(updated),
        description: 'Priority override approved',
        ip_address: meta.ip,
        user_agent: meta.userAgent,
        session_id: meta.sessionId,
      });
    }

    if (value.status === 'rejected') {
      await TicketsModel.createAuditLog({
        ticket_id: ticketId,
        user_id: user.user_id,
        action_type: 'priority_override_rejected',
        entity_type: 'priority_override',
        entity_id: request.request_id,
        new_value: JSON.stringify(updatedRequest),
        description: 'Priority override rejected',
        ip_address: meta.ip,
        user_agent: meta.userAgent,
        session_id: meta.sessionId,
      });
    }

    return { request: updatedRequest };
  },

  async bulkAssignTickets({ payload, user, meta }) {
    if (!['it_manager', 'system_admin'].includes(user.role)) throw new Error('Forbidden');
    const { error, value } = bulkAssignSchema.validate(payload, { abortEarly: false });
    if (error) throw new Error(error.details.map((d) => d.message).join(', '));

    const tickets = await TicketsModel.listTicketsByIds(value.ticket_ids);
    if (tickets.length !== value.ticket_ids.length) throw new Error('One or more tickets not found');

    if (user.role === 'it_manager') {
      const teamIds = await TicketsModel.listTeamIdsForUser(user.user_id);
      const memberIds = await TicketsModel.listTeamMemberIdsForTeams(teamIds);
      if (!memberIds.includes(value.assigned_to)) {
        throw new Error('Forbidden');
      }

      const isAllowed = tickets.every((ticket) => {
        const inTeam = teamIds.includes(ticket.assigned_team);
        const assignedToMember = ticket.assigned_to && memberIds.includes(ticket.assigned_to);
        return inTeam || assignedToMember;
      });

      if (!isAllowed) throw new Error('Forbidden');
    }

    const updatedTickets = await TicketsModel.updateTicketsAssignment({
      ticketIds: value.ticket_ids,
      assignedTo: value.assigned_to,
      assignedBy: user.user_id,
    });

    const ticketMap = new Map(tickets.map((ticket) => [ticket.ticket_id, ticket]));
    for (const ticket of updatedTickets) {
      const previous = ticketMap.get(ticket.ticket_id);
      await TicketsModel.createAuditLog({
        ticket_id: ticket.ticket_id,
        user_id: user.user_id,
        action_type: 'bulk_assigned',
        entity_type: 'ticket',
        entity_id: ticket.ticket_id,
        old_value: JSON.stringify(previous),
        new_value: JSON.stringify(ticket),
        description: 'Ticket bulk assigned',
        ip_address: meta.ip,
        user_agent: meta.userAgent,
        session_id: meta.sessionId,
      });

      if (ticket.assigned_to) {
        const assignee = await UserModel.findById(ticket.assigned_to);
        let leadIds = [];
        if (ticket.assigned_team) {
          const leadId = await TicketsModel.getTeamLeadIdByTeamId(ticket.assigned_team);
          if (leadId) leadIds = [leadId];
        } else {
          leadIds = await TicketsModel.listTeamLeadIdsForAssignee(ticket.assigned_to);
        }
        const leads = await UserModel.listByIds(leadIds);

        await NotificationService.sendTicketAssignedNotice({
          ticket,
          assignee,
          leads,
        });

        const recipients = [assignee, ...leads].filter(Boolean);
        const uniqueRecipientIds = Array.from(new Set(recipients.map((r) => r.user_id).filter(Boolean)));
        if (uniqueRecipientIds.length) {
          const message = `${ticket.ticket_number}: ${ticket.title}`;
          for (const recipientId of uniqueRecipientIds) {
            await NotificationsModel.createNotification({
              user_id: recipientId,
              ticket_id: ticket.ticket_id,
              type: 'ticket_assigned',
              title: 'Ticket assigned',
              message,
            });
          }
        }
      }
    }

    return { tickets: updatedTickets };
  },

  async runSlaEscalations({ thresholdPercent, statuses }) {
    const candidates = await TicketsModel.listSlaEscalationCandidates({
      thresholdPercent,
      statuses,
    });

    const results = [];
    for (const ticket of candidates) {
      const alreadyEscalated = await TicketsModel.hasSlaEscalation(ticket.ticket_id);
      if (alreadyEscalated) continue;

      const escalation = await TicketsModel.createEscalation({
        ticket_id: ticket.ticket_id,
        reason: `SLA threshold ${thresholdPercent}% reached`,
        severity: mapPriorityToSeverity(ticket.priority),
        escalated_by: null,
      });

      const assignee = ticket.assigned_to
        ? await UserModel.findById(ticket.assigned_to)
        : null;

      let leadIds = [];
      if (ticket.assigned_team) {
        const leadId = await TicketsModel.getTeamLeadIdByTeamId(ticket.assigned_team);
        if (leadId) leadIds = [leadId];
      } else if (ticket.assigned_to) {
        leadIds = await TicketsModel.listTeamLeadIdsForAssignee(ticket.assigned_to);
      }

      const leads = await UserModel.listByIds(leadIds);

      await NotificationService.sendSlaEscalationNotice({
        ticket,
        escalation,
        assignee,
        leads,
      });

      await TicketsModel.createAuditLog({
        ticket_id: ticket.ticket_id,
        user_id: null,
        action_type: 'sla_auto_escalated',
        entity_type: 'ticket_escalation',
        entity_id: escalation.escalation_id,
        new_value: JSON.stringify(escalation),
        description: 'Ticket auto-escalated based on SLA threshold',
        ip_address: null,
        user_agent: 'system',
        session_id: null,
      });

      results.push({ ticket_id: ticket.ticket_id, escalation_id: escalation.escalation_id });
    }

    return { escalated: results.length, items: results };
  },

  async runAutoCloseResolvedTickets({ businessDays }) {
    const candidates = await TicketsModel.listResolvedTicketsForAutoClose();
    const now = new Date();
    const results = [];

    for (const ticket of candidates) {
      const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
      if (!resolvedAt || Number.isNaN(resolvedAt.getTime())) continue;
      const dueDate = addBusinessDays(resolvedAt, businessDays);
      if (now < dueDate) continue;

      const updated = await TicketsModel.updateTicket(ticket.ticket_id, {
        status: 'Closed',
        closed_at: now,
        closed_by: ticket.assigned_to || ticket.user_id,
        is_archived: true,
        archived_at: now,
        tags: appendTag(ticket.tags, 'auto-closed'),
      });

      await TicketsModel.createStatusHistory({
        ticket_id: ticket.ticket_id,
        old_status: ticket.status,
        new_status: 'Closed',
        changed_by: ticket.assigned_to || ticket.user_id,
        change_reason: `Auto-closed after ${businessDays} business days`,
      });

      await TicketsModel.createAuditLog({
        ticket_id: ticket.ticket_id,
        user_id: ticket.assigned_to || ticket.user_id,
        action_type: 'auto_closed',
        entity_type: 'ticket',
        entity_id: ticket.ticket_id,
        old_value: JSON.stringify(ticket),
        new_value: JSON.stringify(updated),
        description: `Ticket auto-closed after ${businessDays} business days`,
        ip_address: null,
        user_agent: 'system',
        session_id: null,
      });

      results.push({ ticket_id: ticket.ticket_id });
    }

    return { closed: results.length, items: results };
  },
};

module.exports = TicketsService;
