import React, { useState } from "react";
import apiClient from "../../api/client";
import GlassyModal from "./GlassyModal";

const TicketActionPanel = ({ ticket, user, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [kbQuery, setKbQuery] = useState("");
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [kbResults, setKbResults] = useState([]);
  const [searchingKb, setSearchingKb] = useState(false);

  // Modal States
  const [activeModal, setActiveModal] = useState(null); // 'resolve', 'ownership', 'kb', 'assign', 'close'
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [resolutionForm, setResolutionForm] = useState({
    category: "Software",
    root_cause: "",
    summary: "",
  });

  const [staff, setStaff] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [localTime, setLocalTime] = useState("");

  const LOCATION_TIMEZONES = {
    Philippines: "Asia/Manila",
    Indonesia: "Asia/Jakarta",
    China: "Asia/Shanghai",
    US: "America/New_York",
    Default: "UTC",
  };

  React.useEffect(() => {
    const timer = setInterval(() => {
      const tz =
        LOCATION_TIMEZONES[ticket.location] || LOCATION_TIMEZONES["Default"];
      try {
        const timeStr = new Date().toLocaleTimeString("en-US", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        setLocalTime(timeStr);
      } catch (e) {
        setLocalTime("N/A");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [ticket.location]);

  const handleKbSearch = async (e) => {
    if (e.key === "Enter") {
      if (!kbQuery.trim()) return;
      setSearchingKb(true);
      try {
        console.log("Searching KB for:", kbQuery);
        const res = await apiClient.get(
          `/kb/search?q=${encodeURIComponent(kbQuery)}`,
        );
        console.log("KB Search results:", res.data.data.results);
        setKbResults(res.data.data.results || []);
      } catch (err) {
        console.error("KB Search failed", err);
      } finally {
        setSearchingKb(false);
      }
    }
  };

  const openArticle = async (articleId) => {
    try {
      setSearchingKb(true);
      const res = await apiClient.get(`/kb/articles/${articleId}`);
      setSelectedArticle(res.data.data.article);
      setActiveModal("kb");
    } catch (err) {
      console.error("Failed to fetch article", err);
    } finally {
      setSearchingKb(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await apiClient.get("/users?role=it_agent");
      const agents = res.data.data.users;
      const resManagers = await apiClient.get("/users?role=it_manager");
      const managers = resManagers.data.data.users;
      setStaff(
        [...agents, ...managers].filter((s) => s.user_id !== user.user_id),
      );
    } catch (err) {
      console.error("Failed to fetch staff list", err);
    }
  };

  const handleAssignClick = () => {
    fetchStaff();
    setStaffSearchQuery("");
    setActiveModal("assign");
  };

  const handleAssignSubmit = async () => {
    if (!selectedStaff) return;
    await handleStatusChange(ticket.status, "Reassigned by management", {
      assigned_to: selectedStaff,
    });
  };

  const handleStatusChange = async (
    newStatus,
    reason = null,
    additionalData = {},
  ) => {
    let payload = { status: newStatus, ...additionalData };
    if (reason) payload.status_change_reason = reason;

    try {
      setLoading(true);
      const res = await apiClient.patch(
        `/tickets/${ticket.ticket_id}`,
        payload,
      );
      if (onUpdate) onUpdate(res.data.data.ticket);
      setActiveModal(null);
    } catch (err) {
      console.error("Failed to update status:", err);
      alert(
        "Failed to update status: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResolutionSubmit = (e) => {
    e.preventDefault();
    handleStatusChange(
      activeModal === "close" ? "Closed" : "Resolved",
      "Issue resolved via modal",
      {
        resolution_category: resolutionForm.category,
        root_cause: resolutionForm.root_cause,
        resolution_summary: resolutionForm.summary,
      },
    );
  };

  const handleOpenCloseModal = () => {
    if (ticket.status === "Resolved") {
      setResolutionForm({
        category: ticket.resolution_category || "Software",
        root_cause: ticket.root_cause || "",
        summary: ticket.resolution_summary || "",
      });
    }
    setActiveModal("close");
  };

  const canAttach = ["it_agent", "it_manager", "system_admin"].includes(
    user?.role,
  );
  const [attachFiles, setAttachFiles] = useState([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const handleAttachSubmit = async (e) => {
    e.preventDefault();
    if (!attachFiles.length) return;
    setAttachLoading(true);
    const formData = new FormData();
    Array.from(attachFiles).forEach((file) => formData.append("files", file));
    try {
      await apiClient.post(
        `/tickets/${ticket.ticket_id}/attachments`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      alert("Files attached successfully!");
      setAttachFiles([]);
      if (onUpdate) onUpdate();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to upload attachments");
    } finally {
      setAttachLoading(false);
    }
  };
  if (!ticket) return null;

  return (
    <div className="ticket-action-panel glass">
      {/* ...existing code... */}
      <style>{`
              .attach-container {
                background: rgba(30, 41, 59, 0.7);
                border-radius: 12px;
                padding: 1.5rem 1rem;
                margin-bottom: 2rem;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                display: flex;
                flex-direction: column;
                align-items: stretch;
              }
              .attach-header {
                display: flex;
                align-items: center;
                margin-bottom: 0.8rem;
              }
              .attach-icon {
                font-size: 1.5rem;
                margin-right: 0.5rem;
              }
              .attach-title {
                font-weight: 700;
                color: #fff;
                font-size: 1rem;
              }
              .attach-input {
                background: #1e293b;
                color: #fff;
                border: 1px solid #334155;
                border-radius: 8px;
                padding: 0.5rem;
                margin-bottom: 1rem;
              }
              .attach-btn {
                background: linear-gradient(90deg,#14b8a6,#3b82f6);
                color: #fff;
                border: none;
                border-radius: 8px;
                padding: 0.7rem 1.2rem;
                font-weight: 700;
                font-size: 1rem;
                cursor: pointer;
                transition: background 0.2s;
              }
              .attach-btn:disabled {
                background: #334155;
                cursor: not-allowed;
              }
            `}</style>
      {/* Modal: Resolve Ticket */}
      <GlassyModal
        isOpen={activeModal === "resolve"}
        onClose={() => setActiveModal(null)}
        title="RESOLVE TICKET"
        footer={
          <>
            <button
              className="modal-btn secondary"
              onClick={() => setActiveModal(null)}
            >
              CANCEL
            </button>
            <button
              className="modal-btn success"
              onClick={handleResolutionSubmit}
              disabled={
                loading || !resolutionForm.root_cause || !resolutionForm.summary
              }
            >
              {loading ? "RESOLVING..." : "CONFIRM RESOLUTION"}
            </button>
          </>
        }
      >
        <form className="modal-form" onSubmit={handleResolutionSubmit}>
          <div className="form-field">
            <label>RESOLUTION CATEGORY</label>
            <select
              value={resolutionForm.category}
              onChange={(e) =>
                setResolutionForm({
                  ...resolutionForm,
                  category: e.target.value,
                })
              }
            >
              <option>Software</option>
              <option>Hardware</option>
              <option>Network</option>
              <option>Access/Security</option>
              <option>General Inquiry</option>
            </select>
          </div>
          <div className="form-field">
            <label>ROOT CAUSE</label>
            <textarea
              placeholder="What caused this issue?"
              value={resolutionForm.root_cause}
              onChange={(e) =>
                setResolutionForm({
                  ...resolutionForm,
                  root_cause: e.target.value,
                })
              }
            />
          </div>
          <div className="form-field">
            <label>RESOLUTION SUMMARY</label>
            <textarea
              placeholder="How was it fixed?"
              value={resolutionForm.summary}
              onChange={(e) =>
                setResolutionForm({
                  ...resolutionForm,
                  summary: e.target.value,
                })
              }
            />
          </div>
        </form>
      </GlassyModal>

      {/* Modal: Close Ticket */}
      <GlassyModal
        isOpen={activeModal === "close"}
        onClose={() => setActiveModal(null)}
        title="CLOSE TICKET"
        footer={
          <>
            <button
              className="modal-btn secondary"
              onClick={() => setActiveModal(null)}
            >
              CANCEL
            </button>
            <button
              className="modal-btn neutral"
              onClick={handleResolutionSubmit}
              disabled={
                loading || !resolutionForm.root_cause || !resolutionForm.summary
              }
            >
              {loading ? "CLOSING..." : "CONFIRM CLOSURE"}
            </button>
          </>
        }
      >
        <div
          className="modal-info-box warning"
          style={{
            marginBottom: "1.5rem",
            padding: "12px",
            borderRadius: "8px",
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            fontSize: "0.9rem",
            color: "#f59e0b",
          }}
        >
          <strong>Note:</strong> Closing the ticket will archive it and finalize
          the resolution. Please verify the details below.
        </div>
        <form className="modal-form" onSubmit={handleResolutionSubmit}>
          <div className="form-field">
            <label>RESOLUTION CATEGORY</label>
            <select
              value={resolutionForm.category}
              onChange={(e) =>
                setResolutionForm({
                  ...resolutionForm,
                  category: e.target.value,
                })
              }
            >
              <option>Software</option>
              <option>Hardware</option>
              <option>Network</option>
              <option>Access/Security</option>
              <option>General Inquiry</option>
            </select>
          </div>
          <div className="form-field">
            <label>ROOT CAUSE</label>
            <textarea
              placeholder="What caused this issue?"
              value={resolutionForm.root_cause}
              onChange={(e) =>
                setResolutionForm({
                  ...resolutionForm,
                  root_cause: e.target.value,
                })
              }
            />
          </div>
          <div className="form-field">
            <label>RESOLUTION SUMMARY</label>
            <textarea
              placeholder="How was it fixed?"
              value={resolutionForm.summary}
              onChange={(e) =>
                setResolutionForm({
                  ...resolutionForm,
                  summary: e.target.value,
                })
              }
            />
          </div>
        </form>
      </GlassyModal>

      {/* Modal: KB Article */}
      <GlassyModal
        isOpen={activeModal === "kb" && selectedArticle}
        onClose={() => setActiveModal(null)}
        title={selectedArticle?.title?.toUpperCase()}
        maxWidth="800px"
      >
        <div className="kb-article-body">
          <div className="kb-meta">
            <span>Category: {selectedArticle?.category}</span>
            <span>Views: {selectedArticle?.views || 0}</span>
          </div>
          <div
            className="kb-content-html"
            dangerouslySetInnerHTML={{ __html: selectedArticle?.content }}
          />
        </div>
      </GlassyModal>

      {/* Modal: Take Ownership */}
      <GlassyModal
        isOpen={activeModal === "ownership"}
        onClose={() => setActiveModal(null)}
        title="TAKE OWNERSHIP"
        footer={
          <>
            <button
              className="modal-btn secondary"
              onClick={() => setActiveModal(null)}
            >
              CANCEL
            </button>
            <button
              className="modal-btn primary"
              onClick={() =>
                handleStatusChange("In Progress", "Agent took ownership")
              }
            >
              CONFIRM OWNERSHIP
            </button>
          </>
        }
      >
        <p>
          Are you sure you want to take ownership of this ticket? This will set
          the status to <strong>IN PROGRESS</strong> and assign it to you.
        </p>
      </GlassyModal>

      <GlassyModal
        isOpen={activeModal === "assign"}
        onClose={() => setActiveModal(null)}
        title="ASSIGN TICKET"
        footer={
          <>
            <button
              className="modal-btn secondary"
              onClick={() => setActiveModal(null)}
            >
              CANCEL
            </button>
            <button
              className="modal-btn primary"
              onClick={handleAssignSubmit}
              disabled={loading || !selectedStaff}
            >
              CONFIRM ASSIGNMENT
            </button>
          </>
        }
      >
        <div className="modal-form">
          <p
            style={{
              color: "#94a3b8",
              fontSize: "0.9rem",
              marginBottom: "1.5rem",
            }}
          >
            Select a staff member to assign this ticket to:
          </p>

          <div className="custom-searchable-dropdown">
            <div className="search-box-wrapper">
              <input
                type="text"
                className="dropdown-search-input"
                placeholder="Search by name or location..."
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
              />
              <svg
                className="search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>

            <div className="dropdown-options-container">
              {staff
                .filter((s) => {
                  const q = staffSearchQuery.toLowerCase();
                  return (
                    s.full_name.toLowerCase().includes(q) ||
                    s.location.toLowerCase().includes(q)
                  );
                })
                .map((member) => (
                  <div
                    key={member.user_id}
                    className={`member-option ${selectedStaff === member.user_id ? "active" : ""}`}
                    onClick={() => setSelectedStaff(member.user_id)}
                  >
                    <div className="member-avatar">
                      {member.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="member-details">
                      <span className="member-name">{member.full_name}</span>
                      <span className="member-meta">
                        {member.role.replace("_", " ").toUpperCase()} •{" "}
                        {member.location}
                      </span>
                    </div>
                    {selectedStaff === member.user_id && (
                      <svg
                        className="check-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                ))}
              {staff.filter((s) => {
                const q = staffSearchQuery.toLowerCase();
                return (
                  s.full_name.toLowerCase().includes(q) ||
                  s.location.toLowerCase().includes(q)
                );
              }).length === 0 && (
                <div className="no-options">No matching staff found</div>
              )}
            </div>
          </div>
        </div>
      </GlassyModal>

      {/* Role-based Staff Actions */}
      {["it_agent", "it_manager", "system_admin"].includes(user?.role) && (
        <>
          <div className="panel-header extra-top">
            <div className="local-time-badge">
              <span className="label">
                LOCAL TIME ({ticket.location?.toUpperCase() || "UTC"})
              </span>
              <span className="value">{localTime}</span>
            </div>
            <h3>SMART ACTIONS</h3>
          </div>

          <div className="action-group">
            <label>WORKFLOW</label>
            <div className="action-buttons-grid">
              {ticket.status === "New" && (
                <button
                  onClick={() => setActiveModal("ownership")}
                  disabled={loading}
                  className="btn-action primary"
                >
                  TAKE OWNERSHIP
                </button>
              )}
              {["In Progress", "Reopened"].includes(ticket.status) && (
                <button
                  onClick={() =>
                    handleStatusChange("Pending", "Waiting for user")
                  }
                  disabled={loading}
                  className="btn-action warning"
                >
                  MARK PENDING
                </button>
              )}
              {["New", "In Progress", "Pending", "Reopened"].includes(
                ticket.status,
              ) && (
                <button
                  onClick={() => setActiveModal("resolve")}
                  disabled={loading}
                  className="btn-action success"
                >
                  RESOLVE TICKET
                </button>
              )}
              {ticket.status === "Resolved" && (
                <button
                  onClick={handleOpenCloseModal}
                  disabled={loading}
                  className="btn-action neutral"
                >
                  CLOSE TICKET
                </button>
              )}
            </div>
          </div>

          <div className="action-group">
            <label>MANAGEMENT</label>
            <div className="action-buttons-grid">
              <button className="btn-action secondary" disabled>
                ESCALATE
              </button>
              <button
                className="btn-action secondary"
                onClick={handleAssignClick}
                disabled={loading}
              >
                {ticket.assigned_to ? "REASSIGN" : "ASSIGN TICKET"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Knowledge Base Integration */}
      <div className="kb-integration">
        <h3>KNOWLEDGE BASE</h3>
        <div className="kb-search-container">
          <div className="kb-search-box">
            <input
              type="text"
              placeholder="Search solutions..."
              value={kbQuery}
              onChange={(e) => setKbQuery(e.target.value)}
              onKeyDown={handleKbSearch}
            />
            <div className="search-hint">Enter to search</div>
          </div>

          <div className="kb-suggestions">
            {searchingKb && (
              <div className="kb-loader">Searching Knowledge Base...</div>
            )}
            {!searchingKb && kbResults.length === 0 && kbQuery && (
              <div className="empty-text">No matches found.</div>
            )}
            {!searchingKb && kbResults.length === 0 && !kbQuery && (
              <div className="empty-text">Search for articles or guides...</div>
            )}

            {kbResults.map((article) => (
              <div
                key={article.article_id}
                className="kb-result-item"
                onClick={() => openArticle(article.article_id)}
              >
                <a>{article.title}</a>
                <div className="meta">Click to view article</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .ticket-action-panel {
            padding: 2rem;
            display: flex;
            flex-direction: column;
            gap: 2.5rem;
            background: transparent;
        }

        .panel-header h3 {
            margin: 0;
            font-size: 0.7rem;
            font-weight: 900;
            color: #475569;
            letter-spacing: 0.15em;
        }

        .local-time-badge {
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.2);
            padding: 0.8rem 1rem;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            gap: 0.3rem;
            margin-bottom: 2rem;
            border-left: 3px solid #3b82f6;
        }
        .local-time-badge .label {
            font-size: 0.7rem;
            color: #3b82f6;
            font-weight: 900;
            letter-spacing: 0.08em;
        }
        .local-time-badge .value {
            font-size: 1.4rem;
            color: #f8fafc;
            font-weight: 800;
            font-variant-numeric: tabular-nums;
        }

        .panel-header.extra-top {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .action-group {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        .action-group label {
            font-size: 0.7rem;
            color: #64748b;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }

        .action-buttons-grid {
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
        }

        .btn-action {
            padding: 1.25rem;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.03);
            color: #cbd5e1;
            font-weight: 800;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            text-align: center;
            letter-spacing: 0.08em;
        }
        .btn-action:hover:not(:disabled) {
            transform: translateY(-2px);
            background: rgba(255,255,255,0.08);
            border-color: rgba(255,255,255,0.2);
            color: #f1f5f9;
        }
        .btn-action:disabled { opacity: 0.3; cursor: not-allowed; }

        .btn-action.primary { 
            background: linear-gradient(to bottom right, #3b82f6, #2563eb); 
            border: none; 
            color: white;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        .btn-action.primary:hover:not(:disabled) { 
            background: linear-gradient(to bottom right, #2563eb, #1d4ed8);
            box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
        }

        .btn-action.success { 
            background: rgba(16, 185, 129, 0.1); 
            color: #10b981; 
            border-color: rgba(16, 185, 129, 0.3); 
        }
        .btn-action.success:hover:not(:disabled) { 
            background: #10b981;
            color: white;
        }

        .btn-action.warning { 
            background: rgba(245, 158, 11, 0.1); 
            color: #f59e0b; 
            border-color: rgba(245, 158, 11, 0.3); 
        }
        .btn-action.warning:hover:not(:disabled) {
            background: #f59e0b;
            color: white;
        }

        .kb-integration {
            margin-top: auto;
            border-top: 1px solid rgba(255,255,255,0.05);
            padding-top: 2rem;
        }
        .kb-integration h3 {
            font-size: 0.7rem;
            color: #475569;
            margin: 0 0 1.2rem 0;
            font-weight: 900;
            letter-spacing: 0.15em;
        }
        
        .kb-search-box {
            position: relative;
        }
        .kb-search-box input {
            width: 100%;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.08);
            padding: 0.8rem 7.5rem 0.8rem 1rem;
            border-radius: 10px;
            color: #f8fafc;
            font-size: 0.95rem;
            transition: all 0.3s;
        }
        .kb-search-box input:focus {
            outline: none;
            border-color: rgba(59, 130, 246, 0.4);
            background: rgba(0,0,0,0.4);
        }
        .search-hint {
            position: absolute;
            right: 1rem;
            top: 50%;
            transform: translateY(-50%);
            font-size: 0.6rem;
            color: #475569;
            font-weight: 800;
            text-transform: uppercase;
            pointer-events: none;
        }

        .kb-suggestions {
            margin-top: 1.2rem;
            min-height: 120px;
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
        }
        .kb-loader { font-size: 0.75rem; color: #3b82f6; font-weight: 600; text-align: center; margin-top: 1rem; }
        .empty-text { font-size: 0.75rem; color: #475569; font-style: italic; text-align: center; margin-top: 1rem; }

        .kb-result-item {
            padding: 1rem;
            background: rgba(255,255,255,0.02);
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.05);
            transition: all 0.2s;
        }
        .kb-result-item:hover {
            background: rgba(255,255,255,0.04);
            border-color: rgba(255,255,255,0.1);
            transform: translateX(4px);
        }
        .kb-result-item a {
            color: #3b82f6;
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 700;
            display: block;
            margin-bottom: 0.3rem;
        }
        .kb-result-item .meta {
            font-size: 0.65rem;
            color: #475569;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        /* Modal Styles */
        .modal-form { display: flex; flex-direction: column; gap: 1.5rem; }
        .form-field { display: flex; flex-direction: column; gap: 0.5rem; }
        .form-field label { font-size: 0.7rem; font-weight: 900; color: #475569; letter-spacing: 0.05em; }
        .form-field select, .form-field textarea {
            background: rgba(0,0,0,0.2);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 0.8rem;
            color: white;
            font-family: inherit;
        }
        .form-field textarea { height: 100px; resize: none; }

        .modal-btn {
            padding: 1rem 1.5rem;
            border-radius: 12px;
            font-weight: 800;
            font-size: 0.85rem;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.1);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .modal-btn.primary { 
            background: linear-gradient(135deg, #3b82f6, #2563eb); 
            color: white; 
            border: none;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        .modal-btn.success { 
            background: linear-gradient(135deg, #10b981, #059669); 
            color: white; 
            border: none;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        .modal-btn.secondary { background: rgba(255,255,255,0.05); color: #94a3b8; }
        .modal-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); }
        .modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .kb-article-body { display: flex; flex-direction: column; gap: 1.5rem; }
        .kb-meta { display: flex; gap: 1.5rem; font-size: 0.7rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
        .kb-content-html { 
            color: #cbd5e1; 
            font-size: 1.05rem; 
            line-height: 1.8; 
            white-space: pre-line; /* Respect newlines in plain text */
        }
        .kb-content-html h1, .kb-content-html h2 { color: #f8fafc; margin: 2rem 0 1rem 0; font-weight: 800; letter-spacing: -0.02em; }
        .kb-content-html p { margin-bottom: 1.2rem; }
        .kb-content-html strong { color: #f8fafc; font-weight: 700; }

        /* Custom Searchable Dropdown */
        .custom-searchable-dropdown {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            max-height: 400px;
        }
        .search-box-wrapper {
            position: relative;
            margin-bottom: 0.5rem;
        }
        .dropdown-search-input {
            width: 100%;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 0.8rem 1rem 0.8rem 2.8rem;
            color: white;
            font-family: inherit;
            font-size: 0.9rem;
        }
        .dropdown-search-input:focus {
            outline: none;
            border-color: #3b82f6;
            background: rgba(0,0,0,0.4);
        }
        .search-icon {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            width: 18px;
            height: 18px;
            color: #475569;
        }
        .dropdown-options-container {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            max-height: 280px;
            overflow-y: auto;
            padding-right: 0.5rem;
        }
        .dropdown-options-container::-webkit-scrollbar {
            width: 6px;
        }
        .dropdown-options-container::-webkit-scrollbar-track {
            background: transparent;
        }
        .dropdown-options-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
        }
        .member-option {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.8rem;
            border-radius: 12px;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.05);
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .member-option:hover {
            background: rgba(255,255,255,0.08);
            border-color: rgba(255,255,255,0.2);
            transform: translateX(4px);
        }
        .member-option.active {
            background: rgba(59, 130, 246, 0.1);
            border-color: #3b82f6;
        }
        .member-avatar {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: rgba(59, 130, 246, 0.15);
            color: #3b82f6;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 0.75rem;
            flex-shrink: 0;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        }
        .member-details {
            display: flex;
            flex-direction: column;
            flex: 1;
        }
        .member-name {
            font-size: 0.9rem;
            font-weight: 700;
            color: #f1f5f9;
        }
        .member-meta {
            font-size: 0.7rem;
            color: #64748b;
            font-weight: 600;
            letter-spacing: 0.02em;
        }
        .check-icon {
            width: 18px;
            height: 18px;
            color: #3b82f6;
            flex-shrink: 0;
        }
        .no-options {
            text-align: center;
            padding: 2.5rem 1rem;
            color: #475569;
            font-style: italic;
            font-size: 0.85rem;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 12px;
            border: 1px dashed rgba(255, 255, 255, 0.05);
        }
        @media (max-width: 600px) {
            .ticket-action-panel {
                padding: 1rem;
                gap: 1.5rem;
            }
            .local-time-badge {
                margin-bottom: 1rem;
            }
            .kb-search-box input {
                padding-right: 1rem;
            }
            .search-hint {
                display: none;
            }
            .action-buttons-grid {
                flex-direction: column !important;
            }
        }
      `}</style>
    </div>
  );
};

export default TicketActionPanel;
