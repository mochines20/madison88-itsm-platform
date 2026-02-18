import React, { useEffect, useState } from "react";
import apiClient from "../api/client";

const priorities = ["P1", "P2", "P3", "P4"];
const categories = ["Hardware", "Software", "Access Request", "Account Creation", "Network", "Other"];

const AdminSlaPage = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

  // New Rule State
  const [newRule, setNewRule] = useState({
    priority: "P1",
    category: "",
    response_time_hours: 4,
    resolution_time_hours: 24,
    escalation_threshold_percent: 80,
    is_active: true
  });

  const loadRules = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/sla-governance");
      const fetchedRules = res.data.data.rules || [];
      console.log('Rules loaded:', fetchedRules);
      setRules(fetchedRules);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load SLA rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleCreateRule = async () => {
    setError("");
    try {
      await apiClient.post("/sla-governance", newRule);
      setNewRule({
        priority: "P1",
        category: "",
        response_time_hours: 4,
        resolution_time_hours: 24,
        escalation_threshold_percent: 80,
        is_active: true
      });
      loadRules();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create SLA rule");
    }
  };

  const handleUpdateRule = async (rule) => {
    setSavingId(rule.sla_id);
    setError("");

    // Only send fields that are allowed by the backend PatchSchema
    const patchData = {
      priority: rule.priority,
      category: rule.category,
      response_time_hours: rule.response_time_hours,
      resolution_time_hours: rule.resolution_time_hours,
      escalation_threshold_percent: rule.escalation_threshold_percent,
      is_active: rule.is_active
    };

    try {
      console.log('Patching rule:', rule.sla_id, patchData);
      const resp = await apiClient.patch(`/sla-governance/${rule.sla_id}`, patchData);
      console.log('Patch response:', resp.data);
      loadRules();
    } catch (err) {
      console.error('Patch error details:', err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to update SLA rule");
    } finally {
      setSavingId("");
    }
  };

  const handleDeleteRule = async (slaId) => {
    console.log('Attempting to delete SLA Rule with ID:', slaId);
    if (!window.confirm("Are you sure you want to delete this SLA policy? This cannot be undone.")) return;

    setError("");
    try {
      const resp = await apiClient.delete(`/sla-governance/${slaId}`);
      console.log('Delete response:', resp.data);
      loadRules();
    } catch (err) {
      console.error('Delete error details:', err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to delete SLA rule");
    }
  };

  if (loading) return (
    <div className="sla-loading-container">
      <div className="shimmer-card" style={{ height: '300px', marginBottom: '2rem' }}></div>
      <div className="shimmer-card" style={{ height: '500px' }}></div>
    </div>
  );

  return (
    <div className="sla-page-wrapper animate-fadeIn">
      <header className="sla-page-header">
        <div className="header-info">
          <h1>SLA Governance</h1>
          <p>Orchestrate service level agreements across priority tiers and service categories.</p>
        </div>
      </header>

      {error && (
        <div className="sla-error-banner animate-slideDown">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          {error}
        </div>
      )}

      {/* Configurator Section */}
      <section className="sla-config-section cascade-item">
        <div className="glass-panel configurator-box">
          <div className="config-header">
            <h3><span className="icon"></span> Add Policy Override</h3>
            <p>Create category-specific targets that override global defaults.</p>
          </div>

          <div className="config-grid">
            <div className="input-group">
              <label>Priority</label>
              <select
                value={newRule.priority}
                onChange={e => setNewRule({ ...newRule, priority: e.target.value })}
              >
                {priorities.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Target Category</label>
              <select
                value={newRule.category}
                onChange={e => setNewRule({ ...newRule, category: e.target.value })}
              >
                <option value="">Global Default</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="input-group small">
              <label>Resp. (h)</label>
              <input
                type="number"
                value={newRule.response_time_hours}
                onChange={e => setNewRule({ ...newRule, response_time_hours: e.target.value })}
              />
            </div>
            <div className="input-group small">
              <label>Res. (h)</label>
              <input
                type="number"
                value={newRule.resolution_time_hours}
                onChange={e => setNewRule({ ...newRule, resolution_time_hours: e.target.value })}
              />
            </div>
            <button className="btn-add-policy hover-lift btn-press" onClick={handleCreateRule}>
              Add Policy
            </button>
          </div>
        </div>
      </section>

      {/* Active Policies List */}
      <section className="sla-list-section">
        <div className="sla-list-header hide-mobile">
          <span>Priority</span>
          <span>Scope</span>
          <span>Response</span>
          <span>Resolution</span>
          <span>Guardrail</span>
          <span style={{ textAlign: 'center' }}>Active</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>

        <div className="sla-cards-container">
          {rules.map((rule, idx) => (
            <div key={rule.sla_id} className="sla-policy-card cascade-item" style={{ animationDelay: `${(idx + 1) * 0.1}s` }}>
              <div className="policy-badge-container">
                <div className="priority-ring" data-priority={rule.priority}>
                  <span>{rule.priority}</span>
                </div>
              </div>

              <div className="policy-scope">
                {rule.category ? (
                  <span className="scope-tag">{rule.category}</span>
                ) : (
                  <span className="scope-global">Global Standards</span>
                )}
              </div>

              <div className="policy-metric">
                <div className="metric-input-wrapper">
                  <input
                    type="number"
                    value={rule.response_time_hours}
                    onChange={e => setRules(rules.map(r => r.sla_id === rule.sla_id ? { ...r, response_time_hours: e.target.value } : r))}
                  />
                  <span className="unit">hrs</span>
                </div>
              </div>

              <div className="policy-metric">
                <div className="metric-input-wrapper">
                  <input
                    type="number"
                    value={rule.resolution_time_hours}
                    onChange={e => setRules(rules.map(r => r.sla_id === rule.sla_id ? { ...r, resolution_time_hours: e.target.value } : r))}
                  />
                  <span className="unit">hrs</span>
                </div>
              </div>

              <div className="policy-metric hide-mobile">
                <div className="metric-input-wrapper threshold">
                  <input
                    type="number"
                    value={rule.escalation_threshold_percent}
                    onChange={e => setRules(rules.map(r => r.sla_id === rule.sla_id ? { ...r, escalation_threshold_percent: e.target.value } : r))}
                  />
                  <span className="unit">%</span>
                </div>
              </div>

              <div className="policy-status">
                <label className="premium-toggle">
                  <input
                    type="checkbox"
                    checked={rule.is_active}
                    onChange={e => handleUpdateRule({ ...rule, is_active: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="policy-actions">
                <button
                  className="btn-update btn-press mb-2"
                  onClick={() => handleUpdateRule(rule)}
                  disabled={savingId === rule.sla_id}
                >
                  {savingId === rule.sla_id ? <span className="spinner"></span> : "Update"}
                </button>
                <button
                  className="btn-delete btn-press"
                  onClick={() => handleDeleteRule(rule.sla_id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <style>{`
                .mb-2 { margin-bottom: 0.5rem; }
                .btn-delete {
                    width: 100%;
                    padding: 0.6rem;
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    border-radius: 10px;
                    font-weight: 700;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-delete:hover {
                    background: #ef4444;
                    color: #fff;
                }
                .sla-page-wrapper {
                    padding: 2rem;
                    max-width: 1400px;
                    margin: 0 auto;
                    color: #fff;
                }

                .sla-page-header {
                    margin-bottom: 3rem;
                    border-left: 4px solid var(--primary-color);
                    padding-left: 1.5rem;
                }
                .sla-page-header h1 {
                    font-size: 2.5rem;
                    font-weight: 800;
                    margin-bottom: 0.5rem;
                    letter-spacing: -0.02em;
                    background: linear-gradient(to right, #fff, #94a3b8);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .sla-page-header p {
                    color: #94a3b8;
                    font-size: 1.1rem;
                }

                .sla-error-banner {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    color: #f87171;
                    padding: 1rem 1.5rem;
                    border-radius: 12px;
                    margin-bottom: 2rem;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .glass-panel {
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 20px;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
                }

                .configurator-box {
                    padding: 2.5rem;
                    margin-bottom: 4rem;
                }
                .config-header {
                    margin-bottom: 2rem;
                }
                .config-header h3 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin-bottom: 0.5rem;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .config-header .icon {
                    background: linear-gradient(135deg, #fbbf24, #f59e0b);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .config-header p {
                    color: #64748b;
                }

                .config-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1.5rem;
                    align-items: flex-end;
                }
                .input-group {
                    flex: 1;
                    min-width: 200px;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .input-group.small { min-width: 100px; flex: 0.5; }
                .input-group label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #64748b;
                }
                .input-group select, .input-group input {
                    background: rgba(2, 6, 23, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    padding: 0.8rem 1rem;
                    color: #fff;
                    font-size: 1rem;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .input-group select:focus, .input-group input:focus {
                    outline: none;
                    border-color: var(--primary-color);
                    background: rgba(2, 6, 23, 0.8);
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
                }

                .btn-add-policy {
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    color: #fff;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 10px;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
                }

                .sla-list-header {
                    display: grid;
                    grid-template-columns: 80px 1.5fr 1fr 1fr 1fr 100px 120px;
                    gap: 2rem;
                    padding: 0 2rem 1rem 2rem;
                    color: #64748b;
                    font-size: 0.75rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }

                .sla-cards-container {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .sla-policy-card {
                    display: grid;
                    grid-template-columns: 80px 1.5fr 1fr 1fr 1fr 100px 120px;
                    gap: 2rem;
                    align-items: center;
                    background: rgba(30, 41, 59, 0.4);
                    padding: 1.5rem 2rem;
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    transition: all 0.3s;
                }
                .sla-policy-card:hover {
                    background: rgba(30, 41, 59, 0.6);
                    transform: translateX(8px);
                    border-color: rgba(99, 102, 241, 0.3);
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                }

                .priority-ring {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    font-size: 1.1rem;
                    position: relative;
                }
                .priority-ring[data-priority="P1"] { color: #ef4444; border: 2px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.1); }
                .priority-ring[data-priority="P2"] { color: #f59e0b; border: 2px solid rgba(245, 158, 11, 0.3); background: rgba(245, 158, 11, 0.1); }
                .priority-ring[data-priority="P3"] { color: #3b82f6; border: 2px solid rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.1); }
                .priority-ring[data-priority="P4"] { color: #94a3b8; border: 2px solid rgba(148, 163, 184, 0.3); background: rgba(148, 163, 184, 0.1); }

                .scope-tag {
                    display: inline-block;
                    padding: 0.4rem 1rem;
                    background: rgba(99, 102, 241, 0.1);
                    color: #a5b4fc;
                    border-radius: 99px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    border: 1px solid rgba(99, 102, 241, 0.2);
                }
                .scope-global {
                    color: #64748b;
                    font-style: italic;
                    font-size: 0.9rem;
                }

                .metric-input-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .metric-input-wrapper input {
                    width: 60px;
                    background: rgba(15, 23, 42, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 0.4rem 0.6rem;
                    color: #fff;
                    font-weight: 700;
                    text-align: center;
                }
                .metric-input-wrapper input:focus {
                    outline: none;
                    border-color: var(--primary-color);
                }
                .unit { color: #64748b; font-size: 0.8rem; font-weight: 600; }

                .premium-toggle {
                    position: relative;
                    display: inline-block;
                    width: 50px;
                    height: 26px;
                }
                .premium-toggle input { opacity: 0; width: 0; height: 0; }
                .toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-color: #334155;
                    transition: .4s;
                    border-radius: 34px;
                }
                .toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 18px; width: 18px;
                    left: 4px; bottom: 4px;
                    background-color: #fff;
                    transition: .4s;
                    border-radius: 50%;
                }
                input:checked + .toggle-slider { background-color: #10b981; }
                input:checked + .toggle-slider:before { transform: translateX(24px); }

                .btn-update {
                    width: 100%;
                    padding: 0.75rem;
                    background: #fff;
                    color: #0f172a;
                    border: none;
                    border-radius: 10px;
                    font-weight: 800;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-update:hover:not(:disabled) { background: #e2e8f0; }
                .btn-update:disabled { opacity: 0.5; cursor: not-allowed; }

                @media (max-width: 1100px) {
                    .sla-list-header, .sla-policy-card {
                        grid-template-columns: 60px 1.2fr 100px 100px 0px 80px 100px;
                        gap: 1rem;
                    }
                    .hide-mobile { display: none; }
                }

                .spinner {
                    width: 16px; height: 16px;
                    border: 2px solid rgba(0,0,0,0.1);
                    border-top-color: #000;
                    border-radius: 50%;
                    display: inline-block;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                .sla-loading-container { padding: 2rem; }
                .shimmer-card {
                    background: linear-gradient(90deg, rgba(30,41,59,0.3) 25%, rgba(30,41,59,0.5) 50%, rgba(30,41,59,0.3) 75%);
                    background-size: 200% 100%;
                    animation: shimmer 2s infinite;
                    border-radius: 20px;
                }
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
    </div>
  );
};

export default AdminSlaPage;
