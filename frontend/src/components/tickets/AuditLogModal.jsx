import React from "react";

const AuditLogModal = ({ isOpen, onClose, audit, user }) => {
    if (!isOpen) return null;

    const isAdmin = user?.role === 'system_admin';

    return (
        <div className="audit-modal-overlay animate-fade-in" onClick={onClose}>
            <div className="audit-modal-content glass" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>TICKET AUDIT TRAIL</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="audit-list">
                    {audit.length === 0 ? (
                        <div className="empty-state">No audit logs found for this ticket.</div>
                    ) : (
                        <div className="audit-table-container">
                            <table className="audit-table">
                                <thead>
                                    <tr>
                                        <th>TIMESTAMP</th>
                                        <th>ACTION</th>
                                        <th>USER</th>
                                        <th>DESCRIPTION</th>
                                        {isAdmin && <th>IP / AGENT</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {audit.map((log) => (
                                        <tr key={log.log_id || log.timestamp}>
                                            <td className="timestamp">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td>
                                                <span className={`action-badge ${log.action_type}`}>
                                                    {log.action_type.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="user-info">
                                                <strong>{log.full_name || 'System'}</strong>
                                                <span className="role">{log.role?.replace('_', ' ')}</span>
                                            </td>
                                            <td className="description">{log.description}</td>
                                            {isAdmin && (
                                                <td className="meta-info">
                                                    <div className="ip">{log.ip_address || 'N/A'}</div>
                                                    <div className="ua" title={log.user_agent}>{log.user_agent ? log.user_agent.substring(0, 20) + '...' : 'N/A'}</div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .audit-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(15, 23, 42, 0.85);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 2rem;
                }

                .audit-modal-content {
                    width: 100%;
                    max-width: 1000px;
                    max-height: 80vh;
                    background: #1e293b;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }

                .modal-header {
                    padding: 1.5rem 2rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(255, 255, 255, 0.02);
                }

                .modal-header h3 {
                    margin: 0;
                    font-size: 0.85rem;
                    font-weight: 900;
                    letter-spacing: 0.15em;
                    color: #94a3b8;
                }

                .close-btn {
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    font-size: 2rem;
                    cursor: pointer;
                    line-height: 1;
                    padding: 0;
                    transition: color 0.2s;
                }
                .close-btn:hover { color: white; }

                .audit-list {
                    flex: 1;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .audit-table-container {
                    flex: 1;
                    overflow: auto;
                    padding: 1rem;
                }

                .audit-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.85rem;
                    color: #cbd5e1;
                }

                .audit-table th {
                    text-align: left;
                    padding: 1rem;
                    background: rgba(15, 23, 42, 0.4);
                    font-weight: 800;
                    font-size: 0.65rem;
                    letter-spacing: 0.1em;
                    color: #64748b;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }

                .audit-table td {
                    padding: 1rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
                    vertical-align: top;
                }

                .audit-table tr:hover {
                    background: rgba(255, 255, 255, 0.01);
                }

                .timestamp {
                    white-space: nowrap;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.75rem;
                    color: #64748b;
                }

                .action-badge {
                    font-size: 0.6rem;
                    font-weight: 900;
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    letter-spacing: 0.05em;
                }

                .action-badge.created { background: rgba(16, 185, 129, 0.15); color: #10b981; }
                .action-badge.updated { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
                .action-badge.commented { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
                .action-badge.escalated { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

                .user-info { display: flex; flex-direction: column; gap: 0.2rem; }
                .user-info .role { font-size: 0.6rem; font-weight: 700; color: #475569; text-transform: uppercase; }

                .description {
                    line-height: 1.5;
                    color: #94a3b8;
                    min-width: 250px;
                }

                .meta-info { font-size: 0.7rem; color: #475569; }
                .meta-info .ip { font-family: monospace; }
                .meta-info .ua { font-style: italic; opacity: 0.7; }

                .empty-state {
                    padding: 4rem;
                    text-align: center;
                    color: #475569;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.98); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in { animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
            `}</style>
        </div>
    );
};

export default AuditLogModal;
