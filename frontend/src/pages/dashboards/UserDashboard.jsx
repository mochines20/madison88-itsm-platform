import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { onDashboardRefresh } from "../../api/socket";
import {
  FiActivity,
  FiSearch,
  FiPlusCircle,
  FiHelpCircle,
  FiBookOpen,
  FiPackage,
  FiCheckCircle,
  FiClock,
  FiArrowRight,
  FiX
} from "react-icons/fi";

const UserDashboard = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ open: 0, pending: 0, resolved: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [kbResults, setKbResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await apiClient.get("/tickets");
      const allTickets = res.data.data.tickets || [];
      setTickets(allTickets.slice(0, 5)); // Show recent 5 for the timeline

      setStats({
        open: allTickets.filter((t) => ["New", "In Progress"].includes(t.status)).length,
        pending: allTickets.filter((t) => t.status === "Pending").length,
        resolved: allTickets.filter((t) => ["Resolved", "Closed"].includes(t.status)).length,
      });
    } catch (err) {
      console.error("Failed to load user portal data", err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = onDashboardRefresh(loadData);
    return () => unsubscribe && unsubscribe();
  }, [loadData]);

  // Magic Search / KB Deflection
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true);
        try {
          const res = await apiClient.get(`/kb/search?q=${encodeURIComponent(searchQuery)}&limit=3`);
          setKbResults(res.data.data.results || []);
        } catch (err) {
          console.error("KB Search failed", err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setKbResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const getTimelineStep = (status) => {
    switch (status) {
      case 'New': return 0;
      case 'In Progress':
      case 'Pending': return 1;
      case 'Resolved': return 2;
      case 'Closed': return 3;
      default: return 0;
    }
  };

  const statusLabels = ["Submitted", "Processing", "Resolved", "Closed"];

  return (
    <div className="user-portal animate-fadeIn">
      {/* Hero Section with Magic Search */}
      <section className="hero-section glass">
        <div className="hero-content">
          <h1>How can we help today?</h1>
          <p>Search for solutions or track your active requests.</p>

          <div className="magic-search-container">
            <div className={`search-bar-wrapper ${searchQuery ? 'has-query' : ''}`}>
              <FiSearch className="search-icon" />
              <input
                type="text"
                placeholder="Type your problem (e.g., 'WiFi not working', 'Request new laptop')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-btn" onClick={() => setSearchQuery("")}>
                  <FiX />
                </button>
              )}
            </div>

            {/* KB Deflection Results */}
            {searchQuery.length > 2 && (
              <div className="deflection-results glass animate-slideUp">
                <div className="results-header">
                  <span>Suggested Solutions</span>
                  {isSearching && <div className="spinner-mini"></div>}
                </div>
                {kbResults.length > 0 ? (
                  kbResults.map(article => (
                    <div
                      key={article.article_id}
                      className="kb-item hover-lift"
                      onClick={() => navigate(`/knowledge-base?id=${article.article_id}`)}
                    >
                      <FiBookOpen className="icon-primary" />
                      <div className="kb-info">
                        <h4>{article.title}</h4>
                        <p>{article.summary || (article.content ? article.content.substring(0, 80) : '')}...</p>
                      </div>
                      <FiArrowRight className="arrow" />
                    </div>
                  ))
                ) : !isSearching && (
                  <div className="no-results">
                    No instant solutions found. You might need to create a ticket.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Quick Action Cards */}
      <div className="quick-actions-grid">
        <div className="action-card glass hover-lift" onClick={() => navigate('/new-ticket?type=incident')}>
          <div className="card-icon incident">
            <FiActivity />
          </div>
          <h3>I have a Problem</h3>
          <p>Report technical issues or system failures.</p>
          <span className="card-btn">Report Incident</span>
        </div>

        <div className="action-card glass hover-lift" onClick={() => navigate('/new-ticket?type=request')}>
          <div className="card-icon request">
            <FiPackage />
          </div>
          <h3>I need Something</h3>
          <p>Request new hardware, software, or access permissions.</p>
          <span className="card-btn">Request Service</span>
        </div>

        <div className="action-card glass hover-lift" onClick={() => navigate('/knowledge-base')}>
          <div className="card-icon search-kb">
            <FiHelpCircle />
          </div>
          <h3>Find a Solution</h3>
          <p>Browse our extensive Knowledge Base for self-help guides.</p>
          <span className="card-btn">Browse KB</span>
        </div>
      </div>

      {/* Tracking Section */}
      <div className="portal-main-grid">
        <section className="active-tickets glass">
          <div className="section-header">
            <h3>Recent Ticket Progress</h3>
            <button className="link-btn" onClick={() => navigate('/tickets')}>View All</button>
          </div>

          <div className="ticket-timeline-list">
            {tickets.length > 0 ? (
              tickets.map(ticket => {
                const currentStep = getTimelineStep(ticket.status);
                return (
                  <div key={ticket.ticket_id} className="timeline-item glass-nested">
                    <div className="timeline-info">
                      <div className="ticket-title-row">
                        <span className={`type-tag ${ticket.ticket_type}`}>
                          {ticket.ticket_type === 'incident' ? 'Incident' : 'Request'}
                        </span>
                        <h4>{ticket.title}</h4>
                        <span className="ticket-num">#{ticket.ticket_number}</span>
                      </div>
                      <p className="ticket-meta">Updated {new Date(ticket.updated_at).toLocaleDateString()}</p>
                    </div>

                    <div className="timeline-visual">
                      {statusLabels.map((label, index) => (
                        <div
                          key={label}
                          className={`step-point ${index <= Math.floor(currentStep) ? 'active' : ''} ${index === Math.floor(currentStep) ? 'current' : ''}`}
                        >
                          <div className="dot">
                            {index < Math.floor(currentStep) ? <FiCheckCircle /> : null}
                          </div>
                          <span className="label">{label}</span>
                        </div>
                      ))}
                      <div className="progress-bg">
                        <div
                          className="progress-bar"
                          style={{ width: `${(currentStep / 3) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <FiPackage className="muted" />
                <p>You have no active tickets at the moment.</p>
              </div>
            )}
          </div>
        </section>

        <section className="portal-sidebar">
          <div className="stat-summary glass">
            <h3>My Ticket Summary</h3>
            <div className="stat-row">
              <div className="stat-item">
                <label>Active</label>
                <strong>{stats.open}</strong>
              </div>
              <div className="stat-item">
                <label>Pending</label>
                <strong>{stats.pending}</strong>
              </div>
              <div className="stat-item">
                <label>Resolved</label>
                <strong>{stats.resolved}</strong>
              </div>
            </div>
          </div>

          <div className="help-box glass">
            <h3>Need more help?</h3>
            <p>Our support team is available 24/7 for critical issues.</p>
            <button className="btn-secondary" onClick={() => navigate('/new-ticket')}>Contact Support</button>
          </div>
        </section>
      </div>

      <style>{`
        .user-portal { padding: 2rem; max-width: 1400px; margin: 0 auto; }
        
        /* Hero & Search */
        .hero-section {
          padding: 4rem 2rem;
          text-align: center;
          margin-bottom: 2rem;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.05) 100%);
          border-radius: 24px;
        }
        .hero-section h1 { font-size: 2.5rem; font-weight: 800; margin-bottom: 0.5rem; background: linear-gradient(to right, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .hero-section p { color: #94a3b8; font-size: 1.1rem; margin-bottom: 2.5rem; }

        .magic-search-container { max-width: 700px; margin: 0 auto; position: relative; }
        .search-bar-wrapper {
          display: flex;
          align-items: center;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 0.5rem 1.5rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }
        .search-bar-wrapper:focus-within {
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15), 0 8px 30px rgba(0,0,0,0.3);
          transform: translateY(-2px);
          background: rgba(15, 23, 42, 0.8);
        }
        .search-icon { font-size: 1.4rem; color: #64748b; margin-right: 1rem; }
        .search-bar-wrapper input {
          flex: 1;
          background: transparent;
          border: none;
          color: #fff;
          font-size: 1.1rem;
          padding: 0.8rem 0;
          outline: none;
        }
        .clear-btn { background: none; border: none; color: #64748b; cursor: pointer; padding: 0.5rem; display: flex; align-items: center; border-radius: 50%; }
        .clear-btn:hover { background: rgba(255,255,255,0.05); color: #fff; }

        /* Deflection Results */
        .deflection-results {
          position: absolute;
          top: calc(100% + 12px);
          left: 0; right: 0;
          z-index: 100;
          padding: 1.5rem;
          text-align: left;
          background: rgba(30, 41, 59, 0.95);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }
        .results-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; color: #94a3b8; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .kb-item {
          display: flex;
          align-items: center;
          gap: 1.2rem;
          padding: 1rem;
          background: rgba(255,255,255,0.03);
          border-radius: 12px;
          margin-bottom: 0.8rem;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s;
        }
        .kb-item:hover { background: rgba(255,255,255,0.06); border-color: rgba(59, 130, 246, 0.3); }
        .kb-info h4 { margin: 0; font-size: 1rem; color: #fff; margin-bottom: 0.2rem; }
        .kb-info p { margin: 0; font-size: 0.85rem; color: #94a3b8; }
        .kb-item .arrow { color: #64748b; margin-left: auto; opacity: 0; transition: all 0.2s; }
        .kb-item:hover .arrow { opacity: 1; transform: translateX(4px); }
        .no-results { text-align: center; color: #94a3b8; padding: 1rem; font-style: italic; }

        /* Quick Actions */
        .quick-actions-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; margin-bottom: 3rem; }
        .action-card { padding: 2.5rem 2rem; text-align: center; cursor: pointer; }
        .card-icon { width: 60px; height: 60px; border-radius: 18px; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; }
        .card-icon.incident { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
        .card-icon.request { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
        .card-icon.search-kb { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .action-card h3 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.8rem; }
        .action-card p { color: #94a3b8; font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.6; }
        .card-btn { display: inline-block; padding: 0.6rem 1.2rem; background: rgba(255,255,255,0.05); border-radius: 10px; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; border: 1px solid rgba(255,255,255,0.1); }
        .action-card:hover .card-btn { background: #3b82f6; color: #fff; border-color: #3b82f6; }

        /* Portal Main Grid */
        .portal-main-grid { display: grid; grid-template-columns: 1fr 320px; gap: 2rem; }
        .active-tickets { padding: 2rem; }
        .link-btn { background: none; border: none; color: #3b82f6; font-weight: 600; cursor: pointer; font-size: 0.9rem; }
        
        /* Timeline Styles */
        .ticket-timeline-list { display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1.5rem; }
        .timeline-item { padding: 1.5rem; }
        .ticket-title-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
        .type-tag { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; padding: 0.2rem 0.6rem; border-radius: 6px; }
        .type-tag.incident { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
        .type-tag.request { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); }
        .timeline-item h4 { margin: 0; font-size: 1.1rem; flex: 1; }
        .ticket-num { color: #64748b; font-weight: 700; font-family: monospace; font-size: 0.9rem; }
        .ticket-meta { color: #64748b; font-size: 0.8rem; margin: 0 0 1.5rem 0; }

        .timeline-visual { display: flex; justify-content: space-between; position: relative; padding: 0 10px; }
        .progress-bg { position: absolute; top: 10px; left: 0; right: 0; height: 4px; background: rgba(255,255,255,0.05); z-index: 1; border-radius: 2px; }
        .progress-bar { height: 100%; background: #3b82f6; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 2px; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5); }
        
        .step-point { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; }
        .step-point .dot { 
          width: 24px; height: 24px; border-radius: 50%; 
          background: #1e293b; border: 2px solid rgba(255,255,255,0.1); 
          display: flex; align-items: center; justify-content: center; font-size: 0.8rem;
          transition: all 0.3s;
        }
        .step-point.active .dot { background: #3b82f6; border-color: #3b82f6; color: #fff; }
        .step-point.current .dot { transform: scale(1.2); box-shadow: 0 0 15px rgba(59, 130, 246, 0.5); border-color: #fff; }
        .step-point .label { font-size: 0.75rem; color: #64748b; margin-top: 0.6rem; font-weight: 600; }
        .step-point.active .label { color: #e2e8f0; }

        /* Sidebar Sections */
        .portal-sidebar { display: flex; flex-direction: column; gap: 2rem; }
        .stat-summary { padding: 1.5rem; }
        .stat-row { display: flex; justify-content: space-between; margin-top: 1.2rem; }
        .stat-item { text-align: center; flex: 1; }
        .stat-item label { display: block; font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 0.4rem; }
        .stat-item strong { display: block; font-size: 1.5rem; color: #fff; }
        
        .help-box { padding: 1.5rem; border-color: rgba(59, 130, 246, 0.2) !important; }
        .help-box h3 { margin-top: 0; }
        .help-box p { font-size: 0.9rem; color: #94a3b8; line-height: 1.5; margin-bottom: 1.5rem; }
        .btn-secondary { width: 100%; padding: 0.8rem; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: #3b82f6; font-weight: 700; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
        .btn-secondary:hover { background: #3b82f6; color: #fff; transform: translateY(-2px); }

        .spinner-mini { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1024px) {
          .user-portal { padding: 1rem; }
          .quick-actions-grid { grid-template-columns: repeat(2, 1fr); gap: 1rem; }
          .portal-main-grid { grid-template-columns: 1fr; }
          .hero-section { padding: 3rem 1.5rem; }
          .hero-section h1 { font-size: 2rem; }
        }

        @media (max-width: 768px) {
          .quick-actions-grid { grid-template-columns: 1fr; }
          .hero-section h1 { font-size: 1.5rem; }
          .step-point .label { font-size: 0.65rem; }
          .timeline-visual { padding: 0; }
        }
      `}</style>
    </div>
  );
};

export default UserDashboard;
