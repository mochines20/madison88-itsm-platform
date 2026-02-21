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
  onAttachmentUploaded,
  onClose,
}) => {
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  return (
    <div className="glassy-workspace animate-fade-in">
      <div className="workspace-header">
        <div className="header-left">
          <button onClick={onClose} className="back-btn">
            ← BACK
          </button>
          <span className="breadcrumb">
            {ticket.ticket_number} <strong>{ticket.title}</strong>
          </span>
        </div>
        <div className="header-right">
          <button
            className="header-action-btn"
            onClick={() => setIsAuditModalOpen(true)}
          >
            TICKET LOG
          </button>
          <span
            className={`status-pill ${ticket.status.toLowerCase().replace(" ", "-")}`}
          >
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
            user={user}
            comments={comments}
            audit={audit}
            onCommentAdded={onCommentAdded}
            onAttachmentUploaded={onAttachmentUploaded}
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
            height: 100%; /* Fill the fixed 90vh container */
            background: rgba(10, 22, 53, 0.4); /* Transparent to show global bg */
            backdrop-filter: blur(40px);
            color: #f8fafc;
            overflow: hidden; /* Prevent workspace overflow */
            font-family: 'Sora', sans-serif;
            border-radius: 20px;
            box-shadow: 0 40px 100px rgba(0,0,0,0.6);
            border: 1px solid rgba(47, 215, 255, 0.2); /* High-fidelity border */
        }

        .workspace-header {
            height: 72px;
            flex: 0 0 auto; /* Fixed header */
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 2rem;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(20px);
            z-index: 10;
        }

        .header-left, .header-right {
            display: flex;
            align-items: center;
            gap: 1.5rem;
        }

        .header-action-btn {
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.2);
            color: #60a5fa;
            font-size: 0.7rem;
            font-weight: 700;
            padding: 0.5rem 1rem;
            border-radius: 8px;
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
            grid-template-columns: 280px 1fr 300px;
            gap: 0;
            overflow: hidden; /* Prevent grid overflow */
        }

        .workspace-col {
            background: transparent;
            overflow-y: auto; /* Enable independent scrolling */
            display: flex;
            flex-direction: column;
            padding: 0; /* Let children components handle their own padding */
            border-right: 1px solid rgba(255,255,255,0.05);
        }

        .workspace-col.col-right {
            border-right: none;
        }

        .workspace-col.col-main {
            background: rgba(255,255,255,0.02);
        }

        .back-btn {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: #94a3b8;
            font-weight: 600;
            font-size: 0.75rem;
            cursor: pointer;
            margin-right: 0.5rem;
            padding: 0.5rem 1rem;
            border-radius: 8px;
            transition: all 0.2s;
        }
        .back-btn:hover { color: white; background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }

        .breadcrumb {
            color: #94a3b8;
            font-weight: 500;
            font-size: 0.9rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 600px;
            display: inline-block;
            vertical-align: middle;
        }
        .breadcrumb strong { color: #f8fafc; font-weight: 600; margin-left: 0.5rem; }

        .status-pill {
            font-size: 0.75rem;
            font-weight: 700;
            padding: 0.5rem 1.25rem;
            border-radius: 8px;
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
                height: auto !important;
                max-height: none !important;
                overflow: visible !important;
            }
            .workspace-header {
                height: auto !important;
                padding: 1rem !important;
                flex-direction: column !important;
                align-items: flex-start !important;
                gap: 1rem !important;
            }
            .workspace-grid {
                display: flex !important;
                flex-direction: column !important;
                height: auto !important;
                overflow: visible !important;
                gap: 20px !important;
            }
            .workspace-col {
                height: auto !important;
                max-height: none !important;
                overflow: visible !important;
                background: rgba(15, 23, 42, 0.4) !important;
                border-radius: 12px !important;
                padding: 10px !important;
            }
            .workspace-col.col-main {
                min-height: auto !important;
                order: 2 !important;
            }
            .workspace-col.col-left {
                order: 1 !important;
            }
            .workspace-col.col-right {
                order: 3 !important;
            }
            .breadcrumb {
                max-width: 100% !important;
                white-space: normal !important;
            }
        }
      `}</style>
    </div>
  );
};

export default GlassyTicketLayout;
