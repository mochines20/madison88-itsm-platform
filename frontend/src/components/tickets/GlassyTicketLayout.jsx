import React, { useState } from "react";
import TicketContextPanel from "./TicketContextPanel";
import TicketConversation from "./TicketConversation";
import TicketActionPanel from "./TicketActionPanel";
import AuditLogModal from "./AuditLogModal";

const GlassyTicketLayout = ({
    ticket,
    user,
    comments,
    assets,
    audit,
    onCommentAdded,
    onTicketUpdated,
    onClose
}) => {
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

    return (
        <div className="glassy-workspace animate-fade-in">
            <div className="workspace-header">
                <div className="header-left">
                    <button onClick={onClose} className="back-btn">← BACK</button>
                    <span className="breadcrumb">{ticket.ticket_number} <strong>{ticket.title}</strong></span>
                </div>
                <div className="header-right">
                    <button
                        className="header-action-btn"
                        onClick={() => setIsAuditModalOpen(true)}
                    >
                        TICKET LOG
                    </button>
                    <span className={`status-pill ${ticket.status.toLowerCase().replace(' ', '-')}`}>
                        {ticket.status.toUpperCase()}
                    </span>
                </div>
            </div>

            <div className="workspace-grid">
                {/* Left: Context */}
                <div className="workspace-col col-left">
                    <TicketContextPanel ticket={ticket} user={user} assets={assets} />
                </div>

                {/* Middle: Conversation */}
                <div className="workspace-col col-main">
                    <TicketConversation
                        ticketId={ticket.ticket_id}
                        comments={comments}
                        audit={audit}
                        onCommentAdded={onCommentAdded}
                    />
                </div>

                {/* Right: Actions */}
                <div className="workspace-col col-right">
                    <TicketActionPanel
                        ticket={ticket}
                        user={user}
                        onUpdate={onTicketUpdated}
                    />
                </div>
            </div>

            <AuditLogModal
                isOpen={isAuditModalOpen}
                onClose={() => setIsAuditModalOpen(false)}
                audit={audit}
                user={user}
            />

            <style>{`
        .glassy-workspace {
            display: flex;
            flex-direction: column;
            height: 100vh;
            max-height: 100vh;
            background: radial-gradient(circle at top left, #1e293b, #0f172a);
            color: #f8fafc;
            overflow: hidden;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .workspace-header {
            height: 64px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 2rem;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(20px);
            z-index: 10;
        }

        .header-left, .header-right {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .header-action-btn {
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.2);
            color: #60a5fa;
            font-size: 0.65rem;
            font-weight: 900;
            padding: 0.4rem 0.8rem;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            letter-spacing: 0.05em;
        }
        .header-action-btn:hover {
            background: rgba(59, 130, 246, 0.2);
            border-color: #3b82f6;
            color: white;
            transform: translateY(-1px);
        }

        .workspace-grid {
            flex: 1;
            display: grid;
            grid-template-columns: 280px 1fr 280px;
            gap: 1px;
            background: rgba(255,255,255,0.03);
            overflow: hidden;
        }

        .workspace-col {
            background: rgba(15, 23, 42, 0.2); 
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .workspace-col.col-main {
            background: transparent;
        }

        .back-btn {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: #94a3b8;
            font-weight: 600;
            font-size: 0.75rem;
            cursor: pointer;
            margin-right: 0.5rem;
            padding: 0.4rem 0.8rem;
            border-radius: 6px;
            transition: all 0.2s;
        }
        .back-btn:hover { color: white; background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }

        .breadcrumb {
            color: #94a3b8;
            font-weight: 500;
            font-size: 0.85rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 500px;
            display: inline-block;
            vertical-align: middle;
        }
        .breadcrumb strong { color: #f8fafc; font-weight: 600; margin-left: 0.5rem; }

        .status-pill {
            font-size: 0.7rem;
            font-weight: 800;
            padding: 0.4rem 1rem;
            border-radius: 6px;
            color: white;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }
        .status-new { background: linear-gradient(to bottom right, #3b82f6, #2563eb); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
        .status-in-progress { background: linear-gradient(to bottom right, #f59e0b, #d97706); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); }
        .status-resolved { background: linear-gradient(to bottom right, #10b981, #059669); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); }
        .status-closed { background: #475569; }

        .animate-fade-in { animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 1100px) {
            .glassy-workspace {
                height: auto;
                max-height: none;
                overflow-y: auto;
            }
            .workspace-grid {
                display: flex;
                flex-direction: column;
                height: auto;
                overflow: visible;
            }
            .workspace-col {
                height: auto;
                max-height: none;
                overflow: visible;
            }
            .workspace-col.col-main {
                min-height: 500px;
                order: 2;
            }
            .workspace-col.col-left {
                order: 1;
            }
            .workspace-col.col-right {
                order: 3;
            }
        }
      `}</style>
        </div>
    );
};

export default GlassyTicketLayout;
