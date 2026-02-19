const express = require('express');
const Joi = require('joi');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const AssetsModel = require('../models/assets.model');
const TicketsModel = require('../models/tickets.model');

const router = express.Router();

const createSchema = Joi.object({
  asset_tag: Joi.string().min(3).required(),
  serial_number: Joi.string().allow('', null),
  asset_type: Joi.string()
    .valid('laptop', 'desktop', 'monitor', 'printer', 'server', 'network_device', 'projector', 'docking_station', 'ups', 'other')
    .required(),
  model: Joi.string().allow('', null),
  manufacturer: Joi.string().allow('', null),
  assigned_user_id: Joi.string().uuid().allow('', null),
  location: Joi.string().allow('', null),
  purchase_date: Joi.date().allow(null),
  warranty_expiration: Joi.date().allow(null),
  last_maintenance_date: Joi.date().allow(null),
  next_maintenance_date: Joi.date().allow(null),
  cost: Joi.number().precision(2).allow(null),
  currency: Joi.string().length(3).default('USD'),
  status: Joi.string().valid('active', 'inactive', 'retired', 'for_repair').default('active'),
}).required();

const updateSchema = Joi.object({
  asset_tag: Joi.string().min(3),
  serial_number: Joi.string().allow('', null),
  asset_type: Joi.string().valid('laptop', 'desktop', 'monitor', 'printer', 'server', 'network_device', 'projector', 'docking_station', 'ups', 'other'),
  model: Joi.string().allow('', null),
  manufacturer: Joi.string().allow('', null),
  assigned_user_id: Joi.string().uuid().allow('', null),
  location: Joi.string().allow('', null),
  purchase_date: Joi.date().allow(null),
  warranty_expiration: Joi.date().allow(null),
  last_maintenance_date: Joi.date().allow(null),
  next_maintenance_date: Joi.date().allow(null),
  cost: Joi.number().precision(2).allow(null),
  currency: Joi.string().length(3),
  status: Joi.string().valid('active', 'inactive', 'retired', 'for_repair'),
}).min(1);

router.get('/', authenticate, authorize(['it_agent', 'it_manager', 'system_admin', 'end_user']), async (req, res, next) => {
  try {
    const { status, asset_type, assigned_user_id } = req.query;
    const userAssignedId = req.user.role === 'end_user' ? req.user.user_id : assigned_user_id;

    let location = req.query.location || null;
    if (['it_agent', 'it_manager'].includes(req.user.role) && req.user.location) {
      location = req.user.location;
    }

    const assets = await AssetsModel.listAssets({ status, asset_type, assigned_user_id: userAssignedId, location });
    const scored = assets.map((asset) => {
      const openCount = asset.open_ticket_count || 0;
      const avgAge = Number(asset.avg_open_age_days || 0);
      const rawScore = 100 - (openCount * 12 + avgAge * 3);
      const score = Math.max(0, Math.min(100, Math.round(rawScore)));
      const health_label = score >= 80 ? 'good' : score >= 60 ? 'watch' : 'risk';
      return {
        ...asset,
        health_score: score,
        health_label,
      };
    });
    res.json({ status: 'success', data: { assets: scored } });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, authorize(['it_agent', 'it_manager', 'system_admin', 'end_user']), async (req, res, next) => {
  try {
    const asset = await AssetsModel.getAssetById(req.params.id);
    if (!asset) return res.status(404).json({ status: 'error', message: 'Asset not found' });

    // Strict isolation: IT staff check
    if (['it_agent', 'it_manager'].includes(req.user.role)) {
      if (req.user.location && asset.location !== req.user.location) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: Asset belongs to another location' });
      }
    }
    const tickets = await AssetsModel.listAssetTickets(req.params.id);
    const openCount = asset.open_ticket_count || 0;
    const avgAge = Number(asset.avg_open_age_days || 0);
    const rawScore = 100 - (openCount * 12 + avgAge * 3);
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));
    const health_label = score >= 80 ? 'good' : score >= 60 ? 'watch' : 'risk';
    res.json({
      status: 'success',
      data: { asset: { ...asset, health_score: score, health_label }, tickets },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, authorize(['it_manager', 'system_admin']), async (req, res, next) => {
  try {
    const { error, value } = createSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ status: 'error', message: error.details.map((d) => d.message).join(', ') });
    }
    // Strict isolation: Manager location enforcement
    if (req.user.role === 'it_manager' && req.user.location) {
      if (value.location && value.location !== req.user.location) {
        return res.status(403).json({ status: 'error', message: `Forbidden: You can only create assets for the ${req.user.location} region` });
      }
      // Force location to manager's location if not provided
      if (!value.location) value.location = req.user.location;
    }

    const asset = await AssetsModel.createAsset({
      asset_tag: value.asset_tag,
      serial_number: value.serial_number || null,
      asset_type: value.asset_type,
      model: value.model || null,
      manufacturer: value.manufacturer || null,
      assigned_user_id: value.assigned_user_id || null,
      location: value.location || null,
      purchase_date: value.purchase_date || null,
      warranty_expiration: value.warranty_expiration || null,
      last_maintenance_date: value.last_maintenance_date || null,
      next_maintenance_date: value.next_maintenance_date || null,
      cost: value.cost || null,
      currency: value.currency || 'USD',
      status: value.status || 'active',
    });
    res.status(201).json({ status: 'success', data: { asset } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ status: 'error', message: 'Asset tag already exists' });
    }
    next(err);
  }
});

router.patch('/:id', authenticate, authorize(['it_manager', 'system_admin']), async (req, res, next) => {
  try {
    const { error, value } = updateSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ status: 'error', message: error.details.map((d) => d.message).join(', ') });
    }
    const existingAsset = await AssetsModel.getAssetById(req.params.id);
    if (!existingAsset) return res.status(404).json({ status: 'error', message: 'Asset not found' });

    // Strict isolation: IT manager location check
    if (req.user.role === 'it_manager' && req.user.location) {
      if (existingAsset.location !== req.user.location) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: Asset belongs to another location' });
      }
      // Also prevent moving assets to other locations
      if (value.location && value.location !== req.user.location) {
        return res.status(403).json({ status: 'error', message: `Forbidden: You cannot move assets to the ${value.location} region` });
      }
    }

    const asset = await AssetsModel.updateAsset(req.params.id, value);
    res.json({ status: 'success', data: { asset } });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/link-ticket', authenticate, authorize(['it_agent', 'it_manager', 'system_admin', 'end_user']), async (req, res, next) => {
  try {
    const schema = Joi.object({ ticket_id: Joi.string().uuid().required() });
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ status: 'error', message: error.details.map((d) => d.message).join(', ') });
    }
    if (req.user.role === 'end_user') {
      const ticket = await TicketsModel.getTicketById(value.ticket_id);
      if (!ticket || ticket.user_id !== req.user.user_id) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: insufficient permissions' });
      }
      const asset = await AssetsModel.getAssetById(req.params.id);
      if (!asset || asset.assigned_user_id !== req.user.user_id) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: insufficient permissions' });
      }
    }
    const association = await AssetsModel.linkAssetTicket(req.params.id, value.ticket_id);
    res.status(201).json({ status: 'success', data: { association } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
