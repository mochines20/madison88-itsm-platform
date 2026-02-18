import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

const KanbanCard = ({ ticket, index }) => {
    const navigate = useNavigate();

    const getPriorityClass = (priority) => {
        switch (priority) {
            case "P1": return "badge-sla-breached";
            case "P2": return "badge-sla-warning";
            case "P3": return "badge-sla";
            default: return "badge-sla";
        }
    };

    const getSlaGlowClass = (ticket) => {
        if (ticket.status === "Resolved" || ticket.status === "Closed") return "";
        if (ticket.sla_breached) return "glow-danger";

        if (ticket.sla_due_date) {
            const due = new Date(ticket.sla_due_date).getTime();
            const now = new Date().getTime();
            const diff = due - now;
            const hoursLeft = diff / (1000 * 60 * 60);

            if (hoursLeft < 0) return "glow-danger";
            if (hoursLeft < 4) return "glow-warning"; // Less than 4 hours left
        }
        return "";
    };

    return (
        <Draggable draggableId={ticket.ticket_id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`kanban-card ${getSlaGlowClass(ticket)} ${snapshot.isDragging ? 'dragging' : ''}`}
                    data-priority={ticket.priority}
                    onClick={() => navigate(`/tickets/${ticket.ticket_id}`)}
                >
                    <div className="kanban-card-header">
                        <span className="kanban-card-id">{ticket.ticket_number}</span>
                        <div className={`status-pill ${getPriorityClass(ticket.priority)}`} style={{ textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>
                            {ticket.priority}
                        </div>
                    </div>
                    <h4 className="kanban-card-title">{ticket.title}</h4>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <span className="admin-label" style={{ fontSize: '9px', padding: '2px 8px', background: 'rgba(255,255,255,0.05)' }}>
                            {ticket.category || 'General'}
                        </span>
                    </div>
                    <div className="kanban-card-footer">
                        <div className="kanban-card-user">
                            <div className="kanban-card-avatar">
                                {ticket.assignee_name ? ticket.assignee_name.charAt(0) : "?"}
                            </div>
                            <span>{ticket.assignee_name || "Unassigned"}</span>
                        </div>
                        {ticket.sla_due_date && (
                            <span style={{ fontSize: '10px', color: ticket.sla_breached ? 'var(--danger)' : 'var(--slate-500)' }}>
                                {formatDistanceToNow(new Date(ticket.sla_due_date), { addSuffix: true })}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </Draggable>
    );
};

export default KanbanCard;
