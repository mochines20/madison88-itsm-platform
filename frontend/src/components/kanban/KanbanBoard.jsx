import React from "react";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import KanbanCard from "./KanbanCard";

const COLUMNS = [
    { id: "New", title: "New" },
    { id: "In Progress", title: "In Progress" },
    { id: "Pending", title: "Pending" },
    { id: "Resolved", title: "Resolved" }
];

const KanbanBoard = ({ tickets, onDragEnd }) => {
    const getTicketsByStatus = (status) => {
        return tickets.filter(t => t.status === status);
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="kanban-container">
                {COLUMNS.map(column => (
                    <div key={column.id} className="kanban-column" data-status={column.id}>
                        <div className="kanban-column-header">
                            <h3>{column.title}</h3>
                            <span className="kanban-column-count">{getTicketsByStatus(column.id).length}</span>
                        </div>
                        <Droppable droppableId={column.id}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`kanban-ticket-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                                >
                                    {getTicketsByStatus(column.id).map((ticket, index) => (
                                        <KanbanCard key={ticket.ticket_id} ticket={ticket} index={index} />
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                ))}
            </div>
        </DragDropContext>
    );
};

export default KanbanBoard;
