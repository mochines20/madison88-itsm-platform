/**
 * Knowledge Base Routes
 * GET /api/kb/articles
 * GET /api/kb/articles/:id
 * POST /api/kb/articles
 * PATCH /api/kb/articles/:id
 * GET /api/kb/search
 */

const express = require('express');
const Joi = require('joi');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const KnowledgeBaseModel = require('../models/knowledgebase.model');
const router = express.Router();

const toSlug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

async function ensureUniqueSlug(baseSlug, currentId = null) {
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await KnowledgeBaseModel.getArticleBySlug(slug);
    if (!existing || (currentId && existing.article_id === currentId)) {
      return slug;
    }
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
}

/**
 * @route GET /api/kb/articles
 * @desc Get all KB articles
 */
router.get('/articles', authenticate, async (req, res, next) => {
  try {
    const { category, status, page = 1, limit = 50 } = req.query;
    const isPrivileged = ['it_manager', 'system_admin'].includes(req.user.role);
    const resolvedStatus = isPrivileged ? status : 'published';
    const data = await KnowledgeBaseModel.listArticles({
      category,
      status: resolvedStatus,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/kb/articles/:id
 * @desc Get single KB article
 */
router.get('/articles/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const article = await KnowledgeBaseModel.getArticleById(id);
    if (!article) {
      return res.status(404).json({ status: 'error', message: 'Article not found' });
    }
    const isPrivileged = ['it_manager', 'system_admin'].includes(req.user.role);
    if (!isPrivileged && article.status !== 'published') {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }
    await KnowledgeBaseModel.incrementViews(id);
    res.json({ status: 'success', data: { article } });
  } catch (err) {
    next(err);
  }
});

/**
 * @route POST /api/kb/articles
 * @desc Create KB article
 */
router.post('/articles', authenticate, authorize(['it_manager', 'system_admin']), async (req, res, next) => {
  try {
    const schema = Joi.object({
      title: Joi.string().min(5).max(255).required(),
      content: Joi.string().min(20).required(),
      summary: Joi.string().allow('', null),
      category: Joi.string().min(2).required(),
      tags: Joi.string().allow('', null),
      status: Joi.string().valid('draft', 'published', 'archived').default('draft'),
    });

    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: error.details.map((d) => d.message).join(', '),
      });
    }

    const baseSlug = toSlug(value.title);
    const slug = await ensureUniqueSlug(baseSlug);

    const article = await KnowledgeBaseModel.createArticle({
      title: value.title,
      slug,
      content: value.content,
      summary: value.summary,
      category: value.category,
      tags: value.tags,
      status: value.status,
      author_id: req.user.user_id,
    });

    res.status(201).json({ status: 'success', data: { article } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ status: 'error', message: 'Article title already exists' });
    }
    next(err);
  }
});

/**
 * @route PATCH /api/kb/articles/:id
 * @desc Update KB article
 */
router.patch('/articles/:id', authenticate, authorize(['it_manager', 'system_admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = Joi.object({
      title: Joi.string().min(5).max(255),
      content: Joi.string().min(20),
      summary: Joi.string().allow('', null),
      category: Joi.string().min(2),
      tags: Joi.string().allow('', null),
      status: Joi.string().valid('draft', 'published', 'archived'),
      change_summary: Joi.string().allow('', null),
    }).min(1);

    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: error.details.map((d) => d.message).join(', '),
      });
    }

    const existing = await KnowledgeBaseModel.getArticleById(id);
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Article not found' });
    }

    const updates = { ...value };
    delete updates.change_summary;
    if (value.content) {
      const nextVersion = (existing.version || 1) + 1;
      await KnowledgeBaseModel.createVersion({
        article_id: id,
        content: existing.content,
        version_number: nextVersion,
        changed_by: req.user.user_id,
        change_summary: value.change_summary,
      });
      updates.version = nextVersion;
    }
    if (updates.title) {
      const baseSlug = toSlug(updates.title);
      updates.slug = await ensureUniqueSlug(baseSlug, id);
    }
    if (updates.status === 'published' && !existing.published_at) {
      updates.published_at = new Date();
    }

    const article = await KnowledgeBaseModel.updateArticle(id, updates);
    res.json({ status: 'success', data: { article } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ status: 'error', message: 'Article title already exists' });
    }
    next(err);
  }
});

/**
 * @route GET /api/kb/search
 * @desc Search KB articles
 */
router.get('/search', authenticate, async (req, res, next) => {
  try {
    const { q, category, status, page = 1, limit = 50 } = req.query;
    const isPrivileged = ['it_manager', 'system_admin'].includes(req.user.role);
    const resolvedStatus = isPrivileged ? status : 'published';

    if (!q) {
      return res.status(400).json({
        status: 'error',
        message: 'Search query is required'
      });
    }

    const data = await KnowledgeBaseModel.searchArticles({
      q,
      category,
      status: resolvedStatus,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
