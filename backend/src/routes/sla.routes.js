const express = require('express');
const Joi = require('joi');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const SlaModel = require('../models/sla.model');

const router = express.Router();

const ruleSchema = Joi.object({
  priority: Joi.string().valid('P1', 'P2', 'P3', 'P4').required(),
  category: Joi.string().allow('', null).optional(),
  response_time_hours: Joi.number().integer().min(1).required(),
  resolution_time_hours: Joi.number().integer().min(1).required(),
  escalation_threshold_percent: Joi.number().integer().min(1).max(100).default(80),
  is_active: Joi.boolean().default(true),
});

const rulePatchSchema = Joi.object({
  priority: Joi.string().valid('P1', 'P2', 'P3', 'P4'),
  category: Joi.string().allow('', null),
  response_time_hours: Joi.number().integer().min(1),
  resolution_time_hours: Joi.number().integer().min(1),
  escalation_threshold_percent: Joi.number().integer().min(1).max(100),
  is_active: Joi.boolean(),
}).min(1);

// List SLA rules (admin only)
router.get('/', authenticate, authorize(['system_admin']), async (req, res, next) => {
  console.log('GET /api/sla-governance hit');
  try {
    const rules = await SlaModel.listRules();
    res.json({ status: 'success', data: { rules } });
  } catch (err) {
    next(err);
  }
});

// Create new SLA rule (admin only)
router.post('/', authenticate, authorize(['system_admin']), async (req, res, next) => {
  console.log('POST /api/sla-governance hit:', req.body);
  try {
    const { error, value } = ruleSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) throw new Error(error.details.map((d) => d.message).join(', '));

    const rule = await SlaModel.upsertRule(value);
    res.json({ status: 'success', data: { rule } });
  } catch (err) {
    next(err);
  }
});

// Update SLA rule by ID (admin only)
router.patch('/:slaId', authenticate, authorize(['system_admin']), async (req, res, next) => {
  console.log(`PATCH /api/sla-governance/${req.params.slaId} hit:`, req.body);
  try {
    const { slaId } = req.params;
    if (!slaId) throw new Error('SLA ID is required');

    const { error, value } = rulePatchSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) throw new Error(error.details.map((d) => d.message).join(', '));

    const rule = await SlaModel.updateRule(slaId, value);
    if (!rule) return res.status(404).json({ status: 'error', message: 'SLA rule not found' });

    res.json({ status: 'success', data: { rule } });
  } catch (err) {
    next(err);
  }
});

// Delete SLA rule by ID (admin only)
router.delete('/:slaId', authenticate, authorize(['system_admin']), async (req, res, next) => {
  console.log(`DELETE /api/sla-governance/${req.params.slaId} hit`);
  try {
    const { slaId } = req.params;
    if (!slaId) throw new Error('SLA ID is required');

    const rule = await SlaModel.deleteRule(slaId);
    if (!rule) return res.status(404).json({ status: 'error', message: 'SLA rule not found' });

    res.json({ status: 'success', message: 'SLA rule deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Backward compatibility or simpler upsert by priority (optional, but let's keep it if needed or remove if strictly following new UI)
// Actually, let's remove the legacy PUT /:priority to emphasize the new ID-based approach.

module.exports = router;
