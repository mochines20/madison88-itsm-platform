import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const LOCATION_TIMEZONES = {
    'Philippines': 'Asia/Manila',
    'Indonesia': 'Asia/Jakarta',
    'China': 'Asia/Shanghai',
    'US': 'America/New_York',
    'Default': 'UTC'
};

const LocalClock = ({ location }) => {
    const [time, setTime] = useState(new Date());
    const tz = LOCATION_TIMEZONES[location] || LOCATION_TIMEZONES['Default'];

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const localTimeStr = time.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
    const hour = parseInt(time.toLocaleTimeString('en-US', { timeZone: tz, hour12: false, hour: '2-digit' }));
    const isOfficeHours = hour >= 8 && hour < 17;

    return (
        <div className="local-clock">
            <span className="clock-time">{localTimeStr}</span>
            <span className={`office-status ${isOfficeHours ? 'open' : 'closed'}`}>
                {isOfficeHours ? 'OFFICE OPEN' : 'AFTER HOURS'}
            </span>
        </div>
    );
};

const TicketContextPanel = ({ ticket, user, assets }) => {
    if (!ticket) return null;

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
        // Calculate percentage if not provided
        return { text: 'ON TRACK', color: '#10b981' };
    };

    const sla = getSlaStatus(ticket);

    return (
        <div className="ticket-context-panel glass">
            {/* Header Info */}
            <div className="panel-section">
                <div className="ticket-id-row">
                    <span className="ticket-id">{ticket.ticket_number}</span>
                    <span className={`status-badge status-${ticket.status.toLowerCase().replace(' ', '-')}`}>
                        {ticket.status.toUpperCase()}
                    </span>
                </div>
                <h2 className="ticket-title">{ticket.title}</h2>
                <div className="priority-tag" style={{ backgroundColor: getPriorityColor(ticket.priority) }}>
                    {ticket.priority} - {ticket.category}
                </div>
            </div>

            {/* SLA Timer */}
            <div className="panel-section sla-section" style={{ borderLeft: `3px solid ${sla.color}` }}>
                <h4 style={{ color: sla.color }}>SLA STATUS: {sla.text}</h4>
                <div className="sla-details">
                    <div>
                        <small>Response Due</small>
                        <span>{ticket.sla_response_due ? new Date(ticket.sla_response_due).toLocaleString() : 'N/A'}</span>
                    </div>
                    <div>
                        <small>Resolution Due</small>
                        <span>{ticket.sla_due_date ? new Date(ticket.sla_due_date).toLocaleString() : 'N/A'}</span>
                    </div>
                </div>
            </div>

            {/* Requester Info */}
            <div className="panel-section">
                <h3>REQUESTER</h3>
                <div className="user-profile-mini">
                    <div className="avatar-placeholder">{ticket.user_name?.charAt(0) || 'U'}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <strong>{ticket.user_name || 'Unknown User'}</strong>
                        <p>{ticket.user_email}</p>
                        <div className="location-row">
                            <p className="sub-text">{ticket.location || 'Unknown Location'}</p>
                            <LocalClock location={ticket.location} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Description */}
            <div className="panel-section">
                <h3>DESCRIPTION</h3>
                <div
                    className="description-text"
                    dangerouslySetInnerHTML={{ __html: ticket.description }}
                />
            </div>

            {/* Business Impact */}
            <div className="panel-section">
                <h3>BUSINESS IMPACT</h3>
                <div
                    className="impact-text"
                    dangerouslySetInnerHTML={{ __html: ticket.business_impact }}
                />
            </div>

            {/* Assets */}
            {assets && assets.length > 0 && (
                <div className="panel-section">
                    <h3>RELATED ASSETS</h3>
                    <ul className="asset-list">
                        {assets.map(asset => (
                            <li key={asset.asset_id}>
                                <Link to={`/assets/${asset.asset_id}`}>{asset.name}</Link>
                                <span className="asset-tag">{asset.type}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <style>{`
        .ticket-context-panel {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            padding: 1.5rem;
            color: #cbd5e1;
            overflow-y: auto;
            max-height: 100%;
        }
        
        .panel-section {
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
        }

        .ticket-id-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .ticket-id { font-family: 'JetBrains Mono', monospace; color: #475569; font-weight: 700; font-size: 0.8rem; letter-spacing: -0.02em; }
        
        .status-badge {
            font-size: 0.6rem;
            font-weight: 800;
            padding: 0.15rem 0.5rem;
            border-radius: 4px;
            background: rgba(255,255,255,0.06);
            color: #94a3b8;
            border: 1px solid rgba(255,255,255,0.1);
        }

        .ticket-title {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 800;
            color: #f8fafc;
            line-height: 1.2;
            letter-spacing: -0.01em;
            word-break: break-word;
            overflow-wrap: break-word;
        }

        .priority-tag {
            align-self: flex-start;
            padding: 0.25rem 0.6rem;
            border-radius: 6px;
            font-size: 0.65rem;
            font-weight: 800;
            color: white;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .sla-section {
            background: linear-gradient(to right, rgba(0,0,0,0.3), transparent);
            padding: 1rem;
            border-radius: 8px;
            border-left: 3px solid;
            position: relative;
            overflow: hidden;
        }
        .sla-section::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            height: 2px;
            width: 70%;
            background: currentColor;
            opacity: 0.2;
        }
        .sla-section h4 { margin: 0 0 0.8rem 0; font-size: 0.7rem; font-weight: 900; letter-spacing: 0.1em; }
        
        .sla-details { display: grid; grid-template-columns: 1fr; gap: 1rem; }
        .sla-details div { display: flex; flex-direction: column; gap: 0.2rem; }
        .sla-details small { font-size: 0.65rem; color: #475569; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; }
        .sla-details span { font-size: 0.85rem; color: #cbd5e1; font-weight: 500; }

        h3 { 
            font-size: 0.7rem; 
            font-weight: 900; 
            color: #475569; 
            margin: 0; 
            letter-spacing: 0.15em; 
            text-transform: uppercase;
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        h3::after { content: ''; height: 1px; flex: 1; background: rgba(255,255,255,0.05); }

        .user-profile-mini {
            display: flex;
            gap: 1.2rem;
            align-items: center;
            background: rgba(255,255,255,0.02);
            padding: 1rem;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.05);
        }
        .avatar-placeholder {
            width: 42px;
            height: 42px;
            background: linear-gradient(135deg, #475569, #1e293b);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 1rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .user-profile-mini strong { display: block; color: #f1f5f9; font-size: 0.95rem; font-weight: 700; margin-bottom: 0.1rem; overflow-wrap: anywhere; word-break: break-all; }
        .user-profile-mini p { margin: 0; font-size: 0.8rem; color: #64748b; overflow-wrap: anywhere; word-break: break-all; }
        .user-profile-mini .sub-text { font-size: 0.75rem; color: #475569; font-weight: 600; margin-top: 0.2rem; }

        .description-text, .impact-text {
            font-size: 0.95rem;
            line-height: 1.6;
            color: #94a3b8;
            background: rgba(0,0,0,0.2);
            padding: 1.2rem;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.03);
            word-break: break-word;
            overflow-wrap: break-word;
        }
        .description-text p, .impact-text p { margin-top: 0; }
        .description-text p:last-child, .impact-text p:last-child { margin-bottom: 0; }

        .asset-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        .asset-list li {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.8rem;
            background: rgba(255,255,255,0.02);
            border-radius: 8px;
            font-size: 0.9rem;
            border: 1px solid rgba(255,255,255,0.03);
        }
        .asset-list a { color: #3b82f6; text-decoration: none; font-weight: 600; }
        .asset-list a:hover { text-decoration: underline; }
        .asset-tag { font-size: 0.65rem; color: #64748b; background: rgba(255,255,255,0.05); padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 800; text-transform: uppercase; }

        .location-row { 
            display: flex; 
            flex-direction: column;
            align-items: flex-start; 
            gap: 0.8rem;
            margin-top: 1rem; 
            width: 100%; 
        }
        .local-clock { 
            display: flex; 
            align-items: center; 
            justify-content: space-between;
            width: 100%;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.05);
            padding: 0.5rem 0.8rem;
            border-radius: 8px;
        }
        .clock-time { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #f8fafc; font-weight: 700; }
        .office-status { font-size: 0.6rem; font-weight: 900; padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 0.05em; }
        .office-status.open { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .office-status.closed { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

      `}</style>
        </div>
    );
};

export default TicketContextPanel;
