import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { onDashboardRefresh } from "../../api/socket";
import {
  FiActivity,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiLayers,
  FiMessageSquare,
  FiPieChart,
  FiUsers,
  FiZap,
  FiDownload
} from "react-icons/fi";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: { open: 0, in_progress: 0, pending: 0, resolved: 0, closed: 0, mttr: 0, mtta: 0, approvals: 0, overdue: 0 },
    sla: {},
    aging: { over_7: 0, over_14: 0, over_30: 0 },
    workload: { labels: [], datasets: [] },
    agingBuckets: { labels: [], datasets: [] },
    trends: { labels: [], datasets: [] },
    topTags: [],
    pulse: []
  });
  const [error, setError] = useState("");
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [agentEmail, setAgentEmail] = useState('');
  const [isAddingByEmail, setIsAddingByEmail] = useState(false);
  const [newAgent, setNewAgent] = useState({
    email: '',
    first_name: '',
    last_name: '',
    full_name: '',
    password: '',
    phone: '',
    department: 'IT Support'
  });

  const trendLabelsForChart = (trendData) => {
    return trendData.map(d => {
      return new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
  };

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [statusRes, reportingRes, pulseRes] = await Promise.all([
        apiClient.get("/dashboard/status-summary"),
        apiClient.get("/dashboard/advanced-reporting"),
        apiClient.get("/dashboard/pulse")
      ]);

      const status = statusRes.data.data.summary || {};
      const advanced = reportingRes.data.data || {};
      const pulse = pulseRes.data.data || {};

      // Process Workload Chart
      const workloadData = advanced.agent_workload || [];
      const workloadLabels = workloadData.map(a => a.full_name);
      const activeCounts = workloadData.map(a => a.active_count);
      const overdueCounts = workloadData.map(a => a.overdue_count);

      // Process Aging Buckets Chart
      const buckets = advanced.aging_buckets || {};
      const agingLabels = ['0-1d', '2-3d', '4-7d', '8-14d', '15d+'];
      const agingCounts = [
        buckets.bucket_0_1 || 0,
        buckets.bucket_2_3 || 0,
        buckets.bucket_4_7 || 0,
        buckets.bucket_8_14 || 0,
        buckets.bucket_15_plus || 0
      ];

      // Process Volume Trend Data
      const trendData = [...(advanced.trends?.tickets_by_day || [])].reverse();
      const trendLabels = trendData.map(d => new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      const trendCounts = trendData.map(d => d.count);

      setData({
        summary: {
          open: status.open || 0,
          in_progress: status.in_progress || 0,
          pending: status.pending || 0,
          resolved: status.resolved || 0,
          closed: status.closed || 0,
          mttr: advanced.summary?.mttr_hours || 0,
          mtta: advanced.summary?.mtta_hours || 0,
          approvals: (advanced.approvals_pending?.change_requests || 0) + (advanced.approvals_pending?.priority_overrides || 0),
          overdue: advanced.sla_compliance_by_priority?.reduce((acc, curr) => acc + (curr.breached || 0), 0) || 0,
        },
        sla: advanced.sla_compliance_by_priority?.reduce((acc, curr) => {
          acc[curr.priority] = curr;
          return acc;
        }, {}) || {},
        aging: {
          over_7: (buckets.bucket_8_14 || 0) + (buckets.bucket_15_plus || 0),
          over_14: buckets.bucket_15_plus || 0,
          over_30: 0,
        },
        workload: {
          labels: workloadLabels,
          datasets: [
            {
              label: 'Active',
              data: activeCounts,
              backgroundColor: '#3b82f6',
              borderRadius: 6,
            },
            {
              label: 'Overdue',
              data: overdueCounts,
              backgroundColor: '#ef4444',
              borderRadius: 6,
            }
          ]
        },
        agingBuckets: {
          labels: agingLabels,
          datasets: [{
            data: agingCounts,
            backgroundColor: [
              '#10b981',
              '#3b82f6',
              '#f59e0b',
              '#f97316',
              '#ef4444'
            ],
            borderWidth: 0,
          }]
        },
        trends: {
          labels: trendLabels,
          datasets: [{
            label: 'Daily Tickets',
            data: trendCounts,
            fill: true,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderColor: '#3b82f6',
            tension: 0.4,
            pointRadius: 3,
            borderWidth: 2,
          }]
        },
        topTags: advanced.top_tags || [],
        pulse: pulse.events?.slice(0, 5) || []
      });
    } catch (err) {
      console.error("Dashboard Load Error:", err);
      setError(err.response?.data?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = onDashboardRefresh(() => loadData());
    return unsubscribe;
  }, [loadData]);

  const handleStatClick = (filter) => {
    const params = new URLSearchParams(filter);
    navigate(`/tickets?${params.toString()}`);
  };

  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    setIsSending(true);
    try {
      const response = await apiClient.post('/dashboard/broadcast', { message: broadcastMessage });
      window.alert(response.data.message || 'Broadcast sent successfully!');
      setBroadcastMessage("");
      setShowBroadcastModal(false);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to send broadcast';
      window.alert(errorMsg);
    } finally {
      setIsSending(false);
    }
  };

  const handleExport = () => {
    const token = localStorage.getItem('token');
    const url = `${process.env.REACT_APP_API_URL || ''}/api/dashboard/export?format=csv&token=${token}`;
    window.open(url, '_blank');
  };

  const loadTeam = async () => {
    try {
      const res = await apiClient.get('/users?role=it_agent');
      setTeamMembers(res.data.data.users || []);
    } catch (err) {
      console.error("Failed to load team:", err);
    }
  };

  const handleAddAgent = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/users', {
        ...newAgent,
        role: 'it_agent' // Enforced by backend but good to specify
      });
      window.alert('Agent recruited successfully!');
      setShowAddAgentModal(false);
      setNewAgent({ email: '', first_name: '', last_name: '', full_name: '', password: '', phone: '', department: 'IT Support' });
      loadTeam();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to recruit agent");
    }
  };

  const handleAddByEmail = async (e) => {
    e.preventDefault();
    if (!agentEmail.trim()) return;
    setIsAddingByEmail(true);
    try {
      await apiClient.post('/users/team-membership', { email: agentEmail.trim() });
      window.alert('Agent added to your team successfully!');
      setAgentEmail('');
      loadTeam();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add agent by email. Ensure they exist and are IT Agents in your location.");
    } finally {
      setIsAddingByEmail(false);
    }
  };

  if (loading) return <div className="loading-overlay">Loading Analytics...</div>;

  return (
    <div className="manager-dashboard animate-fadeIn">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-info">
          <h1>Manager Console</h1>
          <p>Team Performance & Operations Oversight</p>
        </div>
        <div className="header-actions">
          <button className="icon-btn hover-lift" title="Export Report" onClick={handleExport}>
            <FiDownload />
          </button>
          <button className="icon-btn hover-lift" title="Manage Team" onClick={() => { loadTeam(); setShowTeamModal(true); }}>
            <FiUsers />
          </button>
          <button className="action-btn primary hover-lift" onClick={() => setShowBroadcastModal(true)}>
            <FiMessageSquare /> Broadcast to Team
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {/* KPI Overview */}
      <div className="kpi-grid">
        <div className="kpi-card glass hover-lift" onClick={() => handleStatClick({ status: 'In Progress' })}>
          <div className="kpi-icon blue"><FiActivity /></div>
          <div className="kpi-content">
            <span>In Progress</span>
            <strong>{data.summary.in_progress}</strong>
          </div>
        </div>
        <div className="kpi-card glass hover-lift" onClick={() => handleStatClick({ sla_breached: 'true' })}>
          <div className="kpi-icon red"><FiZap /></div>
          <div className="kpi-content">
            <span>Overdue</span>
            <strong>{data.summary.overdue}</strong>
          </div>
        </div>
        <div className="kpi-card glass hover-lift">
          <div className="kpi-icon green"><FiClock /></div>
          <div className="kpi-content">
            <span>MTTR</span>
            <strong>{data.summary.mttr.toFixed(1)}h</strong>
            <small>Avg. Resolution</small>
          </div>
        </div>
        <div className="kpi-card glass hover-lift" onClick={() => navigate('/change-management')}>
          <div className="kpi-icon purple"><FiLayers /></div>
          <div className="kpi-content">
            <span>Approvals</span>
            <strong>{data.summary.approvals}</strong>
            <small>Pending Action</small>
          </div>
        </div>
      </div>

      {/* Volume Trend Section */}
      <section className="volume-trend-section glass hover-lift">
        <div className="section-header">
          <h3>Ticket Volume Trend</h3>
          <div className="trend-stats">
            <FiActivity className="muted" />
            <span className="muted">Last 30 Days</span>
          </div>
        </div>
        <div className="chart-wrapper trend">
          <Line
            data={data.trends}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 0 }
                },
                y: {
                  grid: { color: 'rgba(255,255,255,0.05)' },
                  ticks: { color: '#64748b', font: { size: 10 }, stepSize: 5 }
                }
              }
            }}
          />
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="dashboard-row workload-row">
        {/* Workload Section */}
        <section className="chart-section workload glass">
          <div className="section-header">
            <h3>Team Workload Distribution</h3>
            <FiUsers className="muted" />
          </div>
          <div className="chart-wrapper">
            <Bar
              data={data.workload}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } },
                scales: {
                  x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                  y: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
              }}
            />
          </div>
        </section>

        {/* Aging Profile */}
        <section className="chart-section aging glass">
          <div className="section-header">
            <h3>Aging Profile</h3>
            <FiPieChart className="muted" />
          </div>
          <div className="chart-wrapper doughnut">
            <Doughnut
              data={data.agingBuckets}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 } } } },
                cutout: '70%'
              }}
            />
          </div>
        </section>
      </div>

      <div className="dashboard-row pulse-tags-row">
        <section className="pulse-section glass">
          <div className="section-header">
            <h3>Live Pulse</h3>
            <div className="live-indicator"></div>
          </div>
          <div className="pulse-list">
            {data.pulse.length > 0 ? data.pulse.map((event, idx) => (
              <div key={idx} className="pulse-item">
                <div className={`pulse-dot ${event.type}`}></div>
                <div className="pulse-info">
                  <p>{event.text}</p>
                  <small>{new Date(event.timestamp).toLocaleTimeString()}</small>
                </div>
              </div>
            )) : <p className="muted text-center" style={{ padding: '2rem' }}>No recent activity</p>}
          </div>
        </section>

        <section className="tags-section glass">
          <div className="section-header">
            <h3>Top Issue Categories</h3>
            <FiLayers className="muted" />
          </div>
          <div className="tags-list">
            {data.topTags.length > 0 ? data.topTags.map((tag, idx) => (
              <div key={idx} className="tag-item">
                <span className="tag-name">{tag.tag}</span>
                <span className="tag-count">{tag.count}</span>
              </div>
            )) : <p className="muted text-center" style={{ padding: '1rem' }}>No tags yet</p>}
          </div>
        </section>
      </div>

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="modal-overlay animate-fadeIn">
          <div className="modal-content glass animate-slideUp">
            <div className="modal-header">
              <FiMessageSquare className="icon-primary" />
              <h2>Team Broadcast</h2>
            </div>
            <form onSubmit={handleBroadcastSubmit}>
              <div className="modal-body">
                <p>Send a message to all active IT agents. This will appear in their live feed instantly.</p>
                <textarea
                  className="broadcast-textarea"
                  placeholder="Enter your announcement..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  maxLength={500}
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowBroadcastModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSending || !broadcastMessage.trim()}>
                  {isSending ? 'Sending...' : 'Send Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SLA Compliance Stripe */}
      <section className="sla-stripe glass">
        <div className="section-header">
          <h3>SLA Compliance by Priority</h3>
          <FiCheckCircle className="muted" />
        </div>
        <div className="sla-row">
          {['P1', 'P2', 'P3', 'P4'].map(priority => (
            <div key={priority} className="sla-chip">
              <span className="priority-label">{priority}</span>
              <div className="sla-progress-bg">
                <div
                  className="sla-progress-bar"
                  style={{
                    width: `${data.sla[priority]?.compliance || 0}%`,
                    backgroundColor: (data.sla[priority]?.compliance || 0) > 90 ? '#10b981' : (data.sla[priority]?.compliance || 0) > 75 ? '#f59e0b' : '#ef4444'
                  }}
                ></div>
              </div>
              <span className="compliance-val">{data.sla[priority]?.compliance || 0}%</span>
            </div>
          ))}
        </div>
      </section>

      {/* Manage Team Modal */}
      {showTeamModal && (
        <div className="modal-overlay animate-fadeIn">
          <div className="modal-content glass animate-slideUp team-modal">
            <div className="modal-header">
              <FiUsers className="icon-primary" />
              <h2>Your Team</h2>
            </div>
            <div className="modal-body">
              <div className="team-list">
                {teamMembers.length > 0 ? teamMembers.map(member => (
                  <div key={member.user_id} className="team-member-item">
                    <div className="member-avatar">{member.full_name?.[0] || '?'}</div>
                    <div className="member-info">
                      <strong>{member.full_name}</strong>
                      <small>{member.email} • {member.location}</small>
                    </div>
                  </div>
                )) : <p className="muted">No agents in your team yet.</p>}
              </div>

              <div className="add-by-email-section">
                <h4>Quick Add by Email</h4>
                <p className="section-hint">Add an existing IT Agent to your team by entering their email address.</p>
                <form onSubmit={handleAddByEmail} className="email-add-form">
                  <input
                    type="email"
                    placeholder="agent@company.com"
                    value={agentEmail}
                    onChange={e => setAgentEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-primary small" disabled={isAddingByEmail || !agentEmail.trim()}>
                    {isAddingByEmail ? 'Adding...' : 'Add to Team'}
                  </button>
                </form>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowTeamModal(false)}>Close</button>
              <button type="button" className="btn-primary" onClick={() => { setShowTeamModal(false); setShowAddAgentModal(true); }}> Recruit New Agent</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Agent Modal */}
      {showAddAgentModal && (
        <div className="modal-overlay animate-fadeIn">
          <div className="modal-content glass animate-slideUp">
            <div className="modal-header">
              <FiUsers className="icon-primary" />
              <h2>Recruit IT Agent</h2>
            </div>
            <form onSubmit={handleAddAgent}>
              <div className="modal-body scrollable-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      required
                      value={newAgent.first_name}
                      onChange={e => setNewAgent({ ...newAgent, first_name: e.target.value, full_name: `${e.target.value} ${newAgent.last_name}`.trim() })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      required
                      value={newAgent.last_name}
                      onChange={e => setNewAgent({ ...newAgent, last_name: e.target.value, full_name: `${newAgent.first_name} ${e.target.value}`.trim() })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" required value={newAgent.email} onChange={e => setNewAgent({ ...newAgent, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Initial Password</label>
                  <input type="password" required value={newAgent.password} onChange={e => setNewAgent({ ...newAgent, password: e.target.value })} minLength={6} />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input type="text" value={newAgent.department} onChange={e => setNewAgent({ ...newAgent, department: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddAgentModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Onboard Agent</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .manager-dashboard {
          padding: 2rem;
          color: #fff;
          max-width: 1400px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2.5rem;
        }

        .header-info h1 { font-size: 2.5rem; font-weight: 800; background: linear-gradient(to right, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .header-info p { color: #64748b; font-size: 1.1rem; }

        .header-actions { display: flex; gap: 1rem; }
        
        .glass {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .kpi-card {
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1.2rem;
          cursor: pointer;
        }

        .kpi-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
        }

        .kpi-icon.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .kpi-icon.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .kpi-icon.green { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .kpi-icon.purple { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }

        .kpi-content span { color: #64748b; font-size: 0.8rem; text-transform: uppercase; font-weight: 600; }
        .kpi-content strong { display: block; font-size: 1.8rem; font-weight: 700; margin-top: 0.2rem; }
        .kpi-content small { color: #475569; font-size: 0.75rem; }

        .dashboard-row {
          display: grid;
          gap: 2rem;
          margin-bottom: 2rem;
        }
        .workload-row { grid-template-columns: 1fr 400px; }
        .pulse-tags-row { grid-template-columns: 1fr 1fr; }

        .chart-section { padding: 1.5rem; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; }
        .section-header h3 { font-size: 1rem; color: #f8fafc; font-weight: 600; }

        .chart-wrapper { height: 260px; }
        .workload .chart-wrapper { height: 260px; }
        .aging .chart-wrapper.doughnut { height: 220px; }

        .pulse-section { padding: 1.5rem; }
        .live-indicator { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; animation: blink 2s infinite; }

        .pulse-list { display: flex; flex-direction: column; gap: 1rem; }
        .pulse-item {
          display: flex;
          gap: 1rem;
          padding: 0.8rem;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
        }
        .pulse-dot { min-width: 6px; height: 6px; border-radius: 50%; margin-top: 6px; }
        .pulse-dot.resolution { background: #10b981; }
        .pulse-dot.kb { background: #8b5cf6; }
        .pulse-dot.metric { background: #3b82f6; }
        .pulse-info p { font-size: 0.9rem; margin-bottom: 0.2rem; line-height: 1.4; color: #e2e8f0; }
        .pulse-info small { color: #64748b; font-size: 0.75rem; }

        .sla-stripe { padding: 1.5rem; margin-top: 2rem; }
        .sla-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem; }
        .sla-chip { display: flex; align-items: center; gap: 1rem; }
        .priority-label { font-weight: 700; font-size: 0.9rem; color: #94a3b8; width: 25px; }
        .sla-progress-bg { flex: 1; height: 6px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; }
        .sla-progress-bar { height: 100%; transition: width 1s ease-out; }
        .compliance-val { font-size: 0.9rem; font-weight: 600; color: #e2e8f0; width: 40px; text-align: right; }

        .action-btn {
          padding: 0.8rem 1.5rem;
          border-radius: 12px;
          border: none;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.8rem;
          transition: all 0.2s;
        }
        .action-btn.primary { background: #3b82f6; color: #fff; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
        .action-btn.primary:hover { background: #2563eb; transform: translateY(-2px); }

        .icon-btn {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .icon-btn:hover { background: rgba(255, 255, 255, 0.1); }

        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.5s ease-out forwards; }
        .hover-lift:hover { transform: translateY(-4px); transition: transform 0.2s; }

        .loading-overlay { display: flex; align-items: center; justify-content: center; height: 400px; color: #64748b; font-size: 1.2rem; font-weight: 600; }
        .error-banner { background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 1rem; border-radius: 12px; margin-bottom: 2rem; border: 1px solid rgba(239, 68, 68, 0.2); }

        .volume-trend-section { padding: 1.5rem; margin-bottom: 2rem; }
        .chart-wrapper.trend { height: 180px; }
        .trend-stats { display: flex; align-items: center; gap: 0.5rem; }

        .tags-section { padding: 1.5rem; }
        .tags-list { display: flex; flex-direction: column; gap: 0.8rem; }
        .tag-item { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 1rem; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.02); }
        .tag-name { font-size: 0.9rem; color: #e2e8f0; font-weight: 500; text-transform: capitalize; }
        .tag-count { font-size: 0.8rem; background: rgba(59, 130, 246, 0.1); color: #3b82f6; padding: 0.2rem 0.6rem; border-radius: 6px; font-weight: 700; }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
        }
        .modal-content {
          max-width: 500px;
          width: 100%;
          border: 1px solid rgba(59, 130, 246, 0.2);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          padding: 2rem;
        }
        .modal-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .modal-header h2 { font-size: 1.5rem; font-weight: 700; margin: 0; }
        .icon-primary { font-size: 2rem; color: #3b82f6; }
        .modal-body p { color: #94a3b8; line-height: 1.6; font-size: 1rem; margin-bottom: 1.5rem; }
        
        .broadcast-textarea {
          width: 100%;
          height: 120px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #fff;
          padding: 1rem;
          resize: none;
          font-family: inherit;
          font-size: 0.95rem;
          transition: all 0.2s;
        }
        .broadcast-textarea:focus {
          outline: none;
          border-color: #3b82f6;
          background: rgba(255, 255, 255, 0.08);
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 2rem;
        }
        .btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.8rem 1.5rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-primary {
          background: #3b82f6;
          color: #fff;
          border: none;
          padding: 0.8rem 1.5rem;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          transition: all 0.2s;
        }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }
        .btn-primary:hover:not(:disabled) { background: #2563eb; transform: translateY(-2px); }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out forwards; }

        .team-modal { max-width: 600px !important; }
        .team-list { display: flex; flex-direction: column; gap: 1rem; max-height: 400px; overflow-y: auto; padding-right: 0.5rem; }
        .team-member-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .member-avatar {
          width: 40px; height: 40px; border-radius: 10px;
          background: #3b82f6; color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800;
        }
        .member-info { display: flex; flex-direction: column; }
        .member-info strong { font-size: 1rem; }
        .member-info small { color: #64748b; font-size: 0.8rem; }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .form-group { margin-bottom: 1.2rem; }
        .form-group label { display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.4rem; font-weight: 600; }
        .form-group input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #fff;
          padding: 0.8rem;
          font-size: 0.9rem;
        }
        .form-group input:focus { outline: none; border-color: #3b82f6; background: rgba(255, 255, 255, 0.08); }
        .scrollable-body { max-height: 50vh; overflow-y: auto; padding-right: 0.5rem; }

        .add-by-email-section { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.1); }
        .add-by-email-section h4 { font-size: 0.9rem; margin-bottom: 0.5rem; color: #f8fafc; }
        .section-hint { font-size: 0.8rem; color: #64748b; margin-bottom: 1rem; }
        .email-add-form { display: flex; gap: 0.8rem; }
        .email-add-form input { flex: 1; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; padding: 0.6rem 0.8rem; font-size: 0.85rem; }
        .email-add-form button { white-space: nowrap; }
        .btn-primary.small { padding: 0.5rem 1rem; font-size: 0.85rem; border-radius: 8px; }
      `}</style>
    </div>
  );
};

export default ManagerDashboard;
