import React, { useState } from "react";
import { Link, useLocation, Navigate, Outlet } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import brandLogo from "../../assets/Madison-88-Logo-250.png";
import apiClient from "../../api/client";

const MainLayout = ({ user, notifications = [], unreadCount = 0, onLogout, onNotificationToggle, isNotificationsOpen, onRequestBrowserPermission, browserPermission, onNotificationClick }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const { logout: auth0Logout } = useAuth0();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const isAgent = user?.role === "it_agent";
    const isManager = user?.role === "it_manager";
    const isAdmin = user?.role === "system_admin";
    const roleClass = user?.role ? `role-${user.role}` : "";

    const navItems = [
        { path: "/", label: "Dashboard" },
        { path: "/tickets", label: isAgent ? "Assigned Tickets" : "Tickets" },
        ...(isManager || isAdmin ? [{ path: "/team-queue", label: "Team Queue" }] : []),
        ...(user?.role === "end_user" ? [{ path: "/new-ticket", label: "New Ticket" }] : []),
        { path: "/knowledge-base", label: "Knowledge Base" },
        ...(isManager || isAdmin ? [{ path: "/kb-editor", label: "KB Editor" }] : []),
        ...(isManager || isAdmin
            ? [{ path: "/advanced-reporting", label: "Advanced Reporting" }]
            : []),
        ...(isManager || isAdmin
            ? [{ path: "/ticket-templates", label: "Ticket Templates" }]
            : []),
        ...(isManager || isAdmin
            ? [{ path: "/change-management", label: "Change Management" }]
            : []),
        ...(isAgent || isManager || isAdmin
            ? [{ path: "/asset-tracking", label: "Asset Tracking" }]
            : []),
        ...(isAdmin ? [{ path: "/admin-users", label: "User Management" }] : []),
        ...(isAdmin ? [{ path: "/sla-standards", label: "SLA Standards" }] : []),
    ];

    const getHeaderTitle = () => {
        const currentPath = location.pathname;
        if (currentPath === "/") return "Dashboard";
        if (currentPath.startsWith("/tickets")) return "Tickets";
        if (currentPath.startsWith("/team-queue")) return "Team Queue";
        if (currentPath.startsWith("/new-ticket")) return "Create Ticket";
        if (currentPath.startsWith("/knowledge-base")) return "Knowledge Base";
        if (currentPath.startsWith("/kb-editor")) return "KB Editor";
        if (currentPath.startsWith("/advanced-reporting")) return "Advanced Reporting";
        if (currentPath.startsWith("/ticket-templates")) return "Ticket Templates";
        if (currentPath.startsWith("/change-management")) return "Change Management";
        if (currentPath.startsWith("/asset-tracking")) return "Asset Tracking";
        if (currentPath.startsWith("/admin-users")) return "User Management";
        if (currentPath.startsWith("/sla-standards")) return "SLA Standards";
        return "Dashboard";
    };

    const handleLogout = () => {
        if (onLogout) onLogout();
        auth0Logout({ logoutParams: { returnTo: window.location.origin } });
    };

    return (
        <div className={`app-shell ${roleClass}`}>
            <button
                className="mobile-menu-toggle"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label="Toggle menu"
            >
                <span></span>
                <span></span>
                <span></span>
            </button>
            <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
                <div className="brand">
                    <img
                        className="brand-logo"
                        src={brandLogo}
                        alt="Madison88"
                    />
                    <div>
                        <h1>Madison88 ITSM</h1>
                        <p>Service Desk</p>
                    </div>
                </div>
                <nav className="nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={
                                location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path))
                                    ? "nav-item active"
                                    : "nav-item"
                            }
                            onClick={() => setIsSidebarOpen(false)}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <div className="user-card">
                        <div>
                            <strong>{user?.full_name || "User"}</strong>
                            <span className="role-pill">{user?.role}</span>
                        </div>
                    </div>
                    <button
                        className="btn ghost"
                        onClick={handleLogout}
                    >
                        Logout
                    </button>
                </div>
            </aside>
            {isSidebarOpen && (
                <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
            )}
            <main className="content">
                <header className="topbar">
                    <div>
                        <h2>{getHeaderTitle()}</h2>
                        <p>Prioritize, track, and resolve requests across regions.</p>
                    </div>
                    <div className="topbar-actions">
                        <button
                            className="notification-button"
                            onClick={onNotificationToggle}
                            aria-label="Notifications"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                role="img"
                                aria-hidden="true"
                                focusable="false"
                            >
                                <path d="M12 22a2.5 2.5 0 0 0 2.4-1.8h-4.8A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z" />
                            </svg>
                            {unreadCount > 0 && (
                                <span className="notification-count">{unreadCount}</span>
                            )}
                        </button>
                        {isNotificationsOpen && (
                            <div className="notification-popover">
                                <div className="notification-header">Notifications</div>
                                {typeof Notification !== "undefined" &&
                                    browserPermission !== "granted" && (
                                        <div className="notification-permission">
                                            <p className="muted">
                                                Enable browser notifications for resolved tickets.
                                            </p>
                                            <button
                                                className="btn ghost small"
                                                onClick={onRequestBrowserPermission}
                                            >
                                                Enable notifications
                                            </button>
                                        </div>
                                    )}
                                {notifications.length === 0 ? (
                                    <p className="muted">No notifications yet.</p>
                                ) : (
                                    <div className="notification-list">
                                        {notifications.map((item) => (
                                            <button
                                                key={item.id}
                                                className="notification-item"
                                                onClick={() => onNotificationClick(item)}
                                            >
                                                <div>
                                                    <strong>
                                                        {item.ticketNumber || "Ticket"}
                                                    </strong>
                                                    <span>{item.message || item.title}</span>
                                                </div>
                                                <time>
                                                    {new Date(item.createdAt).toLocaleTimeString()}
                                                </time>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </header>

                <Outlet />

            </main>
        </div>
    );
};

export default MainLayout;
