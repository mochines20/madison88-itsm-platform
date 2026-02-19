import React, { useEffect, useState } from "react";
import apiClient from "../../api/client";
import { Link } from "react-router-dom";

const AgentDashboard = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [myTickets, setMyTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamPulse, setTeamPulse] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [statsRes, ticketsRes, pulseRes] = await Promise.all([
          apiClient.get("/dashboard/agent-stats"),
          apiClient.get("/tickets?assigned_to=me&status=New,In Progress,Pending&limit=10"),
          apiClient.get("/dashboard/pulse")
        ]);

        setStats(statsRes.data.data);
        setMyTickets(ticketsRes.data.data.tickets || []);
        setTeamPulse(pulseRes.data.data.events || []);
      } catch (err) {
        console.error("Failed to load agent dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // Refresh every 30s
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getPriorityColor = (p) => {
    switch (p) {
      case 'P1': return '#ef4444';
      case 'P2': return '#f97316';
      case 'P3': return '#3b82f6';
      default: return '#94a3b8';
    }
  };

  const getSlaStatus = (ticket) => {
    if (ticket.sla_breached) return { text: 'BREACHED', color: '#ef4444' };
    if (ticket.sla_status?.escalated) return { text: 'ESCALATED', color: '#f59e0b' };
    return { text: 'ON TRACK', color: '#10b981' };
  };

  if (loading && !stats) return <div className="p-5 text-center text-slate-400">Loading Command Center...</div>;

  return (
    <div className="agent-dashboard animate-fadeIn">
      <header className="page-header">
        <div>
          <h1>Command Center</h1>
          <p>Welcome back, {user?.full_name?.split(' ')[0]}</p>
        </div>

      </header>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="glass metric-card">
          <h3>MY QUEUE</h3>
          <strong>{stats?.metrics?.active_tickets || 0}</strong>
          <span>Active Tickets</span>
        </div>

        <div className="glass metric-card" style={{ borderLeft: stats?.metrics?.sla_breaches > 0 ? '4px solid #ef4444' : '4px solid #10b981' }}>
          <h3>SLA STATUS</h3>
          <strong style={{ color: stats?.metrics?.sla_breaches > 0 ? '#ef4444' : '#10b981' }}>
            {stats?.metrics?.sla_breaches || 0}
          </strong>
          <span>Breaches</span>
        </div>

        <div className="glass metric-card">
          <h3>VELOCITY</h3>
          <strong>{stats?.metrics?.resolved_this_week || 0}</strong>
          <span>Resolved This Week</span>
        </div>

        <div className="glass metric-card">
          <h3>AVG RESOLUTION</h3>
          <strong>{stats?.metrics?.avg_resolution_hours || 0}h</strong>
          <span>Time to Resolve</span>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Main Section: My Queue */}
        <div className="glass main-panel">
          <div className="panel-header">
            <h2>MY PRIORITY QUEUE</h2>
            <Link to="/tickets?assigned_to=me" className="text-link">VIEW ALL</Link>
          </div>

          <div className="ticket-list">
            {myTickets.length === 0 ? (
              <div className="empty-state">
                No active tickets. You're all caught up!
              </div>
            ) : (
              myTickets.map(ticket => {
                const sla = getSlaStatus(ticket);
                return (
                  <Link to={`/tickets/${ticket.ticket_id}`} key={ticket.ticket_id} className="ticket-item">
                    <div className="ticket-priority" style={{ backgroundColor: getPriorityColor(ticket.priority) }}>
                      {ticket.priority}
                    </div>
                    <div className="ticket-info">
                      <div className="ticket-header">
                        <span className="ticket-number">{ticket.ticket_number}</span>
                        <span className="ticket-category">{ticket.category}</span>
                        {ticket.is_vip && <span className="vip-badge">VIP</span>}
                      </div>
                      <h4 className="ticket-title">{ticket.title}</h4>
                      <div className="ticket-meta">
                        <span className={`sla-badge`} style={{ color: sla.color, borderColor: `${sla.color}40`, background: `${sla.color}10` }}>
                          {sla.text}
                        </span>
                        <span className="detail">{ticket.location}</span>
                        <span className="detail">{new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="ticket-status">
                      <span className="status-text">{ticket.status.toUpperCase()}</span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Side Section: Team Pulse & Activity */}
        <div className="side-panel">
          <div className="glass pulse-card">
            <h3>TEAM PULSE</h3>
            <div className="pulse-list">
              {Array.isArray(teamPulse) && teamPulse.slice(0, 5).map((event, i) => (
                <div key={i} className="pulse-item">
                  <div className="pulse-dot"></div>
                  <p>{event.text}</p>
                  <small>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                </div>
              ))}
              {teamPulse.length === 0 && <div className="empty-text">No recent team activity</div>}
            </div>
          </div>

          <div className="glass activity-card">
            <h3>MY RECENT ACTIVITY</h3>
            <div className="activity-list">
              {stats?.recent_activity?.map((act, i) => (
                <div key={i} className="activity-item">
                  <strong>{act.action_type.replace('_', ' ').toUpperCase()}</strong>
                  <p>{act.description}</p>
                  <small>{new Date(act.timestamp).toLocaleString()}</small>
                </div>
              ))}
              {!stats?.recent_activity?.length && <div className="empty-text">No recent activity</div>}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .agent-dashboard { 
          max-width: 1400px; 
          margin: 0 auto; 
          padding: 2rem;
          color: #f8fafc;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2.5rem;
        }
        .page-header h1 {
          font-size: 2.5rem;
          font-weight: 800;
          background: linear-gradient(to right, #fff, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
          letter-spacing: -1px;
        }
        .page-header p { color: #64748b; margin: 0.5rem 0 0; font-size: 1.1rem; }

        .action-btn {
          background: #3b82f6;
          color: white;
          padding: 0.8rem 1.5rem;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 700;
          font-size: 0.9rem;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          transition: all 0.2s;
        }
        .action-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4); }

        .glass {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .metric-card {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: transform 0.2s;
        }
        .metric-card:hover { transform: translateY(-4px); }
        .metric-card h3 { 
          color: #94a3b8; 
          font-size: 0.75rem; 
          font-weight: 700; 
          letter-spacing: 0.1em; 
          margin: 0;
        }
        .metric-card strong { font-size: 2.5rem; font-weight: 800; line-height: 1; color: #fff; }
        .metric-card span { color: #64748b; font-size: 0.9rem; }

        .dashboard-content {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
        }

        .main-panel { padding: 0.5rem; min-height: 500px; display: flex; flex-direction: column; }
        
        .panel-header {
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .panel-header h2 { margin: 0; font-size: 1.2rem; font-weight: 700; letter-spacing: 0.05em; color: #fff; }
        .text-link { color: #3b82f6; font-weight: 700; font-size: 0.8rem; text-decoration: none; }

        .ticket-list { display: flex; flex-direction: column; }
        
        .ticket-item {
          display: flex;
          gap: 1.5rem;
          padding: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          text-decoration: none;
          color: inherit;
          transition: background 0.2s;
          align-items: center;
        }
        .ticket-item:hover { background: rgba(255, 255, 255, 0.03); }
        .ticket-item:last-child { border-bottom: none; }

        .ticket-priority {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.9rem;
          color: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .ticket-info { flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }
        
        .ticket-header { display: flex; gap: 0.8rem; align-items: center; }
        .ticket-number { color: #64748b; font-family: monospace; font-weight: 700; }
        .ticket-category { color: #94a3b8; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; }
        
        .ticket-title { margin: 0; font-size: 1.1rem; font-weight: 600; color: #e2e8f0; }

        .ticket-meta { display: flex; gap: 1rem; align-items: center; margin-top: 0.2rem; }
        .sla-badge { 
          font-size: 0.7rem; 
          font-weight: 800; 
          padding: 0.25rem 0.6rem; 
          border-radius: 6px; 
          border: 1px solid;
          letter-spacing: 0.05em;
        }
        .detail { font-size: 0.85rem; color: #64748b; }

        .status-text { 
          font-weight: 800; 
          font-size: 0.8rem; 
          color: #94a3b8; 
          letter-spacing: 0.05em;
        }

        .side-panel { display: flex; flex-direction: column; gap: 1.5rem; }
        
        .pulse-card, .activity-card { padding: 1.5rem; }
        .pulse-card h3, .activity-card h3 { 
          margin: 0 0 1.5rem 0; 
          font-size: 0.8rem; 
          color: #94a3b8; 
          font-weight: 800; 
          letter-spacing: 0.05em;
        }

        .pulse-item {
          display: grid;
          grid-template-columns: 10px 1fr auto;
          gap: 1rem;
          align-items: baseline;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }
        .pulse-dot { width: 8px; height: 8px; background: #3b82f6; border-radius: 50%; box-shadow: 0 0 8px #3b82f6; align-self: center; }
        .pulse-item p { margin: 0; color: #cbd5e1; line-height: 1.4; }
        .pulse-item small { color: #64748b; }

        .activity-item {
          padding-bottom: 1rem;
          margin-bottom: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .activity-item:last-child { border-bottom: none; margin-bottom: 0; }
        .activity-item strong { display: block; color: #38bdf8; font-size: 0.8rem; margin-bottom: 0.2rem; }
        .activity-item p { margin: 0 0 0.4rem 0; color: #cbd5e1; font-size: 0.9rem; }
        .activity-item small { color: #64748b; font-size: 0.8rem; }

        .empty-state { padding: 4rem; text-align: center; color: #64748b; font-weight: 600; }
        .empty-text { color: #64748b; font-size: 0.9rem; font-style: italic; }

        .animate-fadeIn { animation: fadeIn 0.5s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default AgentDashboard;
