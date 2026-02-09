import React, { useEffect, useState } from "react";
import apiClient from "../../api/client";

const AgentDashboard = () => {
  const [stats, setStats] = useState({
    assigned: 0,
    newCount: 0,
    inProgress: 0,
    pending: 0,
    resolved: 0,
    closed: 0,
    reopened: 0,
  });

  useEffect(() => {
    const load = async () => {
      const res = await apiClient.get("/tickets");
      const tickets = res.data.data.tickets || [];
      setStats({
        assigned: tickets.length,
        newCount: tickets.filter((t) => t.status === "New").length,
        inProgress: tickets.filter((t) => t.status === "In Progress").length,
        pending: tickets.filter((t) => t.status === "Pending").length,
        resolved: tickets.filter((t) => t.status === "Resolved").length,
        closed: tickets.filter((t) => t.status === "Closed").length,
        reopened: tickets.filter((t) => t.status === "Reopened").length,
      });
    };

    load();
  }, []);

  return (
    <div className="dashboard-grid">
      <div className="panel stat-card">
        <h3>Assigned Tickets</h3>
        <strong>{stats.assigned}</strong>
      </div>
      <div className="panel stat-card">
        <h3>New</h3>
        <strong>{stats.newCount}</strong>
      </div>
      <div className="panel stat-card">
        <h3>In Progress</h3>
        <strong>{stats.inProgress}</strong>
      </div>
      <div className="panel stat-card">
        <h3>Pending</h3>
        <strong>{stats.pending}</strong>
      </div>
      <div className="panel stat-card">
        <h3>Resolved</h3>
        <strong>{stats.resolved}</strong>
      </div>
      <div className="panel stat-card">
        <h3>Closed</h3>
        <strong>{stats.closed}</strong>
      </div>
      <div className="panel stat-card">
        <h3>Reopened</h3>
        <strong>{stats.reopened}</strong>
      </div>
    </div>
  );
};

export default AgentDashboard;
