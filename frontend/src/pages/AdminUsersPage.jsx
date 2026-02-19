import React, { useEffect, useState, useCallback } from "react";
import apiClient from "../api/client";

const roleOptions = ["end_user", "it_agent", "it_manager", "system_admin"];
const locationOptions = ["Philippines", "US", "Indonesia", "China", "Other"];

const getRoleColor = (role) => {
  switch (role) {
    case 'system_admin': return '#ff5d6c';
    case 'it_manager': return '#ffb547';
    case 'it_agent': return '#37d996';
    default: return '#2fd7ff';
  }
};

const UserAvatar = ({ name, color }) => {
  const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
  return (
    <div style={{
      width: '40px',
      height: '40px',
      borderRadius: '12px',
      background: `linear-gradient(135deg, ${color}20, ${color}40)`,
      border: `1px solid ${color}30`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: color,
      fontWeight: '700',
      fontSize: '14px',
      flexShrink: 0,
      fontFamily: 'Sora',
      boxShadow: `0 4px 12px ${color}15`
    }}>
      {initials}
    </div>
  );
};

const StatCard = ({ title, value, sub, color }) => (
  <div className="glass hover-lift" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderLeft: `4px solid ${color}` }}>
    <h3 style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '700', margin: 0 }}>{title}</h3>
    <strong style={{ color: '#f8fafc', fontSize: '2.5rem', fontWeight: '800', lineHeight: 1 }}>{value}</strong>
    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{sub}</span>
  </div>
);

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null);

  const abortControllerRef = React.useRef(null);

  const load = useCallback(async () => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (roleFilter) params.append("role", roleFilter);
      if (locationFilter) params.append("location", locationFilter);

      const res = await apiClient.get(`/users?${params.toString()}`, { signal });
      setUsers(res.data.data.users || []);
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return; // Ignore cancellation
      }
      console.error("Failed to load users:", err);
      // Only verify loading state if not canceled (though usually we'd want to ensure loading is off if error)
    } finally {
      // Only turn off loading if this request wasn't aborted
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [search, roleFilter, locationFilter]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const updateUser = async (id, updates) => {
    try {
      const res = await apiClient.patch(`/users/${id}`, updates);
      if (res.data.data?.temporary_password) {
        setTempPasswordInfo({
          user: res.data.data.user,
          password: res.data.data.temporary_password,
          message: res.data.data.message,
        });
        setTimeout(() => setTempPasswordInfo(null), 30000);
      }
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update user");
    }
  };

  const handleResetPassword = async (user) => {
    try {
      const res = await apiClient.post(`/users/${user.user_id}/reset-password`);
      if (res.data.data?.temporary_password) {
        setTempPasswordInfo({
          user: res.data.data.user,
          password: res.data.data.temporary_password,
          message: res.data.data.message,
        });
        setTimeout(() => setTempPasswordInfo(null), 30000);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reset password");
    }
  };

  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "" });

  const handleEditStart = (user) => {
    setEditingUserId(user.user_id);
    setEditForm({ full_name: user.full_name, email: user.email });
  };

  const handleEditCancel = () => {
    setEditingUserId(null);
    setEditForm({ full_name: "", email: "" });
  };

  const handleEditSave = async (id) => {
    await updateUser(id, editForm);
    setEditingUserId(null);
  };

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'system_admin').length,
    managers: users.filter(u => u.role === 'it_manager').length,
    agents: users.filter(u => u.role === 'it_agent').length,
  };

  return (
    <div className="admin-page animate-fadeIn">
      <header className="page-header">
        <div>
          <h1>User Management</h1>
          <p>Global Directory & Access Control</p>
        </div>
      </header>

      <div className="stats-grid">
        <StatCard title="Total Directory" value={stats.total} sub="Active Staff" color="#2fd7ff" />
        <StatCard title="Regional Management" value={stats.managers} sub="IT Managers" color="#ffb547" />
        <StatCard title="Technical Support" value={stats.agents} sub="IT Agents" color="#37d996" />
        <StatCard title="System Control" value={stats.admins} sub="Super Admins" color="#ff5d6c" />
      </div>

      <div className="glass controls-bar">
        <div className="search-wrapper">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filters-wrapper">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            {roleOptions.map(r => <option key={r} value={r}>{r.replace('_', ' ').toUpperCase()}</option>)}
          </select>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="">All Locations</option>
            {locationOptions.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          {(search || roleFilter || locationFilter) && (
            <button className="text-btn" onClick={() => { setSearch(""); setRoleFilter(""); setLocationFilter(""); }}>
              CLEAR FILTERS
            </button>
          )}
        </div>
      </div>

      {tempPasswordInfo && (
        <div className="glass notification-banner">
          <div className="notification-content">
            <span className="notification-label">SECURITY ALERT</span>
            <span className="notification-message">Temporary access code generated for <strong>{tempPasswordInfo.user.full_name}</strong></span>
          </div>
          <div className="credential-box">
            <code>{tempPasswordInfo.password}</code>
            <button className="action-btn" onClick={() => navigator.clipboard.writeText(tempPasswordInfo.password)}>COPY</button>
            <button className="text-btn" onClick={() => setTempPasswordInfo(null)}>DISMISS</button>
          </div>
        </div>
      )}

      <div className="glass table-container">
        {loading ? (
          <div className="loading-state">Syncing Directory...</div>
        ) : users.length === 0 ? (
          <div className="empty-state">No personnel records found.</div>
        ) : (
          <div className="users-list">
            <div className="list-header">
              <span>USER IDENTITY</span>
              <span>ROLE & STATUS</span>
              <span>LOCATION ASSIGNMENT</span>
              <span style={{ textAlign: 'right' }}>ACTIONS</span>
            </div>
            {users.map((user) => (
              <div key={user.user_id} className={`user-row ${!user.is_active ? 'inactive' : ''}`}>
                <div className="user-info">
                  <UserAvatar name={user.full_name} color={getRoleColor(user.role)} />
                  {editingUserId === user.user_id ? (
                    <div className="edit-inputs">
                      <input
                        type="text"
                        value={editForm.full_name}
                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                        className="inline-input"
                        placeholder="Full Name"
                      />
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="inline-input"
                        placeholder="Email Address"
                      />
                    </div>
                  ) : (
                    <div>
                      <strong>{user.full_name}</strong>
                      <small>{user.email}</small>
                    </div>
                  )}
                </div>

                <div className="user-role">
                  <span className="role-badge" style={{ color: getRoleColor(user.role), borderColor: `${getRoleColor(user.role)}40`, background: `${getRoleColor(user.role)}10` }}>
                    {user.role.replace('_', ' ')}
                  </span>
                  {!user.is_active && <span className="status-badge">INACTIVE</span>}
                </div>

                <div className="user-location">
                  <select
                    value={user.location || ""}
                    onChange={(e) => updateUser(user.user_id, { location: e.target.value })}
                    className="location-select"
                  >
                    <option value="">UNASSIGNED</option>
                    {locationOptions.map((loc) => (
                      <option key={loc} value={loc}>{loc.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div className="user-actions">
                  {editingUserId === user.user_id ? (
                    <>
                      <button className="text-action success" onClick={() => handleEditSave(user.user_id)}>SAVE</button>
                      <button className="text-action" onClick={handleEditCancel}>CANCEL</button>
                    </>
                  ) : (
                    <>
                      <button className="text-action primary" onClick={() => handleEditStart(user)}>EDIT</button>
                      <select
                        value={user.role}
                        onChange={(e) => updateUser(user.user_id, { role: e.target.value })}
                        className="role-select"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>{role.replace('_', ' ').toUpperCase()}</option>
                        ))}
                      </select>

                      {['it_agent', 'it_manager', 'system_admin'].includes(user.role) && (
                        <button className="text-action warning" onClick={() => handleResetPassword(user)}>RESET PW</button>
                      )}

                      <button
                        className={`text-action ${user.is_active ? 'danger' : 'success'}`}
                        onClick={() => updateUser(user.user_id, { is_active: !user.is_active })}
                      >
                        {user.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .admin-page { padding: 2rem; max-width: 1400px; margin: 0 auto; color: #fff; }
        
        .page-header h1 { 
          font-size: 2.5rem; 
          font-weight: 800; 
          background: linear-gradient(to right, #fff, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
        }
        .page-header p { color: #64748b; font-size: 1.1rem; margin-top: 0.5rem; margin-bottom: 2.5rem; }

        .glass {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
        }

        .hover-lift { transition: transform 0.2s ease; }
        .hover-lift:hover { transform: translateY(-4px); }

        .stats-grid { 
          display: grid; 
          grid-template-columns: repeat(4, 1fr); 
          gap: 1.5rem; 
          margin-bottom: 2rem;
        }

        .controls-bar {
          padding: 1.2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .search-wrapper input {
          background: rgba(5, 11, 31, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.8rem 1.2rem;
          border-radius: 12px;
          color: #fff;
          width: 300px;
          font-family: 'Sora', sans-serif;
        }
        .search-wrapper input:focus { outline: none; border-color: #3b82f6; }

        .filters-wrapper { display: flex; gap: 1rem; align-items: center; }
        .filters-wrapper select {
          background: rgba(5, 11, 31, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.8rem 1rem;
          border-radius: 12px;
          color: #cbd5e1;
          font-family: 'Sora', sans-serif;
          cursor: pointer;
        }
        .filters-wrapper select option { background: #0f172a; }

        .text-btn {
          background: none;
          border: none;
          color: #94a3b8;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
          letter-spacing: 0.05em;
        }
        .text-btn:hover { color: #fff; text-decoration: underline; }

        .notification-banner {
          padding: 1.5rem;
          border: 1px solid rgba(55, 217, 150, 0.3);
          background: rgba(55, 217, 150, 0.05);
          margin-bottom: 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .notification-label {
          background: #10b981;
          color: #064e3b;
          font-weight: 800;
          font-size: 0.7rem;
          padding: 0.2rem 0.6rem;
          border-radius: 4px;
          margin-right: 1rem;
        }
        .credential-box { display: flex; align-items: center; gap: 1rem; }
        .credential-box code { 
          font-family: monospace; 
          font-size: 1.5rem; 
          font-weight: 700; 
          color: #34d399; 
          letter-spacing: 2px;
        }
        .action-btn {
          background: #10b981;
          color: #fff;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .table-container { padding: 0.5rem; min-height: 400px; }
        .list-header {
          display: grid;
          grid-template-columns: 2fr 1.5fr 1.5fr 2fr;
          padding: 1rem 1.5rem;
          color: #64748b;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .user-row {
          display: grid;
          grid-template-columns: 2fr 1.5fr 1.5fr 2fr;
          padding: 1.2rem 1.5rem;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          transition: background 0.2s;
        }
        .user-row:hover { background: rgba(255, 255, 255, 0.02); }
        .user-row.inactive { opacity: 0.6; }

        .user-info { display: flex; gap: 1rem; align-items: center; flex: 1; }
        .user-info small { display: block; color: #64748b; }

        .edit-inputs { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
        .inline-input {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 0.4rem 0.8rem;
          color: #fff;
          font-size: 0.85rem;
          width: 100%;
          max-width: 250px;
        }
        .inline-input:focus { outline: none; border-color: #3b82f6; }

        .role-badge {
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          padding: 0.3rem 0.8rem;
          border-radius: 6px;
          border: 1px solid;
          letter-spacing: 0.05em;
        }
        .status-badge {
          font-size: 0.7rem;
          color: #94a3b8;
          font-weight: 700;
          margin-left: 0.8rem;
        }

        .location-select, .role-select {
          background: transparent;
          border: none;
          color: #cbd5e1;
          font-family: 'Sora', sans-serif;
          font-size: 0.9rem;
          cursor: pointer;
        }
        .location-select option, .role-select option { background: #0f172a; }

        .user-actions { display: flex; justify-content: flex-end; align-items: center; gap: 1rem; }
        .text-action {
          background: none;
          border: none;
          font-weight: 700;
          font-size: 0.75rem;
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.2s;
          letter-spacing: 0.05em;
        }
        .text-action:hover { opacity: 1; text-decoration: underline; }
        .text-action.primary { color: #3b82f6; opacity: 1; }
        .text-action.warning { color: #fbbf24; }
        .text-action.danger { color: #ef4444; }
        .text-action.success { color: #10b981; }

        .loading-state, .empty-state { text-align: center; padding: 4rem; color: #64748b; font-weight: 600; }
        
        .animate-fadeIn { animation: fadeIn 0.5s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default AdminUsersPage;
