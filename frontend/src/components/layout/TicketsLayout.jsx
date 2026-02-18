import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TicketsPage from '../../pages/TicketsPage';
import TicketDetailPage from '../../pages/TicketDetailPage';

const TicketsLayout = ({ user, viewMode, refreshKey, setRefreshKey, onResolvedTickets }) => {
    const navigate = useNavigate();
    const { ticketId } = useParams();

    // ticketId is a UUID string from the URL param
    const selectedTicketId = ticketId || null;

    const handleSelectTicket = (id) => {
        const basePath = viewMode === 'team' ? '/team-queue' : '/tickets';
        navigate(`${basePath}/${id}`);
    };

    const handleClose = () => {
        const basePath = viewMode === 'team' ? '/team-queue' : '/tickets';
        navigate(basePath);
    };

    return (
        <div className="tickets-layout">
            <TicketsPage
                refreshKey={refreshKey}
                user={user}
                viewMode={viewMode}
                onViewModeChange={(mode) => {
                    // If switching mode, navigate to the specific route
                    if (mode === 'team') navigate('/team-queue');
                    else navigate('/tickets');
                }}
                selectedId={selectedTicketId}
                onSelectTicket={handleSelectTicket}
                onResolvedTickets={onResolvedTickets}
            />
            {selectedTicketId && (
                <TicketDetailPage
                    ticketId={selectedTicketId}
                    user={user}
                    onClose={handleClose}
                    onUpdated={() => setRefreshKey((prev) => prev + 1)}
                    onResolved={onResolvedTickets}
                />
            )}
        </div>
    );
};

export default TicketsLayout;
