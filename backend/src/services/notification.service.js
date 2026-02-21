const axios = require('axios');
const nodemailer = require('nodemailer');
const db = require('../config/database');
const logger = require('../utils/logger');

let transporter = null;

function isEmailEnabled() {
  const flag = process.env.ENABLE_EMAIL_NOTIFICATIONS;
  if (!flag) return true;
  return flag.toLowerCase() === 'true' || flag === '1';
}

function getEmailJsConfig() {
  const {
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    EMAILJS_PUBLIC_KEY,
    EMAILJS_PRIVATE_KEY,
  } = process.env;

  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    return null;
  }

  return {
    serviceId: EMAILJS_SERVICE_ID,
    templateId: EMAILJS_TEMPLATE_ID,
    publicKey: EMAILJS_PUBLIC_KEY,
    privateKey: EMAILJS_PRIVATE_KEY,
  };
}

function getTicketUrl(ticketId) {
  const baseUrl = process.env.FRONTEND_PROD_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl.replace(/\/$/, '')}/tickets?id=${ticketId}`;
}

async function sendEmail({ to, subject, text, templateParams = {} }) {
  if (!isEmailEnabled()) {
    logger.info('Email notifications disabled. Skipping email.', { subject, to });
    return false;
  }

  const override = process.env.NOTIFICATION_EMAIL_OVERRIDE;
  const finalTo = override && override.trim().length ? override.trim() : to;

  if (override) {
    logger.info('Email override active', { originalTo: to, finalTo });
  }

  const emailJsConfig = getEmailJsConfig();
  if (emailJsConfig) {
    if (!finalTo || !finalTo.trim()) {
      logger.error('EmailJS recipient is empty. Skipping send.', { subject });
      return false;
    }

    logger.info('Sending EmailJS email', {
      to: finalTo,
      subject,
      serviceId: emailJsConfig.serviceId,
      templateId: emailJsConfig.templateId,
    });

    const payload = {
      service_id: emailJsConfig.serviceId,
      template_id: emailJsConfig.templateId,
      template_params: {
        to_email: finalTo,
        email: finalTo,
        subject,
        message: text,
        app_name: process.env.APP_NAME || 'Madison88 ITSM',
        ...templateParams,
      },
    };

    payload.user_id = emailJsConfig.publicKey;
    if (emailJsConfig.privateKey) {
      payload.access_token = emailJsConfig.privateKey;
    }

    try {
      await axios.post('https://api.emailjs.com/api/v1.0/email/send', payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      logger.info('EmailJS send successful', { to: finalTo, subject });
      return true;
    } catch (err) {
      logger.error('Failed to send EmailJS email', {
        error: err.message,
        status: err.response?.status,
        data: err.response?.data,
        to: finalTo,
        subject,
      });
      return false;
    }
  }

  // Brevo (Sendinblue) API integration
  const SibApiV3Sdk = require('sib-api-v3-sdk');
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) {
    logger.warn('Brevo API key not configured. Skipping email.', { subject, to });
    return false;
  }

  const client = SibApiV3Sdk.ApiClient.instance;
  const apiKey = client.authentications['api-key'];
  apiKey.apiKey = brevoApiKey;
  const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

  const sender = {
    name: process.env.SMTP_FROM_NAME || 'Madison88 ITSM Support',
    email: process.env.SMTP_FROM_EMAIL || 'itsmmadison@gmail.com',
  };

  const sendSmtpEmail = {
    sender,
    to: Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }],
    subject,
    textContent: text,
    // Optionally add HTML content or templateParams
    // htmlContent: html,
    // params: templateParams,
  };

  // Audit log for sent email
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, old_value, new_value, description, ip_address, user_agent, session_id, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        '62530f75-a4d6-4d57-9778-0eae86e00f12', // Fallback System Admin ID
        'email_sent',
        'notification',
        null,
        null,
        JSON.stringify({ to, subject, text }),
        `Email sent to ${to} with subject '${subject}'`,
        null,
        'brevo',
        null,
      ]
    );
  } catch (auditErr) {
    logger.error('Failed to log email audit', { error: auditErr.message });
  }

  try {
    const result = await emailApi.sendTransacEmail(sendSmtpEmail);
    logger.info('Brevo email sent successfully', { messageId: result.messageId, to });
    return true;
  } catch (err) {
    logger.error('Failed to send email via Brevo', { error: err.message, to, subject });
    return false;
  }
}

async function sendEscalationNotice({ ticket, escalation, requester, assignee }) {
  const recipients = [];
  if (assignee?.email) recipients.push(assignee.email);
  if (requester?.email) recipients.push(requester.email);
  if (!recipients.length) return false;

  const ticketUrl = getTicketUrl(ticket.ticket_id);
  const subject = `Ticket Escalated: ${ticket.ticket_number}`;
  const text = [
    `Ticket ${ticket.ticket_number} has been escalated.`,
    `Title: ${ticket.title}`,
    `Severity: ${escalation.severity}`,
    `Reason: ${escalation.reason}`,
    '',
    `View ticket details: ${ticketUrl}`,
  ].join('\n');

  return sendEmail({ to: recipients.join(','), subject, text, templateParams: { ticket_url: ticketUrl } });
}

async function sendSlaEscalationNotice({ ticket, escalation, assignee, leads }) {
  const recipients = [];
  if (assignee?.email) recipients.push(assignee.email);
  if (leads && leads.length) {
    leads.forEach((lead) => {
      if (lead.email) recipients.push(lead.email);
    });
  }
  const uniqueRecipients = Array.from(new Set(recipients));
  if (!uniqueRecipients.length) return false;

  const ticketUrl = getTicketUrl(ticket.ticket_id);
  const subject = `SLA Escalation: ${ticket.ticket_number}`;
  const text = [
    `Ticket ${ticket.ticket_number} reached SLA threshold.`,
    `Title: ${ticket.title}`,
    `Priority: ${ticket.priority}`,
    `Severity: ${escalation.severity}`,
    `Reason: ${escalation.reason}`,
    '',
    `View ticket details: ${ticketUrl}`,
  ].join('\n');

  return sendEmail({ to: uniqueRecipients.join(','), subject, text, templateParams: { ticket_url: ticketUrl } });
}

async function sendTicketResolvedNotice({ ticket, requester }) {
  const recipients = collectRecipientEmails([requester]);
  if (!recipients.length) return false;

  const ticketUrl = getTicketUrl(ticket.ticket_id);
  const subject = `Ticket Resolved: ${ticket.ticket_number}`;
  const text = [
    `Your ticket ${ticket.ticket_number} has been resolved.`,
    `Title: ${ticket.title}`,
    `Resolution Summary: ${ticket.resolution_summary || 'No summary provided.'}`,
    `Category: ${ticket.resolution_category || 'Uncategorized'}`,
    `Root Cause: ${ticket.root_cause || 'Not specified'}`,
    '',
    `View details or confirm resolution: ${ticketUrl}`,
  ].join('\n');

  return sendEmail({
    to: recipients.join(','),
    subject,
    text,
    templateParams: {
      ticket_number: ticket.ticket_number,
      title: ticket.title,
      resolution_summary: ticket.resolution_summary || 'No summary provided.',
      resolution_category: ticket.resolution_category || 'Uncategorized',
      root_cause: ticket.root_cause || 'Not specified',
      ticket_url: ticketUrl,
    },
  });
}

function collectRecipientEmails(recipients = []) {
  // Normalize recipients list - can be array of objects with .email or array of strings
  const emails = recipients.map((r) => {
    if (typeof r === 'string') return r.trim();
    return r?.email?.trim();
  }).filter(Boolean);

  logger.debug('Normalizing recipients for email collection', { rawCount: recipients.length, emailCount: emails.length });

  // Basic format validation
  const validEmails = emails.filter((email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logger.warn('Skipping recipient with invalid format', { email });
      return false;
    }
    return true;
  });

  const unique = Array.from(new Set(validEmails));

  if (recipients.length > 0 && unique.length === 0) {
    logger.warn('Email collection resulted in zero valid recipients', { inputCount: recipients.length });
  } else {
    logger.info('Collection complete', { inputCount: recipients.length, validCount: unique.length, recipients: unique });
  }

  return unique;
}

async function sendNewTicketNotice({ ticket, requester, recipients }) {
  const allRecipients = [...(recipients || [])];
  if (requester?.email) {
    allRecipients.push(requester.email);
  }

  const uniqueRecipients = collectRecipientEmails(allRecipients);
  if (!uniqueRecipients.length) return false;

  const ticketUrl = getTicketUrl(ticket.ticket_id);
  const subject = `New Ticket: ${ticket.ticket_number}`;
  const text = [
    `A new ticket has been created: ${ticket.ticket_number}.`,
    `Title: ${ticket.title}`,
    `Priority: ${ticket.priority}`,
    `Category: ${ticket.category}`,
    requester?.full_name ? `Requester: ${requester.full_name}` : null,
    requester?.email ? `Requester Email: ${requester.email}` : null,
    '',
    `View ticket details: ${ticketUrl}`,
  ].filter(Boolean).join('\n');

  return sendEmail({ to: uniqueRecipients.join(','), subject, text, templateParams: { ticket_url: ticketUrl } });
}

async function sendTicketAssignedNotice({ ticket, assignee, leads = [] }) {
  const recipients = [assignee, ...leads];
  const uniqueRecipients = collectRecipientEmails(recipients);
  if (!uniqueRecipients.length) return false;

  const ticketUrl = getTicketUrl(ticket.ticket_id);
  const subject = `Ticket Assigned: ${ticket.ticket_number} - ${ticket.title}`;
  const text = [
    `Hello,`,
    '',
    `Ticket ${ticket.ticket_number} has been assigned to ${assignee?.full_name || 'an agent'}.`,
    '',
    `Title: ${ticket.title}`,
    `Priority: ${ticket.priority}`,
    `Category: ${ticket.category}`,
    `Location: ${ticket.location}`,
    '',
    `View details: ${ticketUrl}`,
    '',
    `Please log in to the Madison88 ITSM Platform to review the ticket details.`,
  ].filter(Boolean).join('\n');

  return sendEmail({
    to: uniqueRecipients.join(','),
    subject,
    text,
    templateParams: {
      ticket_number: ticket.ticket_number,
      title: ticket.title,
      priority: ticket.priority,
      assignee_name: assignee?.full_name,
      assignee_email: assignee?.email,
      ticket_url: ticketUrl,
    },
  });
}

async function sendTicketReopenedNotice({ ticket, requester, assignee, reopenedBy }) {
  const recipients = collectRecipientEmails([requester, assignee]);
  if (!recipients.length) return false;

  const ticketUrl = getTicketUrl(ticket.ticket_id);
  const subject = `Ticket Reopened: ${ticket.ticket_number}`;
  const text = [
    `Ticket ${ticket.ticket_number} has been reopened.`,
    `Title: ${ticket.title}`,
    `Reopened by: ${reopenedBy?.full_name || reopenedBy?.email || 'User'}`,
    '',
    `View details: ${ticketUrl}`,
    '',
    `Please review the ticket and provide a resolution.`,
  ].join('\n');

  return sendEmail({ to: recipients.join(','), subject, text, templateParams: { ticket_url: ticketUrl } });
}

async function sendCriticalTicketNotice({ ticket, requester, recipients }) {
  const uniqueRecipients = collectRecipientEmails(recipients);
  if (!uniqueRecipients.length) return false;

  const ticketUrl = getTicketUrl(ticket.ticket_id);
  const subject = `🔥 CRITICAL ALERT: ${ticket.ticket_number} - ${ticket.title}`;
  const text = [
    `URGENT: A P1 (Critical) ticket has been opened and requires IMMEDIATE attention.`,
    `--------------------------------------------------`,
    `Ticket ID: ${ticket.ticket_number}`,
    `Subject: ${ticket.title}`,
    `Category: ${ticket.category}`,
    `Location: ${ticket.location}`,
    requester?.full_name ? `Requester: ${requester.full_name}` : null,
    `--------------------------------------------------`,
    `View details: ${ticketUrl}`,
    `--------------------------------------------------`,
    `Description:`,
    ticket.description,
    `--------------------------------------------------`,
    `Please log in to the Madison88 ITSM Platform to begin resolution.`,
  ].filter(Boolean).join('\n');

  return sendEmail({
    to: uniqueRecipients.join(','),
    subject,
    text,
    templateParams: {
      is_critical: true,
      priority: 'P1',
      ticket_url: ticketUrl,
    }
  });
}

async function sendWelcomeNotice({ user }) {
  if (!user?.email) return false;

  const subject = `Welcome to ${process.env.APP_NAME || 'Madison88 ITSM'}`;
  const text = [
    `Hello ${user.full_name || 'there'},`,
    '',
    `Welcome to the Madison88 IT Service Management Platform! Your account has been successfully created.`,
    '',
    `You can now log in to the platform at: ${process.env.FRONTEND_PROD_URL || process.env.FRONTEND_URL || 'the portal'}`,
    '',
    `Through the portal, you can:`,
    `- Create new IT Support tickets`,
    `- Track the status of your requests`,
    `- View company announcements`,
    '',
    `If you have any questions, feel free to contact the IT support team.`,
    '',
    `Best regards,`,
    `${process.env.SMTP_FROM_NAME || 'Madison88 Support Team'}`,
  ].join('\n');

  return sendEmail({
    to: user.email,
    subject,
    text,
    templateParams: {
      user_name: user.full_name,
      welcome_link: process.env.FRONTEND_PROD_URL || process.env.FRONTEND_URL,
    },
  });
}

async function sendPasswordResetNotice({ user, temporaryPassword }) {
  if (!user?.email) return false;

  const subject = `Security: Temporary Password for ${process.env.APP_NAME || 'Madison88 ITSM'}`;
  const text = [
    `Hello ${user.full_name},`,
    '',
    `A temporary password has been generated for your account.`,
    '',
    `Temporary Password: ${temporaryPassword}`,
    '',
    `Please log in using the link below and change your password immediately upon entry.`,
    `${process.env.FRONTEND_PROD_URL || process.env.FRONTEND_URL}`,
    '',
    `Security Tip: Never share your password with anyone, including IT Support.`,
    '',
    `Best regards,`,
    `${process.env.SMTP_FROM_NAME || 'Madison88 Support Team'}`,
  ].join('\n');

  return sendEmail({
    to: user.email,
    subject,
    text,
    templateParams: {
      user_name: user.full_name,
      temp_password: temporaryPassword,
    },
  });
}

module.exports = {
  sendEmail,
  sendEscalationNotice,
  sendSlaEscalationNotice,
  sendTicketResolvedNotice,
  sendNewTicketNotice,
  sendTicketAssignedNotice,
  sendTicketReopenedNotice,
  sendCriticalTicketNotice,
  sendWelcomeNotice,
  sendPasswordResetNotice,
};
