import React, { useEffect, useMemo, useState } from "react";
import apiClient from "../api/client";

const KnowledgeBasePage = ({ user }) => {
  const [articles, setArticles] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("published");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    summary: "",
    category: "",
    tags: "",
    status: "draft",
    content: "",
    change_summary: "",
  });
  const [saving, setSaving] = useState(false);

  const isPrivileged = useMemo(
    () => ["it_manager", "system_admin"].includes(user?.role),
    [user?.role],
  );

  const normalizeTags = (value) => {
    if (!value) return "";
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  };

  const fetchArticles = async (params = {}) => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/kb/articles", { params });
      setArticles(res.data.data.articles || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load articles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = {};
    if (isPrivileged && statusFilter !== "all") {
      params.status = statusFilter;
    }
    fetchArticles(params);
  }, [isPrivileged, statusFilter]);

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!query.trim()) {
      const params = {};
      if (isPrivileged && statusFilter !== "all") {
        params.status = statusFilter;
      }
      return fetchArticles(params);
    }
    try {
      setLoading(true);
      setError("");
      const params = { q: query };
      if (isPrivileged && statusFilter !== "all") {
        params.status = statusFilter;
      }
      const res = await apiClient.get("/kb/search", { params });
      setArticles(res.data.data.results || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to search articles");
    } finally {
      setLoading(false);
    }
  };

  const loadArticle = async (articleId) => {
    setSelectedId(articleId);
    setDetailLoading(true);
    setDetailError("");
    setEditMode(false);
    try {
      const res = await apiClient.get(`/kb/articles/${articleId}`);
      const article = res.data.data.article;
      setSelectedArticle(article);
      setEditForm({
        title: article.title || "",
        summary: article.summary || "",
        category: article.category || "",
        tags: normalizeTags(article.tags),
        status: article.status || "draft",
        content: article.content || "",
        change_summary: "",
      });
    } catch (err) {
      setSelectedArticle(null);
      setDetailError(err.response?.data?.message || "Failed to load article");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedArticle) return;
    setSaving(true);
    setDetailError("");
    try {
      const payload = {
        title: editForm.title,
        summary: editForm.summary,
        category: editForm.category,
        tags: editForm.tags,
        status: editForm.status,
        content: editForm.content,
        change_summary: editForm.change_summary,
      };
      const res = await apiClient.patch(`/kb/articles/${selectedArticle.article_id}`, payload);
      const article = res.data.data.article;
      setSelectedArticle(article);
      setEditMode(false);
      setEditForm((prev) => ({
        ...prev,
        change_summary: "",
      }));

      const params = {};
      if (isPrivileged && statusFilter !== "all") {
        params.status = statusFilter;
      }
      await fetchArticles(params);
    } catch (err) {
      setDetailError(err.response?.data?.message || "Failed to update article");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Knowledge Base</h2>
          <p>Search SOPs, FAQs, and troubleshooting guides.</p>
        </div>
        <form className="kb-search" onSubmit={handleSearch}>
          {isPrivileged && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles"
          />
          <button className="btn ghost" type="submit">
            Search
          </button>
        </form>
      </div>
      {error && <div className="inline-error">{error}</div>}
      <div className="kb-layout">
        <div className="kb-list">
          {loading && <div className="panel muted">Loading articles...</div>}
          {!loading && !articles.length && (
            <div className="empty-state">No articles found.</div>
          )}
          {articles.map((article) => (
            <button
              key={article.article_id}
              className={`kb-card ${
                selectedId === article.article_id ? "active" : ""
              }`}
              type="button"
              onClick={() => loadArticle(article.article_id)}
            >
              <div>
                <h3>{article.title}</h3>
                <p>{article.summary || "No summary provided."}</p>
              </div>
              <div className="kb-meta">
                <span>{article.category}</span>
                {isPrivileged && <span>{article.status}</span>}
              </div>
            </button>
          ))}
        </div>
        <div className="kb-detail">
          {detailLoading && <div className="panel muted">Loading...</div>}
          {!detailLoading && detailError && (
            <div className="panel error">{detailError}</div>
          )}
          {!detailLoading && !detailError && !selectedArticle && (
            <div className="empty-state">Select an article to view details.</div>
          )}
          {!detailLoading && selectedArticle && (
            <div className="kb-detail-card">
              <div className="kb-detail-header">
                <div>
                  <h3>{selectedArticle.title}</h3>
                  <p className="muted">
                    {selectedArticle.category} · {selectedArticle.status}
                  </p>
                </div>
                {isPrivileged && (
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => setEditMode((prev) => !prev)}
                  >
                    {editMode ? "Cancel" : "Edit"}
                  </button>
                )}
              </div>
              {!editMode && (
                <div className="kb-detail-body">
                  <p>{selectedArticle.summary || "No summary provided."}</p>
                  <div className="kb-content">
                    {selectedArticle.content}
                  </div>
                </div>
              )}
              {editMode && (
                <div className="kb-edit-form">
                  <label className="field">
                    <span>Title</span>
                    <input
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Summary</span>
                    <textarea
                      rows={3}
                      value={editForm.summary}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          summary: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="kb-edit-grid">
                    <label className="field">
                      <span>Category</span>
                      <input
                        value={editForm.category}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            category: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Tags</span>
                      <input
                        value={editForm.tags}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            tags: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Status</span>
                      <select
                        value={editForm.status}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            status: e.target.value,
                          }))
                        }
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    <span>Content</span>
                    <textarea
                      rows={10}
                      value={editForm.content}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          content: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Change Summary</span>
                    <input
                      value={editForm.change_summary}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          change_summary: e.target.value,
                        }))
                      }
                      placeholder="What changed?"
                    />
                  </label>
                  {detailError && <div className="panel error">{detailError}</div>}
                  <div className="form-actions">
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => setEditMode(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn primary"
                      type="button"
                      onClick={handleUpdate}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBasePage;
