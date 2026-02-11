import React, { useCallback, useEffect, useState } from "react";
import apiClient from "../../api/client";
import { onDashboardRefresh } from "../../api/socket";

const ManagerDashboard = () => {
  const [sla, setSla] = useState({});
  const [statusSummary, setStatusSummary] = useState({
    open: 0,
    in_progress: 0,
    pending: 0,
    resolved: 0,
    closed: 0,
  });
  const [aging, setAging] = useState({
    over_7_days: [],
    over_14_days: [],
    over_30_days: [],
  });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [slaRes, agingRes, statusRes] = await Promise.all([
        apiClient.get("/dashboard/sla-performance"),
        apiClient.get("/dashboard/aging-report"),
        apiClient.get("/dashboard/status-summary"),
      ]);
      setSla(slaRes.data.data.sla_performance || {});
      setAging(agingRes.data.data.aging_report || {});
      setStatusSummary(statusRes.data.data.summary || {});
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dashboard");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = onDashboardRefresh(() => load());
    return unsubscribe;
  }, [load]);

  return (
    <div className="dashboard-stack">
      {error && <div className="panel error">{error}</div>}
      <div className="panel">
        <h3>Team Status Overview</h3>
        <div className="stats-row">
          <div className="stat-chip">
            <span>Open</span>
            <strong>{statusSummary.open || 0}</strong>
          </div>
          <div className="stat-chip">
            <span>In Progress</span>
            <strong>{statusSummary.in_progress || 0}</strong>
          </div>
          <div className="stat-chip">
            <span>Pending</span>
            <strong>{statusSummary.pending || 0}</strong>
          </div>
          <div className="stat-chip">
            <span>Resolved</span>
            <strong>{statusSummary.resolved || 0}</strong>
          </div>
          <div className="stat-chip">
            <span>Closed</span>
            <strong>{statusSummary.closed || 0}</strong>
          </div>
        </div>
      </div>
      <div className="panel">
        <h3>SLA Compliance</h3>
        <div className="stats-row">
          {Object.keys(sla).map((key) => (
            <div key={key} className="stat-chip">
              <span>{key}</span>
              <strong>{sla[key]?.compliance || 0}%</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>Aging Tickets</h3>
        <div className="stats-row">
          <div className="stat-chip">
            <span>Over 7 days</span>
            <strong>
              {aging.over_7_days?.length || aging.over_7_days_count || 0}
            </strong>
          </div>
          <div className="stat-chip">
            <span>Over 14 days</span>
            <strong>
              {aging.over_14_days?.length || aging.over_14_days_count || 0}
            </strong>
          </div>
          <div className="stat-chip">
            <span>Over 30 days</span>
            <strong>
              {aging.over_30_days?.length || aging.over_30_days_count || 0}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
