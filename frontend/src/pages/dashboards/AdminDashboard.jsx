import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { onDashboardRefresh } from "../../api/socket";
import ExecutiveDashboard from "./ExecutiveDashboard";

const AdminDashboard = () => {
  const [viewMode, setViewMode] = useState(localStorage.getItem('adminViewMode') || 'detailed');
  const [users, setUsers] = useState(0);
  const [statusSummary, setStatusSummary] = useState({
    open: 0,
    in_progress: 0,
    pending: 0,
    resolved: 0,
    closed: 0,
  });
  const [slaSummary, setSlaSummary] = useState({
    total_breached: 0,
    critical_breached: 0,
  });
  const [agentStatusMatrix, setAgentStatusMatrix] = useState([]);
  const [ticketsByLocation, setTicketsByLocation] = useState([]);
  const [ticketsByPriority, setTicketsByPriority] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const toggleViewMode = () => {
    const newMode = viewMode === 'detailed' ? 'simple' : 'detailed';
    setViewMode(newMode);
    localStorage.setItem('adminViewMode', newMode);
  };

  const handleDrillDown = (params) => {
    const searchParams = new URLSearchParams(params);
    navigate(`/tickets?${searchParams.toString()}`);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, statusRes, slaRes, reportingRes, volumeRes] = await Promise.all([
        apiClient.get("/users"),
        apiClient.get("/dashboard/status-summary"),
        apiClient.get("/dashboard/sla-summary"),
        apiClient.get("/dashboard/advanced-reporting"),
        apiClient.get("/dashboard/ticket-volume"),
      ]);
      setUsers(usersRes.data.data.users?.length || 0);
      setStatusSummary(statusRes.data.data.summary || {});
      setSlaSummary(slaRes.data.data.summary || {});
      setAgentStatusMatrix(
        reportingRes.data.data.agent_status_matrix || [],
      );
      setTicketsByLocation(
        volumeRes.data.data.ticket_volume?.by_location || [],
      );

      // Normalize priority data to ensure P1-P4 are always present
      const priorityRaw = volumeRes.data.data.ticket_volume?.by_priority || [];
      const priorityMap = priorityRaw.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {});

      const normalizedPriority = ['P1', 'P2', 'P3', 'P4'].map(p => ({
        key: p,
        value: priorityMap[p] || 0
      }));
      setTicketsByPriority(normalizedPriority);

    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = onDashboardRefresh(() => load());
    return unsubscribe;
  }, [load]);

  if (viewMode === 'simple') {
    return <ExecutiveDashboard loadDetailView={() => setViewMode('detailed')} />;
  }

  const totalTickets =
    (statusSummary.open || 0) +
    (statusSummary.in_progress || 0) +
    (statusSummary.pending || 0) +
    (statusSummary.resolved || 0) +
    (statusSummary.closed || 0);
  const activeTickets =
    (statusSummary.open || 0) +
    (statusSummary.in_progress || 0) +
    (statusSummary.pending || 0);
  const resolvedTotal =
    (statusSummary.resolved || 0) + (statusSummary.closed || 0);
  const formatPercent = (value, total) =>
    total > 0 ? `${Math.round((value / total) * 100)}%` : "0%";
  const activePercent = formatPercent(activeTickets, totalTickets);
  const resolvedPercent = formatPercent(resolvedTotal, totalTickets);
  const breachPercent = formatPercent(slaSummary.total_breached || 0, totalTickets);

  const statusCards = [
    { label: "Open", value: statusSummary.open || 0 },
    { label: "In Progress", value: statusSummary.in_progress || 0 },
    { label: "Pending", value: statusSummary.pending || 0 },
    { label: "Resolved", value: statusSummary.resolved || 0 },
    { label: "Closed", value: statusSummary.closed || 0 },
  ];
  const statusKeys = [
    { key: "new_count", label: "New", color: "47, 215, 255" },
    { key: "in_progress_count", label: "In Progress", color: "43, 107, 255" },
    { key: "pending_count", label: "Pending", color: "255, 181, 71" },
    { key: "resolved_count", label: "Resolved", color: "55, 217, 150" },
    { key: "closed_count", label: "Closed", color: "139, 151, 186" },
    { key: "reopened_count", label: "Reopened", color: "255, 93, 108" },
  ];
  const maxHeatCount = agentStatusMatrix.reduce((max, row) => {
    const rowMax = statusKeys.reduce((innerMax, status) => {
      const value = row[status.key] || 0;
      return value > innerMax ? value : innerMax;
    }, 0);
    return rowMax > max ? rowMax : max;
  }, 0);

  return (
    <div className="admin-dashboard animate-fadeIn">
      <div className="view-mode-toggle-container" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn-press hover-lift"
          onClick={toggleViewMode}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '0.6rem 1.2rem',
            borderRadius: '10px',
            color: '#94a3b8',
            fontSize: '0.85rem',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Switch to Executive View
        </button>
      </div>

      {error && <div className="panel error">{error}</div>}

      <section className="panel admin-hero">
        <div className="admin-hero-main">
          <span className="admin-label">Admin Overview</span>
          <h3>Service Desk Health</h3>
          <p className="admin-subtext">
            Monitor workload, resolution pace, and SLA exposure in real time.
          </p>
          <div className="admin-hero-metrics">
            <div className="admin-kpi hover-lift">
              <span>Total Users</span>
              {loading ? <div className="skeleton-shimmer" style={{ height: '32px', width: '60px', marginTop: '4px' }} /> : <strong>{users}</strong>}
            </div>
            <div className="admin-kpi hover-lift">
              <span>Total Tickets</span>
              {loading ? <div className="skeleton-shimmer" style={{ height: '32px', width: '60px', marginTop: '4px' }} /> : <strong>{totalTickets}</strong>}
            </div>
            <div className="admin-kpi hover-lift">
              <span>Active Work</span>
              {loading ? <div className="skeleton-shimmer" style={{ height: '32px', width: '60px', marginTop: '4px' }} /> : <strong>{activeTickets}</strong>}
              {loading ? <div className="skeleton-shimmer" style={{ height: '14px', width: '80px', marginTop: '4px' }} /> : <em>{activePercent} of total</em>}
            </div>
          </div>
        </div>
        <div className="admin-hero-side">
          <div className="admin-alert">
            <span>SLA Watch</span>
            <strong>{slaSummary.critical_breached || 0}</strong>
            <em>critical breaches</em>
            <div className="admin-progress">
              <div className="admin-progress-bar">
                <div
                  className={`admin-progress-fill danger ${!loading ? 'sla-progress-animated' : ''}`}
                  style={{ width: loading ? '0%' : breachPercent }}
                />
              </div>
              {loading ? <div className="skeleton-shimmer" style={{ height: '14px', width: '100px', marginTop: '4px' }} /> : <span>{breachPercent} breached</span>}
            </div>
          </div>
          <div className="admin-alert muted">
            <span>Resolution Pace</span>
            <strong>{resolvedTotal}</strong>
            <em>{resolvedPercent} resolved</em>
            <div className="admin-progress">
              <div className="admin-progress-bar">
                <div
                  className="admin-progress-fill success"
                  style={{ width: resolvedPercent }}
                />
              </div>
              <span>{resolvedPercent} closed</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-grid">
        {statusCards.map((card) => (
          <div
            key={card.label}
            className="panel admin-status-card hover-lift cascade-item"
            style={{ cursor: 'pointer' }}
            onClick={() => handleDrillDown({ status: card.label })}
          >
            <span className="status-pill">{card.label}</span>
            {loading ? <div className="skeleton-shimmer" style={{ height: '32px', width: '80px', marginTop: '8px' }} /> : <strong>{card.value}</strong>}
            {loading ? <div className="skeleton-shimmer" style={{ height: '14px', width: '100px', marginTop: '4px' }} /> : <em>{formatPercent(card.value, totalTickets)} of total</em>}
          </div>
        ))}
        <div className="panel admin-status-card emphasis">
          <span className="status-pill">Total SLA Breached</span>
          <strong>{slaSummary.total_breached || 0}</strong>
          <em>{breachPercent} of total</em>
        </div>
      </section>

      <section className="panel">
        <h3>Tickets by Priority</h3>
        <p className="muted">Total ticket distribution across priority levels.</p>
        <div className="location-cards">
          {ticketsByPriority.map((item) => (
            <div
              key={item.key}
              className={`location-card hover-lift priority-${item.key.toLowerCase()}`}
              style={{ cursor: 'pointer', borderLeft: `3px solid var(--p-${item.key.toLowerCase()}-color, #3b82f6)` }}
              onClick={() => handleDrillDown({ priority: item.key })}
            >
              <span className="location-label">
                {item.key} TICKETS
              </span>
              {loading ? <div className="skeleton-shimmer" style={{ height: '24px', width: '40px', marginTop: '4px' }} /> : <strong>{item.value}</strong>}
              {loading ? <div className="skeleton-shimmer" style={{ height: '12px', width: '60px', marginTop: '2px' }} /> : <em>{formatPercent(item.value, totalTickets)}</em>}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Tickets by Location</h3>
        <p className="muted">Number of tickets submitted per location.</p>
        {ticketsByLocation.length === 0 ? (
          <div className="empty-state">No location data.</div>
        ) : (
          <div className="location-cards">
            {ticketsByLocation.map((item) => (
              <div
                key={item.key || "unknown"}
                className="location-card hover-lift"
                style={{ cursor: 'pointer' }}
                onClick={() => handleDrillDown({ location: item.key })}
              >
                <span className="location-label">
                  {item.key || "Unknown"}
                </span>
                <strong>{item.value}</strong>
                <em>tickets</em>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Agent Status Heatmap</h3>
        {agentStatusMatrix.length === 0 ? (
          <div className="empty-state">No status data.</div>
        ) : (
          <div className="heatmap">
            <div className="heatmap-row header">
              <span>Agent</span>
              {statusKeys.map((status) => (
                <span key={status.key}>{status.label}</span>
              ))}
            </div>
            {agentStatusMatrix.map((row) => (
              <div key={row.user_id} className="heatmap-row">
                <span className="heatmap-agent">
                  {row.full_name || "Agent"}
                </span>
                {statusKeys.map((status) => {
                  const value = row[status.key] || 0;
                  const intensity = maxHeatCount
                    ? Math.max(0.12, (value / maxHeatCount) * 0.7)
                    : 0.12;
                  return (
                    <span
                      key={status.key}
                      className="heatmap-cell"
                      style={{
                        background: `rgba(${status.color}, ${intensity})`,
                      }}
                    >
                      {value}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminDashboard;
