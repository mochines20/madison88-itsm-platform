import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import apiClient from "../api/client";
import { onDashboardRefresh } from "../api/socket";

const statusColor = {
  New: "badge-new",
  "In Progress": "badge-progress",
  Pending: "badge-pending",
  Resolved: "badge-resolved",
  Closed: "badge-closed",
  Reopened: "badge-reopened",
};

const priorityColor = {
  P1: "badge-p1",
  P2: "badge-p2",
  P3: "badge-p3",
  P4: "badge-p4",
};

const statusOptions = [
  "",
  "New",
  "In Progress",
  "Pending",
  "Resolved",
  "Closed",
  "Reopened",
];
const priorityOptions = ["", "P1", "P2", "P3", "P4"];
const categoryOptions = [
  "",
  "Hardware",
  "Software",
  "Access Request",
  "Account Creation",
  "Network",
  "Other",
];
const locationOptions = ["", "Philippines", "US", "Indonesia", "Other"];

const PAGE_SIZE = 5;

const TicketsPage = ({
  onSelectTicket,
  refreshKey,
  selectedId,
  user,
  viewMode,
  onViewModeChange,
  onResolvedTickets,
}) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [agents, setAgents] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkRefresh, setBulkRefresh] = useState(0);
  const [socketRefreshKey, setSocketRefreshKey] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [pollKey, setPollKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0 });
  const previousStatusRef = useRef(new Map());
  const location = useLocation();

  // Debounce search inputs — only fire API after 400ms of inactivity
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => setTagQuery(tagInput), 400);
    return () => clearTimeout(timer);
  }, [tagInput]);

  // Parse filters from URL on mount (for Drill-down Dashboard)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get("status");
    const priority = params.get("priority");
    const category = params.get("category");
    const assignment = params.get("assignment");

    if (status) setStatusFilter(status);
    if (priority) setPriorityFilter(priority);
    if (category) setCategoryFilter(category);
    if (assignment) setAssignmentFilter(assignment);
  }, [location.search]);

  useEffect(() => {
    const unsubscribe = onDashboardRefresh(() => setSocketRefreshKey((k) => k + 1));
    return unsubscribe;
  }, []);

  const isManager = user?.role === "it_manager";
  const isAdmin = user?.role === "system_admin";
  const canBulkAssign = isManager || isAdmin;
  const isTeamUrgentView = (isManager || isAdmin) && viewMode === "team";

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      setError("");
      try {
        const params = {};
        if (user?.role === "end_user") {
          // backend limits to own tickets
        } else if (viewMode === "team") {
          // manager/admin global view
        } else if (assignmentFilter !== "unassigned") {
          params.assigned_to = user.user_id;
        }
        if (assignmentFilter === "unassigned") params.unassigned = true;
        if (includeArchived) params.include_archived = true;
        if (searchQuery.trim()) params.q = searchQuery.trim();
        if (tagQuery.trim()) params.tags = tagQuery.trim();
        // Only send filters that have non-empty values
        if (statusFilter && statusFilter.trim()) params.status = statusFilter.trim();
        if (priorityFilter && priorityFilter.trim()) params.priority = priorityFilter.trim();
        if (categoryFilter && categoryFilter.trim()) params.category = categoryFilter.trim();
        if (locationFilter && locationFilter.trim()) params.location = locationFilter.trim();
        if (dateFrom && dateFrom.trim()) params.date_from = dateFrom.trim();
        if (dateTo && dateTo.trim()) params.date_to = dateTo.trim();
        params.page = page;
        params.limit = PAGE_SIZE;
        const res = await apiClient.get("/tickets", { params });
        const nextTickets = res.data.data.tickets || [];
        const pag = res.data.data.pagination || { page: 1, limit: PAGE_SIZE, total: 0 };
        setPagination(pag);
        if (onResolvedTickets) {
          const resolvedUpdates = [];
          nextTickets.forEach((ticket) => {
            const prevStatus = previousStatusRef.current.get(ticket.ticket_id);
            if (
              prevStatus &&
              prevStatus !== ticket.status &&
              ["Resolved", "Closed"].includes(ticket.status)
            ) {
              resolvedUpdates.push(ticket);
            }
          });
          if (resolvedUpdates.length > 0) {
            onResolvedTickets(resolvedUpdates);
          }
        }
        const nextStatusMap = new Map();
        nextTickets.forEach((ticket) => {
          nextStatusMap.set(ticket.ticket_id, ticket.status);
        });
        previousStatusRef.current = nextStatusMap;
        setTickets(nextTickets);
        if (nextTickets.length === 0 && page > 1 && pag.total > 0) setPage(1);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load tickets");
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [
    refreshKey,
    viewMode,
    user?.role,
    user?.user_id,
    assignmentFilter,
    includeArchived,
    searchQuery,
    tagQuery,
    statusFilter,
    priorityFilter,
    categoryFilter,
    locationFilter,
    dateFrom,
    dateTo,
    bulkRefresh,
    pollKey,
    socketRefreshKey,
    page,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;
      setPollKey((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!canBulkAssign) return;
    const fetchAssignableUsers = async () => {
      try {
        // For system admin: fetch both IT agents and IT managers
        // For IT manager: fetch only IT agents (their team members are filtered by backend)
        if (isAdmin) {
          const [agentsRes, managersRes] = await Promise.all([
            apiClient.get("/users?role=it_agent"),
            apiClient.get("/users?role=it_manager"),
          ]);
          const agents = agentsRes.data.data.users || [];
          const managers = managersRes.data.data.users || [];
          setAgents([...agents, ...managers]);
        } else {
          // IT Manager: only show IT agents (backend will validate team membership)
          const res = await apiClient.get("/users?role=it_agent");
          setAgents(res.data.data.users || []);
        }
      } catch (err) {
        setAgents([]);
      }
    };
    fetchAssignableUsers();
  }, [canBulkAssign, isAdmin]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatSlaCountdown = (ticket) => {
    // Don't show countdown for Resolved/Closed tickets
    if (['Resolved', 'Closed'].includes(ticket?.status)) return null;
    if (!ticket?.sla_due_date) return null;
    const dueTime = new Date(ticket.sla_due_date).getTime();
    if (Number.isNaN(dueTime)) return null;
    const minutesLeft = Math.ceil((dueTime - now) / 60000);
    const breached = minutesLeft < 0;
    const absoluteMinutes = Math.abs(minutesLeft);
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = absoluteMinutes % 60;
    const timeLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    if (breached) {
      return {
        label: `SLA Breached ${timeLabel}`,
        className: "badge-sla-breached",
      };
    }
    if (minutesLeft <= 60) {
      return { label: `SLA ${timeLabel}`, className: "badge-sla-warning" };
    }
    return { label: `SLA ${timeLabel}`, className: "badge-sla" };
  };

  const getUrgencyScore = (ticket) => {
    // Don't calculate urgency for Resolved/Closed tickets
    if (['Resolved', 'Closed'].includes(ticket?.status)) return Number.MAX_SAFE_INTEGER;
    const remaining = ticket?.sla_status?.resolution_remaining_minutes;
    if (typeof remaining === "number") return remaining;
    if (ticket?.sla_due_date) {
      const due = new Date(ticket.sla_due_date).getTime();
      if (!Number.isNaN(due)) return Math.ceil((due - now) / 60000);
    }
    return Number.MAX_SAFE_INTEGER;
  };

  const displayedTickets = tickets;
  const total = pagination.total || 0;
  const hasNext = total > page * PAGE_SIZE;
  const hasPrev = page > 1;

  useEffect(() => {
    setSelectedTickets((prev) =>
      prev.filter((ticketId) => tickets.some((ticket) => ticket.ticket_id === ticketId))
    );
  }, [tickets]);

  const toggleTicketSelection = (ticketId) => {
    setSelectedTickets((prev) =>
      prev.includes(ticketId)
        ? prev.filter((id) => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignee || selectedTickets.length === 0) return;
    setBulkLoading(true);
    setError("");
    try {
      await apiClient.post("/tickets/bulk-assign", {
        ticket_ids: selectedTickets,
        assigned_to: bulkAssignee,
      });
      setSelectedTickets([]);
      setBulkAssignee("");
      setBulkRefresh((prev) => prev + 1);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to bulk assign tickets");
    } finally {
      setBulkLoading(false);
    }
  };

  // Note: We no longer return early for loading/error states.
  // The filter bar must stay visible so users can type in search without losing focus.

  return (
    <div className={`panel ${isTeamUrgentView ? "team-queue-panel" : ""}`}>
      <div className="panel-header">
        <div>
          <h2>
            {user?.role === "end_user"
              ? "My Tickets"
              : viewMode === "team"
                ? "Team Queue"
                : "Assigned Tickets"}
          </h2>
          <p>Track open requests and recent updates.</p>
        </div>
        {(isManager || isAdmin) && onViewModeChange && (
          <div className="filter-bar">
            <button
              className={
                viewMode === "my" ? "filter-pill active" : "filter-pill"
              }
              onClick={() => { setPage(1); onViewModeChange("my"); }}
            >
              My Tickets
            </button>
            <button
              className={
                viewMode === "team" ? "filter-pill active" : "filter-pill"
              }
              onClick={() => { setPage(1); onViewModeChange("team"); }}
            >
              Team Queue
            </button>
          </div>
        )}
      </div>
      <div className="filter-bar ticket-filters">
        <input
          value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
          placeholder="Search title, description, ticket number"
        />
        <input
          value={tagInput}
          onChange={(e) => { setTagInput(e.target.value); setPage(1); }}
          placeholder="Tags (comma-separated)"
        />
        {(isManager || isAdmin) && (
          <select
            value={assignmentFilter}
            onChange={(e) => { setAssignmentFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All assignments</option>
            <option value="unassigned">Unassigned only</option>
          </select>
        )}
        {(isManager || isAdmin) && (
          <label className="archive-toggle">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => { setIncludeArchived(e.target.checked); setPage(1); }}
            />
            <span>Show archived</span>
          </label>
        )}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {statusOptions.map((option) => (
            <option key={option || "all"} value={option}>
              {option || "All Statuses"}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
        >
          {priorityOptions.map((option) => (
            <option key={option || "all"} value={option}>
              {option || "All Priorities"}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
        >
          {categoryOptions.map((option) => (
            <option key={option || "all"} value={option}>
              {option || "All Categories"}
            </option>
          ))}
        </select>
        {(isManager || isAdmin) && (
          <select
            value={locationFilter}
            onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }}
          >
            {locationOptions.map((option) => (
              <option key={option || "all"} value={option}>
                {option || "All Locations"}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          title="Created from"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          title="Created to"
        />
      </div>
      <div className="pagination-info">
        Showing {displayedTickets.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + displayedTickets.length} of {total} tickets (order: Escalated → SLA Breached → P1 → P2 → P3 → P4 → Newest).
      </div>
      {canBulkAssign && (
        <div className="bulk-assign-bar">
          <span>{selectedTickets.length} selected</span>
          <select
            value={bulkAssignee}
            onChange={(e) => setBulkAssignee(e.target.value)}
          >
            <option value="">Assign to agent...</option>
            {agents.map((agent) => (
              <option key={agent.user_id} value={agent.user_id}>
                {agent.full_name} {isAdmin && `(${agent.role})`}
              </option>
            ))}
          </select>
          <button
            className="btn primary"
            disabled={!bulkAssignee || selectedTickets.length === 0 || bulkLoading}
            onClick={handleBulkAssign}
          >
            {bulkLoading ? "Assigning..." : "Assign selected"}
          </button>
          <button
            className="btn ghost small"
            disabled={selectedTickets.length === 0}
            onClick={() => setSelectedTickets([])}
          >
            Clear
          </button>
        </div>
      )}
      <div className="ticket-list">
        {loading && (
          <div className="empty-state">Loading tickets...</div>
        )}
        {!loading && error && (
          <div className="empty-state" style={{ color: 'var(--color-error, #ff6b6b)' }}>{error}</div>
        )}
        {!loading && !error && displayedTickets.length === 0 && (
          <div className="empty-state">
            No tickets yet. Create your first request.
          </div>
        )}
        {!loading && !error && displayedTickets.map((ticket) => (
          <button
            key={ticket.ticket_id}
            className={`ticket-card cascade-item hover-lift ${selectedId === ticket.ticket_id ? "active" : ""
              }`}
            onClick={() => onSelectTicket(ticket.ticket_id)}
          >
            {canBulkAssign && (
              <div
                className="ticket-select"
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedTickets.includes(ticket.ticket_id)}
                  onChange={() => toggleTicketSelection(ticket.ticket_id)}
                />
              </div>
            )}
            <div>
              <div className="ticket-title">{ticket.title}</div>
              <div className="ticket-meta">
                <span>{ticket.ticket_number}</span>
                <span>•</span>
                <span>{ticket.category}</span>
                {ticket.tags && (
                  <>
                    <span>•</span>
                    <span>{ticket.tags}</span>
                  </>
                )}
                <span>•</span>
                <span>{new Date(ticket.created_at).toLocaleString()}</span>
                <span>•</span>
                <span>
                  SLA Due:{" "}
                  {ticket.sla_due_date
                    ? new Date(ticket.sla_due_date).toLocaleString()
                    : "N/A"}
                </span>
              </div>
            </div>
            <div className="ticket-badges">
              <span className={`badge ${priorityColor[ticket.priority] || ""}`}>
                {ticket.priority}
              </span>
              <span className={`badge ${statusColor[ticket.status] || ""}`}>
                {ticket.status}
              </span>
              {ticket.sla_status?.escalated && (
                <span className="badge badge-sla-escalated">Escalated</span>
              )}
              {(() => {
                const sla = formatSlaCountdown(ticket);
                return sla ? (
                  <span className={`badge ${sla.className}`}>{sla.label}</span>
                ) : null;
              })()}
            </div>
          </button>
        ))}
      </div>
      <div className="pagination-controls" role="navigation" aria-label="Ticket list pagination">
        <button
          type="button"
          className="btn ghost"
          disabled={!hasPrev || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          aria-label="Previous 5 tickets"
        >
          ← Previous 5
        </button>
        <span className="pagination-page" aria-live="polite">
          Page {page}{total > 0 ? ` of ${Math.ceil(total / PAGE_SIZE)}` : ""}
        </span>
        <button
          type="button"
          className="btn primary btn-press"
          disabled={!hasNext || loading}
          onClick={() => setPage((p) => p + 1)}
          aria-label="Next 5 tickets"
        >
          Next 5 →
        </button>
      </div>
    </div>
  );
};

export default TicketsPage;
