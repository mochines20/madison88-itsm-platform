const db = require('../config/database');

const KnowledgeBaseModel = {
  async listArticles({ category, status, page, limit }) {
    const where = [];
    const values = [];

    if (category) {
      values.push(category);
      where.push(`category = $${values.length}`);
    }
    if (status) {
      values.push(status);
      where.push(`status = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const countResult = await db.query(`SELECT COUNT(*) FROM knowledge_base_articles ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(limit, offset);
    const result = await db.query(
      `SELECT article_id, title, slug, summary, category, tags, author_id, status, views, created_at, updated_at, published_at
       FROM knowledge_base_articles ${whereClause}
       ORDER BY updated_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return { articles: result.rows, pagination: { page, limit, total } };
  },

  async getArticleById(id) {
    const result = await db.query('SELECT * FROM knowledge_base_articles WHERE article_id = $1', [id]);
    return result.rows[0];
  },

  async getArticleBySlug(slug) {
    const result = await db.query('SELECT * FROM knowledge_base_articles WHERE slug = $1', [slug]);
    return result.rows[0];
  },

  async incrementViews(id) {
    await db.query('UPDATE knowledge_base_articles SET views = views + 1 WHERE article_id = $1', [id]);
  },

  async createArticle(data) {
    const result = await db.query(
      `INSERT INTO knowledge_base_articles
        (title, slug, content, summary, category, tags, author_id, status, created_at, updated_at, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW(),$9)
       RETURNING *`,
      [
        data.title,
        data.slug,
        data.content,
        data.summary || null,
        data.category,
        data.tags || null,
        data.author_id,
        data.status,
        data.status === 'published' ? new Date() : null,
      ]
    );
    return result.rows[0];
  },

  async createVersion({ article_id, content, version_number, changed_by, change_summary }) {
    const result = await db.query(
      `INSERT INTO kb_article_versions (article_id, content, version_number, changed_by, change_summary)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [article_id, content, version_number, changed_by, change_summary || null]
    );
    return result.rows[0];
  },

  async updateArticle(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');

    const result = await db.query(
      `UPDATE knowledge_base_articles SET ${setClause}, updated_at = NOW() WHERE article_id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    );
    return result.rows[0];
  },

  async searchArticles({ q, category, status, page, limit }) {
    const where = [];
    const values = [];

    values.push(`%${q}%`);
    where.push(`(title ILIKE $${values.length} OR content ILIKE $${values.length})`);

    if (category) {
      values.push(category);
      where.push(`category = $${values.length}`);
    }

    if (status) {
      values.push(status);
      where.push(`status = $${values.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const countResult = await db.query(`SELECT COUNT(*) FROM knowledge_base_articles ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(limit, offset);
    const result = await db.query(
      `SELECT article_id, title, slug, summary, category, tags, status, views, created_at, updated_at
       FROM knowledge_base_articles ${whereClause}
       ORDER BY updated_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return { results: result.rows, pagination: { page, limit, total } };
  },
};

module.exports = KnowledgeBaseModel;
