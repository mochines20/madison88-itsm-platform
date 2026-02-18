import React, { useEffect, useState } from "react";
import apiClient from "../api/client";
import { hasMaxLength, hasMinLength, isBlank } from "../utils/validation";

const statusOptions = [
  "New",
  "In Progress",
  "Pending",
  "Resolved",
  "Closed",
  "Reopened",
];

const priorityOptions = ["P1", "P2", "P3", "P4"];

const TicketDetailPage = ({
  ticketId,
  user,
  onClose,
  onUpdated,
  onResolved,
}) => {
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [assets, setAssets] = useState([]);
  const [myAssets, setMyAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [audit, setAudit] = useState([]);
  const [error, setError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priorityOverrideReason, setPriorityOverrideReason] = useState("");
  const [priorityRequestPriority, setPriorityRequestPriority] = useState("P3");
  const [priorityRequestReason, setPriorityRequestReason] = useState("");
  const [priorityRequests, setPriorityRequests] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [resolutionCategory, setResolutionCategory] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [statusChangeReason, setStatusChangeReason] = useState("");
  const [escalations, setEscalations] = useState([]);
  const [escalationReason, setEscalationReason] = useState("");
  const [escalationSeverity, setEscalationSeverity] = useState("medium");
  const [escalationNotice, setEscalationNotice] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState([]);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImpact, setEditImpact] = useState("");
  const [resolutionPhoto, setResolutionPhoto] = useState(null);
  const [reopenReason, setReopenReason] = useState("");
  const [manuallyConfirmed, setManuallyConfirmed] = useState(false);

  const isEndUser = user?.role === "end_user";
  const isManager = user?.role === "it_manager";
  const isAdmin = user?.role === "system_admin";
  const canSeeAudit = isAdmin;
  const canAddInternal = ["it_agent", "it_manager", "system_admin"].includes(
    user?.role,
  );
  const canAttachResolutionPhoto = canAddInternal;
  const canAssign = isManager || isAdmin;
  const canOverridePriority = isAdmin;
  const canRequestPriorityOverride = isManager;
  const isAssignedToUser = ticket?.assigned_to && ticket.assigned_to === user?.user_id;
  const canComment = isEndUser ? ticket?.user_id === user?.user_id : isAssignedToUser;
  const canEscalate = !!isAssignedToUser;

  useEffect(() => {
    if (!ticketId) return;
    setManuallyConfirmed(false);
    const fetchDetails = async () => {
      setLoading(true);
      setError("");
      setNotice("");
      try {
        const ticketRes = await apiClient.get(`/tickets/${ticketId}`);
        const auditRes = canSeeAudit
          ? await apiClient.get(`/tickets/${ticketId}/audit-log`)
          : { data: { data: { audit_logs: [] } } };
        const historyRes = await apiClient.get(
          `/tickets/${ticketId}/status-history`,
        );
        const escalationRes = await apiClient.get(
          `/tickets/${ticketId}/escalations`,
        );
        let overrideRequests = [];
        if (isAdmin || isManager) {
          try {
            const overrideRes = await apiClient.get(
              `/tickets/${ticketId}/priority-override-requests`,
            );
            overrideRequests = overrideRes.data.data.requests || [];
          } catch (err) {
            if (err.response?.status !== 404) {
              throw err;
            }
          }
        }
        const payload = ticketRes.data.data;
        setTicket(payload.ticket);
        setComments(payload.comments || []);
        setAttachments(payload.attachments || []);
        setAssets(payload.assets || []);
        setStatus(payload.ticket?.status || "");
        setPriority(payload.ticket?.priority || "");
        setAssignedTo(payload.ticket?.assigned_to || "");
        setPriorityOverrideReason("");
        setPriorityRequestPriority(payload.ticket?.priority || "P3");
        setEditTitle(payload.ticket?.title || "");
        setEditDescription(payload.ticket?.description || "");
        setEditImpact(payload.ticket?.business_impact || "");
        setResolutionSummary(payload.ticket?.resolution_summary || "");
        setResolutionCategory(payload.ticket?.resolution_category || "");
        setRootCause(payload.ticket?.root_cause || "");
        setStatusChangeReason("");
        setAudit(auditRes.data.data.audit_logs || []);
        setPriorityRequests(overrideRequests);
        setStatusHistory(historyRes.data.data.history || []);
        setEscalations(escalationRes.data.data.escalations || []);
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to load ticket details",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [ticketId, canSeeAudit]);

  useEffect(() => {
    if (!isEndUser) return;
    const fetchAssets = async () => {
      try {
        const res = await apiClient.get("/assets");
        setMyAssets(res.data.data.assets || []);
      } catch (err) {
        setMyAssets([]);
      }
    };

    fetchAssets();
  }, [isEndUser]);

  useEffect(() => {
    if (!canAssign) return;
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
  }, [canAssign, isAdmin]);

  const handleAddComment = async () => {
    const trimmed = commentText.trim();
    if (isBlank(trimmed)) return;
    if (!hasMinLength(trimmed, 2)) {
      setError("Comment must be at least 2 characters.");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post(`/tickets/${ticketId}/comments`, {
        comment_text: commentText.trim(),
        is_internal: isInternal,
      });
      setCommentText("");
      setIsInternal(false);
      if (onUpdated) onUpdated();
      const ticketRes = await apiClient.get(`/tickets/${ticketId}`);
      setComments(ticketRes.data.data.comments || []);
      setAttachments(ticketRes.data.data.attachments || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add comment");
    } finally {
      setSaving(false);
    }
  };

  const handleTicketUpdate = async () => {
    if (!ticket) return;
    const payload = {};
    const isStatusChange = status && status !== ticket.status;
    const isResolving =
      isStatusChange && ["Resolved", "Closed"].includes(status);
    if (isResolving) {
      if (!resolutionSummary.trim() || !resolutionCategory.trim() || !rootCause.trim()) {
        setError("Resolution summary, category, and root cause are required before resolving.");
        return;
      }
      if (!hasMinLength(resolutionSummary, 5)) {
        setError("Resolution summary must be at least 5 characters.");
        return;
      }
      if (!hasMinLength(resolutionCategory, 3)) {
        setError("Resolution category must be at least 3 characters.");
        return;
      }
      if (!hasMinLength(rootCause, 3)) {
        setError("Root cause must be at least 3 characters.");
        return;
      }
    }
    if (isStatusChange) payload.status = status;
    if (priority && priority !== ticket.priority) {
      if (!priorityOverrideReason.trim()) {
        setError("Priority override reason required");
        return;
      }
      if (!hasMinLength(priorityOverrideReason, 5)) {
        setError("Priority override reason must be at least 5 characters.");
        return;
      }
      payload.priority = priority;
      payload.priority_override_reason = priorityOverrideReason.trim();
    }
    if (statusChangeReason && !hasMaxLength(statusChangeReason, 255)) {
      setError("Status change reason must be 255 characters or less.");
      return;
    }
    if (assignedTo !== (ticket.assigned_to || ""))
      payload.assigned_to = assignedTo || "";
    if (resolutionSummary) payload.resolution_summary = resolutionSummary;
    if (resolutionCategory) payload.resolution_category = resolutionCategory;
    if (rootCause) payload.root_cause = rootCause;
    if (statusChangeReason) payload.status_change_reason = statusChangeReason;
    if (Object.keys(payload).length === 0) return;
    setSaving(true);
    const nextStatus = status;
    const photoToUpload = resolutionPhoto;
    try {
      await apiClient.patch(`/tickets/${ticketId}`, payload);
      if (isResolving && photoToUpload) {
        const formData = new FormData();
        formData.append("files", photoToUpload);
        await apiClient.post(`/tickets/${ticketId}/attachments`, formData);
      }
      const ticketRes = await apiClient.get(`/tickets/${ticketId}`);
      setTicket(ticketRes.data.data.ticket);
      setStatus(ticketRes.data.data.ticket?.status || "");
      setPriority(ticketRes.data.data.ticket?.priority || "");
      setAssignedTo(ticketRes.data.data.ticket?.assigned_to || "");
      setPriorityOverrideReason("");
      setResolutionSummary(
        ticketRes.data.data.ticket?.resolution_summary || "",
      );
      setResolutionCategory(
        ticketRes.data.data.ticket?.resolution_category || "",
      );
      setRootCause(ticketRes.data.data.ticket?.root_cause || "");
      setStatusChangeReason("");
      setResolutionPhoto(null);
      setAttachments(ticketRes.data.data.attachments || []);
      const historyRes = await apiClient.get(
        `/tickets/${ticketId}/status-history`,
      );
      setStatusHistory(historyRes.data.data.history || []);
      if (isResolving && onResolved) {
        onResolved({ ...ticketRes.data.data.ticket, status: nextStatus });
      }
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update ticket");
    } finally {
      setSaving(false);
    }
  };

  const handleEscalate = async () => {
    if (!escalationReason.trim()) {
      setError("Escalation reason required");
      return;
    }
    if (!hasMinLength(escalationReason, 5)) {
      setError("Escalation reason must be at least 5 characters.");
      return;
    }
    setSaving(true);
    setError("");
    setEscalationNotice("");
    try {
      await apiClient.post(`/tickets/${ticketId}/escalations`, {
        reason: escalationReason.trim(),
        severity: escalationSeverity,
      });
      setEscalationReason("");
      setEscalationNotice("Escalation submitted.");
      const escalationRes = await apiClient.get(
        `/tickets/${ticketId}/escalations`,
      );
      setEscalations(escalationRes.data.data.escalations || []);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to escalate ticket");
    } finally {
      setSaving(false);
    }
  };

  const handlePriorityOverrideRequest = async () => {
    if (!priorityRequestReason.trim()) {
      setError("Priority override reason required");
      return;
    }
    if (!hasMinLength(priorityRequestReason, 5)) {
      setError("Priority override reason must be at least 5 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiClient.post(`/tickets/${ticketId}/priority-override-requests`, {
        requested_priority: priorityRequestPriority,
        reason: priorityRequestReason.trim(),
      });
      setNotice("Priority override request submitted");
      setPriorityRequestReason("");
      const res = await apiClient.get(
        `/tickets/${ticketId}/priority-override-requests`,
      );
      setPriorityRequests(res.data.data.requests || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to request priority override",
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePriorityOverrideReview = async (requestId, statusValue) => {
    setSaving(true);
    setError("");
    try {
      await apiClient.patch(
        `/tickets/${ticketId}/priority-override-requests/${requestId}`,
        { status: statusValue },
      );
      const res = await apiClient.get(
        `/tickets/${ticketId}/priority-override-requests`,
      );
      setPriorityRequests(res.data.data.requests || []);
      const ticketRes = await apiClient.get(`/tickets/${ticketId}`);
      setTicket(ticketRes.data.data.ticket);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to review priority override",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEndUserUpdate = async () => {
    if (!ticket) return;
    if (isBlank(editTitle) || !hasMinLength(editTitle, 5)) {
      setError("Title must be at least 5 characters.");
      return;
    }
    if (!hasMaxLength(editTitle, 255)) {
      setError("Title must be 255 characters or less.");
      return;
    }
    if (isBlank(editDescription) || !hasMinLength(editDescription, 10)) {
      setError("Description must be at least 10 characters.");
      return;
    }
    if (isBlank(editImpact) || !hasMinLength(editImpact, 10)) {
      setError("Business impact must be at least 10 characters.");
      return;
    }
    const payload = {};
    if (editTitle && editTitle !== ticket.title) payload.title = editTitle;
    if (editDescription && editDescription !== ticket.description) {
      payload.description = editDescription;
    }
    if (editImpact && editImpact !== ticket.business_impact) {
      payload.business_impact = editImpact;
    }
    if (Object.keys(payload).length === 0) return;
    setSaving(true);
    try {
      await apiClient.patch(`/tickets/${ticketId}`, payload);
      const ticketRes = await apiClient.get(`/tickets/${ticketId}`);
      setTicket(ticketRes.data.data.ticket);
      setEditTitle(ticketRes.data.data.ticket?.title || "");
      setEditDescription(ticketRes.data.data.ticket?.description || "");
      setEditImpact(ticketRes.data.data.ticket?.business_impact || "");
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update ticket");
    } finally {
      setSaving(false);
    }
  };

  const handleLinkAsset = async () => {
    if (!selectedAssetId || !ticketId) return;
    setSaving(true);
    try {
      await apiClient.post(`/assets/${selectedAssetId}/link-ticket`, {
        ticket_id: ticketId,
      });
      const ticketRes = await apiClient.get(`/tickets/${ticketId}`);
      setAssets(ticketRes.data.data.assets || []);
      setSelectedAssetId("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to link asset");
    } finally {
      setSaving(false);
    }
  };

  const stripHtml = (value) => value?.replace(/<[^>]*>/g, "") || "";

  const buildAttachmentUrl = (filePath) => {
    if (!filePath) return "";
    if (filePath.startsWith("http")) return filePath;
    const normalized = filePath.replace(/\\/g, "/");
    const baseOrigin = window.location.port === "3000"
      ? "http://localhost:3001"
      : window.location.origin;
    if (normalized.startsWith("/")) return `${baseOrigin}${normalized}`;
    if (normalized.startsWith("uploads/")) return `${baseOrigin}/${normalized}`;
    const fileName = normalized.split("/").pop();
    return fileName ? `${baseOrigin}/uploads/${fileName}` : normalized;
  };

  if (!ticketId) {
    return (
      <div className="panel detail-panel empty-state">
        Select a ticket to see details.
      </div>
    );
  }

  if (loading) {
    return <div className="panel detail-panel">Loading ticket...</div>;
  }

  if (error) {
    return <div className="panel detail-panel error">{error}</div>;
  }

  if (!ticket) {
    return <div className="panel detail-panel">Ticket not found.</div>;
  }

  const canEditEndUser =
    isEndUser && ["New", "Pending"].includes(ticket.status);

  return (
    <div className="panel detail-panel">
      <div className="detail-header">
        <div>
          <h2>{ticket.title}</h2>
          <p>{ticket.ticket_number}</p>
        </div>
        <div className="detail-actions">
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <span>Category</span>
          <strong>{ticket.category}</strong>
        </div>
        <div>
          <span>Tags</span>
          <strong>{ticket.tags || "None"}</strong>
        </div>
        <div>
          <span>Priority</span>
          <strong>{ticket.priority}</strong>
        </div>
        <div>
          <span>Ticket Type</span>
          <strong>{ticket.ticket_type || "incident"}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{ticket.status}</strong>
        </div>
        <div>
          <span>Location</span>
          <strong>{ticket.location}</strong>
        </div>
        <div>
          <span>Assigned To</span>
          <strong>{ticket.assigned_to || "Unassigned"}</strong>
        </div>
        <div>
          <span>Created</span>
          <strong>{new Date(ticket.created_at).toLocaleString()}</strong>
        </div>
        <div>
          <span>SLA Due</span>
          <strong>
            {ticket.sla_due_date
              ? new Date(ticket.sla_due_date).toLocaleString()
              : "N/A"}
          </strong>
        </div>
        <div>
          <span>SLA Escalation</span>
          <strong>
            {ticket.sla_status?.escalated ? "Escalated" : "On Track"}
          </strong>
        </div>
        <div>
          <span>SLA Remaining (mins)</span>
          <strong>
            {['Resolved', 'Closed'].includes(ticket?.status)
              ? "Stopped"
              : (ticket.sla_status?.resolution_remaining_minutes ?? "N/A")}
          </strong>
        </div>
      </div>

      {isEndUser && (
        <div className="detail-update">
          <label className="field">
            <span>Title</span>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              disabled={!canEditEndUser}
            />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea
              rows={4}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              disabled={!canEditEndUser}
            />
          </label>
          <label className="field">
            <span>Business Impact</span>
            <textarea
              rows={3}
              value={editImpact}
              onChange={(e) => setEditImpact(e.target.value)}
              disabled={!canEditEndUser}
            />
          </label>
          {!canEditEndUser && (
            <p className="muted">
              Edits are locked once the ticket is In Progress or resolved.
            </p>
          )}
          <button
            className="btn primary"
            onClick={handleEndUserUpdate}
            disabled={saving || !canEditEndUser}
          >
            Update Details
          </button>
        </div>
      )}

      {!isEndUser && (
        <div className="detail-update">
          <label className="field">
            <span>Update Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {canOverridePriority && (
            <label className="field">
              <span>Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          )}
          {canOverridePriority && priority !== ticket.priority && (
            <label className="field">
              <span>Priority Override Reason</span>
              <input
                value={priorityOverrideReason}
                onChange={(e) => setPriorityOverrideReason(e.target.value)}
                placeholder="Explain why priority changed"
              />
            </label>
          )}
          {canAssign && (
            <label className="field">
              <span>Assigned To</span>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.user_id} value={agent.user_id}>
                    {agent.full_name || agent.email} {isAdmin && `(${agent.role})`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>Status Change Reason (optional)</span>
            <input
              value={statusChangeReason}
              onChange={(e) => setStatusChangeReason(e.target.value)}
              placeholder="Why did this status change?"
            />
          </label>
          {(status === "Resolved" || status === "Closed") && (
            <>
              <label className="field">
                <span>Resolution Summary</span>
                <textarea
                  rows={3}
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  placeholder="Describe how the issue was resolved."
                />
              </label>
              <label className="field">
                <span>Resolution Category</span>
                <input
                  value={resolutionCategory}
                  onChange={(e) => setResolutionCategory(e.target.value)}
                  placeholder="Example: Configuration, Hardware, Access"
                />
              </label>
              <label className="field">
                <span>Root Cause</span>
                <input
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="Root cause of the issue"
                />
              </label>
              {canAttachResolutionPhoto && (
                <label className="field">
                  <span>Resolution Attachment (optional, max 10MB)</span>
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && file.size > 10 * 1024 * 1024) {
                        setError("File must be 10MB or less.");
                        setResolutionPhoto(null);
                        e.target.value = "";
                        return;
                      }
                      setError("");
                      setResolutionPhoto(file || null);
                    }}
                  />
                  {resolutionPhoto && (
                    <div className="attachment-actions" style={{ marginTop: 6 }}>
                      <span className="muted">
                        {resolutionPhoto.name} ({(resolutionPhoto.size / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ marginLeft: 8, padding: "2px 8px" }}
                        onClick={() => setResolutionPhoto(null)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </label>
              )}
            </>
          )}
          <button
            className="btn primary"
            onClick={handleTicketUpdate}
            disabled={saving}
          >
            Update
          </button>
        </div>
      )}

      {canRequestPriorityOverride && (
        <div className="detail-section" style={{
          backgroundColor: "rgba(26, 58, 92, 0.4)",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "20px",
          border: "1px solid rgba(42, 74, 106, 0.3)"
        }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "600", color: "#e0e0e0" }}>
            Request Priority Override
          </h3>
          {notice && (
            <div className="panel success" style={{ marginBottom: "16px", padding: "12px" }}>
              {notice}
            </div>
          )}
          <div style={{ display: "grid", gap: "16px" }}>
            <label className="field">
              <span>Requested Priority</span>
              <select
                value={priorityRequestPriority}
                onChange={(e) => setPriorityRequestPriority(e.target.value)}
                style={{
                  padding: "12px 14px",
                  backgroundColor: "rgba(10, 26, 42, 0.6)",
                  border: "1px solid rgba(58, 90, 122, 0.4)",
                  borderRadius: "6px",
                  color: "#e0e0e0",
                  fontSize: "14px"
                }}
              >
                {priorityOptions.map((option) => (
                  <option key={option} value={option} style={{ backgroundColor: "#0a1a2a" }}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Reason for Change</span>
              <textarea
                value={priorityRequestReason}
                onChange={(e) => setPriorityRequestReason(e.target.value)}
                placeholder="Why should this priority change?"
                rows={4}
                style={{
                  padding: "12px 14px",
                  backgroundColor: "rgba(10, 26, 42, 0.6)",
                  border: "1px solid rgba(58, 90, 122, 0.4)",
                  borderRadius: "6px",
                  color: "#e0e0e0",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </label>
            <button
              className="btn primary"
              onClick={handlePriorityOverrideRequest}
              disabled={saving}
              style={{ justifySelf: "flex-start" }}
            >
              {saving ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </div>
      )}

      {(isAdmin || isManager) && priorityRequests.length > 0 && (
        <div className="detail-section">
          <h3>Priority Override Requests</h3>
          <div className="comment-list">
            {priorityRequests.map((request) => (
              <div key={request.request_id} className="comment-item">
                <div>
                  <strong>{request.requested_by_name || "Requester"}</strong>
                  <span>{new Date(request.created_at).toLocaleString()}</span>
                </div>
                <p>
                  Requested: {request.requested_priority} · Status:{" "}
                  {request.status}
                </p>
                <p>{request.reason}</p>
                {isAdmin && request.status === "pending" && (
                  <div className="comment-form">
                    <button
                      className="btn ghost"
                      onClick={() =>
                        handlePriorityOverrideReview(
                          request.request_id,
                          "approved",
                        )
                      }
                      disabled={saving}
                    >
                      Approve
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() =>
                        handlePriorityOverrideReview(
                          request.request_id,
                          "rejected",
                        )
                      }
                      disabled={saving}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="detail-section">
        <h3>Description</h3>
        <p>{stripHtml(ticket.description)}</p>
      </div>

      <div className="detail-section">
        <h3>Business Impact</h3>
        <p>{ticket.business_impact}</p>
      </div>

      {(ticket.resolution_summary || ticket.resolution_category || ticket.root_cause) && (
        <div className="detail-section">
          <h3>Resolution</h3>
          <p>{ticket.resolution_summary || "No resolution summary."}</p>
          <div className="ticket-meta">
            <span>{ticket.resolution_category || "Uncategorized"}</span>
            <span>•</span>
            <span>{ticket.root_cause || "Root cause not set"}</span>
          </div>
          {isEndUser && ["Resolved", "Closed"].includes(ticket.status) && (
            <div style={{ marginTop: "16px" }}>
              {(ticket.user_confirmed_resolution && ticket.status === "Resolved") || manuallyConfirmed ? (
                <div className="muted" style={{ padding: "12px", backgroundColor: "#e8f5e9", borderRadius: "4px" }}>
                  ✓ You have confirmed this resolution on{" "}
                  {ticket.user_confirmed_at
                    ? new Date(ticket.user_confirmed_at).toLocaleString()
                    : "N/A"}
                </div>
              ) : (
                <div style={{ padding: "12px", backgroundColor: "rgba(10, 22, 53, 0.7)", border: `1px solid ${ticket.status === "Closed" ? "rgba(255, 93, 108, 0.3)" : "rgba(255, 181, 71, 0.3)"}`, borderRadius: "4px", marginBottom: "12px" }}>
                  <p style={{ margin: "0 0 12px 0", fontWeight: "bold" }}>
                    {ticket.status === "Closed"
                      ? "This ticket was closed. You can confirm the resolution or reopen it if the issue persists:"
                      : "Please confirm if the issue has been resolved:"}
                  </p>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    <button
                      className="btn primary"
                      onClick={async () => {
                        setSaving(true);
                        setError("");
                        setNotice("");
                        try {
                          const response = await apiClient.post(`/tickets/${ticketId}/confirm-resolution`);
                          if (response.data?.status === 'success') {
                            setNotice("Resolution confirmed. Thank you!");
                            setManuallyConfirmed(true);
                            // Refresh ticket data
                            const ticketRes = await apiClient.get(`/tickets/${ticketId}`);
                            const updatedTicket = ticketRes.data.data.ticket;
                            setTicket(updatedTicket);
                            setStatus(updatedTicket?.status || "");
                            if (onUpdated) onUpdated();
                          }
                        } catch (err) {
                          console.error('Confirm resolution error:', err);
                          const errorMsg = err.response?.data?.message || err.message || "Failed to confirm resolution";
                          setError(errorMsg);
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      ✓ Confirm Resolution Works
                    </button>
                    <button
                      className="btn ghost"
                      onClick={async () => {
                        if (!reopenReason.trim()) {
                          setError("Please provide a reason for reopening");
                          return;
                        }
                        setSaving(true);
                        setError("");
                        setNotice("");
                        try {
                          const response = await apiClient.post(`/tickets/${ticketId}/reopen`, {
                            reason: reopenReason.trim(),
                          });
                          if (response.data?.status === 'success') {
                            setNotice("Ticket reopened successfully");
                            setReopenReason("");
                            // Refresh ticket data
                            const ticketRes = await apiClient.get(`/tickets/${ticketId}`);
                            const updatedTicket = ticketRes.data.data.ticket;
                            setTicket(updatedTicket);
                            setStatus(updatedTicket?.status || "");
                            setPriority(updatedTicket?.priority || "");
                            setAssignedTo(updatedTicket?.assigned_to || "");
                            try {
                              const commentsRes = await apiClient.get(`/tickets/${ticketId}/comments`);
                              if (commentsRes.data?.data?.comments) {
                                setComments(commentsRes.data.data.comments);
                              }
                            } catch (commentsErr) {
                              console.warn('Could not refresh comments separately:', commentsErr);
                            }
                            if (onUpdated) onUpdated();
                          }
                        } catch (err) {
                          console.error('Reopen ticket error:', err);
                          const errorMsg = err.response?.data?.message || err.message || "Failed to reopen ticket";
                          setError(errorMsg);
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving || !reopenReason.trim()}
                    >
                      Reopen Ticket
                    </button>
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <label className="field">
                      <span>Reason for reopening (if issue not resolved)</span>
                      <textarea
                        rows={2}
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        placeholder="Explain why the resolution didn't work..."
                      />
                    </label>
                  </div>
                  <p className="muted" style={{ marginTop: "8px", fontSize: "12px" }}>
                    {ticket.status === "Closed"
                      ? "If the issue persists, reopen the ticket and it will be reassigned."
                      : "If you don't respond within 2 days, this ticket will be automatically closed."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="detail-section">
        <h3>Attachments</h3>
        {attachments.length ? (
          <div className="attachment-list">
            {attachments.map((file) => (
              <div key={file.attachment_id} className="attachment-item">
                <a
                  href={buildAttachmentUrl(file.file_path)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {file.file_name}
                </a>
                <span>{file.file_type || "file"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No attachments.</p>
        )}
      </div>

      <div className="detail-section">
        <h3>Linked Assets</h3>
        {assets.length === 0 && <p className="muted">No linked assets.</p>}
        {assets.map((asset) => (
          <div key={asset.asset_id} className="ticket-meta">
            <span>{asset.asset_tag}</span>
            <span>•</span>
            <span>{asset.asset_type}</span>
            <span>•</span>
            <span>{asset.status}</span>
          </div>
        ))}
        {isEndUser && (
          <div className="comment-form">
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
            >
              <option value="">Select your asset</option>
              {myAssets.map((asset) => (
                <option key={asset.asset_id} value={asset.asset_id}>
                  {asset.asset_tag} ({asset.asset_type})
                </option>
              ))}
            </select>
            <button
              className="btn ghost"
              onClick={handleLinkAsset}
              disabled={saving}
            >
              Link Asset
            </button>
          </div>
        )}
      </div>

      <div className="detail-section">
        <h3>Status History</h3>
        <div className="audit-list">
          {statusHistory.length === 0 && (
            <p className="muted">No status changes yet.</p>
          )}
          {statusHistory.map((entry) => (
            <div key={entry.status_id} className="audit-item">
              <div>
                <strong>
                  {entry.old_status ? `${entry.old_status} → ` : ""}
                  {entry.new_status}
                </strong>
                <span>{new Date(entry.changed_at).toLocaleString()}</span>
              </div>
              <p>{entry.change_reason || "Status updated"}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="detail-section" style={{
        backgroundColor: "rgba(26, 58, 92, 0.4)",
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "20px",
        border: "1px solid rgba(42, 74, 106, 0.3)"
      }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "600", color: "#e0e0e0" }}>
          Escalations
        </h3>
        {escalationNotice && (
          <div className="panel success" style={{ marginBottom: "16px", padding: "12px" }}>
            {escalationNotice}
          </div>
        )}
        <div style={{ marginBottom: "20px" }}>
          {escalations.length === 0 && (
            <p className="muted" style={{ textAlign: "center", padding: "20px", color: "#a0a0a0" }}>
              No escalations logged.
            </p>
          )}
          {escalations.map((entry) => {
            const severityColors = {
              critical: { bg: "rgba(58, 26, 26, 0.6)", border: "rgba(90, 42, 42, 0.5)", text: "#ff6b6b", badge: "#ff4444" },
              high: { bg: "rgba(58, 42, 26, 0.6)", border: "rgba(90, 74, 42, 0.5)", text: "#ffa500", badge: "#ff8800" },
              medium: { bg: "rgba(42, 42, 58, 0.6)", border: "rgba(58, 58, 90, 0.5)", text: "#60a5fa", badge: "#3b82f6" },
              low: { bg: "rgba(26, 58, 42, 0.6)", border: "rgba(42, 90, 58, 0.5)", text: "#4ade80", badge: "#22c55e" },
            };
            const colors = severityColors[entry.severity?.toLowerCase()] || severityColors.medium;
            return (
              <div
                key={entry.escalation_id}
                style={{
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "12px"
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px"
                }}>
                  <span style={{
                    padding: "4px 10px",
                    backgroundColor: colors.badge,
                    borderRadius: "4px",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: "600",
                    textTransform: "uppercase"
                  }}>
                    {entry.severity}
                  </span>
                  <span style={{ fontSize: "12px", color: "#a0a0a0" }}>
                    {new Date(entry.escalated_at).toLocaleString()}
                  </span>
                </div>
                <p style={{
                  margin: "0",
                  color: "#e0e0e0",
                  fontSize: "14px",
                  lineHeight: "1.5"
                }}>
                  {entry.reason}
                </p>
              </div>
            );
          })}
        </div>
        {canEscalate && (
          <div style={{
            paddingTop: "20px",
            borderTop: "1px solid rgba(42, 74, 106, 0.3)",
            display: "grid",
            gap: "16px"
          }}>
            <label className="field">
              <span>Severity</span>
              <select
                value={escalationSeverity}
                onChange={(e) => setEscalationSeverity(e.target.value)}
                style={{
                  padding: "12px 14px",
                  backgroundColor: "rgba(10, 26, 42, 0.6)",
                  border: "1px solid rgba(58, 90, 122, 0.4)",
                  borderRadius: "6px",
                  color: "#e0e0e0",
                  fontSize: "14px"
                }}
              >
                <option value="low" style={{ backgroundColor: "#0a1a2a" }}>Low</option>
                <option value="medium" style={{ backgroundColor: "#0a1a2a" }}>Medium</option>
                <option value="high" style={{ backgroundColor: "#0a1a2a" }}>High</option>
                <option value="critical" style={{ backgroundColor: "#0a1a2a" }}>Critical</option>
              </select>
            </label>
            <label className="field">
              <span>Reason for Escalation</span>
              <textarea
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                placeholder="Reason for escalation"
                rows={4}
                style={{
                  padding: "12px 14px",
                  backgroundColor: "rgba(10, 26, 42, 0.6)",
                  border: "1px solid rgba(58, 90, 122, 0.4)",
                  borderRadius: "6px",
                  color: "#e0e0e0",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </label>
            <button
              className="btn primary"
              onClick={handleEscalate}
              disabled={saving}
              style={{ justifySelf: "flex-start" }}
            >
              {saving ? "Escalating..." : "Escalate Ticket"}
            </button>
          </div>
        )}
      </div>

      <div className="detail-section">
        <h3>Comments</h3>
        <div className="comment-list">
          {comments.length === 0 && <p className="muted">No comments yet.</p>}
          {comments.map((comment) => (
            <div key={comment.comment_id} className="comment-item">
              <div>
                <strong>{comment.full_name || "User"}</strong>
                <span>{new Date(comment.created_at).toLocaleString()}</span>
              </div>
              <p>{comment.comment_text}</p>
            </div>
          ))}
        </div>
        <div className="comment-form">
          <textarea
            rows={3}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={
              canComment
                ? "Add a comment for the IT team"
                : "Only the assigned agent can add resolution comments."
            }
            disabled={!canComment}
          />
          {canAddInternal && (
            <label className="inline-check">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                disabled={!canComment}
              />
              Internal note (visible to IT only)
            </label>
          )}
          {!canComment && !isEndUser && (
            <p className="muted">
              This ticket is assigned to someone else.
            </p>
          )}
          <button
            className="btn primary"
            onClick={handleAddComment}
            disabled={saving || !canComment}
          >
            Add Comment
          </button>
        </div>
      </div>
      {canSeeAudit && (
        <div className="detail-section">
          <h3>Audit Trail</h3>
          <div className="audit-list">
            {audit.length === 0 && (
              <p className="muted">No audit entries yet.</p>
            )}
            {audit.map((log) => (
              <div key={log.log_id} className="audit-item">
                <div>
                  <strong>{log.action_type}</strong>
                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <p>{log.description || "Updated"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetailPage;
