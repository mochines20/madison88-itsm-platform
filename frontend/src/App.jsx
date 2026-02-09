import React, { useEffect, useState } from "react";
import brandLogo from "./assets/Madison-88-Logo-250.png";
import LoginPage from "./pages/LoginPage";
import TicketsPage from "./pages/TicketsPage";
import NewTicketPage from "./pages/NewTicketPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import KnowledgeBaseEditor from "./pages/KnowledgeBaseEditor";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminSlaPage from "./pages/AdminSlaPage";
import ChangeManagementPage from "./pages/ChangeManagementPage";
import AssetsPage from "./pages/AssetsPage";
import AdvancedReportingPage from "./pages/AdvancedReportingPage";
import UserDashboard from "./pages/dashboards/UserDashboard";
import AgentDashboard from "./pages/dashboards/AgentDashboard";
import ManagerDashboard from "./pages/dashboards/ManagerDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [viewMode, setViewMode] = useState("my");
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        localStorage.removeItem("user");
      }
    }
  }, []);

  useEffect(() => {
    if (user?.role && user.role !== "end_user" && activeTab === "new") {
      setActiveTab("tickets");
    }
  }, [user, activeTab]);

  const handleLogin = (jwt, userInfo) => {
    setToken(jwt);
    setUser(userInfo);
    localStorage.setItem("token", jwt);
    localStorage.setItem("user", JSON.stringify(userInfo));
  };

  if (!token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const isAgent = user?.role === "it_agent";
  const isManager = user?.role === "it_manager";
  const isAdmin = user?.role === "system_admin";

  const roleClass = user?.role ? `role-${user.role}` : "";

  const navItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "tickets", label: isAgent ? "Assigned Tickets" : "Tickets" },
    ...(isManager || isAdmin ? [{ key: "team", label: "Team Queue" }] : []),
    ...(user?.role === "end_user" ? [{ key: "new", label: "New Ticket" }] : []),
    { key: "kb", label: "Knowledge Base" },
    ...(isManager || isAdmin ? [{ key: "kb-editor", label: "KB Editor" }] : []),
    ...(isManager || isAdmin
      ? [{ key: "advanced-reporting", label: "Advanced Reporting" }]
      : []),
    ...(isManager || isAdmin
      ? [{ key: "changes", label: "Change Management" }]
      : []),
    ...(isAgent || isManager || isAdmin
      ? [{ key: "assets", label: "Asset Tracking" }]
      : []),
    ...(isAdmin ? [{ key: "admin-users", label: "User Management" }] : []),
    ...(isAdmin ? [{ key: "sla-standards", label: "SLA Standards" }] : []),
  ];

  const renderDashboard = () => {
    if (isAdmin) return <AdminDashboard />;
    if (isManager) return <ManagerDashboard />;
    if (isAgent) return <AgentDashboard />;
    return <UserDashboard />;
  };

  const headerTitle = {
    dashboard: "Dashboard",
    tickets: "Tickets",
    team: "Team Queue",
    new: "Create Ticket",
    kb: "Knowledge Base",
    "kb-editor": "KB Editor",
    "advanced-reporting": "Advanced Reporting",
    changes: "Change Management",
    assets: "Asset Tracking",
    "admin-users": "User Management",
    "sla-standards": "SLA Standards",
  };

  return (
    <div className={`app-shell ${roleClass}`}>
      <aside className="sidebar">
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
            <button
              key={item.key}
              className={
                activeTab === item.key ? "nav-item active" : "nav-item"
              }
              onClick={() => setActiveTab(item.key)}
            >
              {item.label}
            </button>
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
            onClick={() => {
              setToken("");
              setUser(null);
              localStorage.removeItem("token");
              localStorage.removeItem("user");
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <div>
            <h2>{headerTitle[activeTab] || "Dashboard"}</h2>
            <p>Prioritize, track, and resolve requests across regions.</p>
          </div>
        </header>
        {activeTab === "dashboard" && renderDashboard()}
        {(activeTab === "tickets" || activeTab === "team") && (
          <div className="tickets-layout">
            <TicketsPage
              refreshKey={refreshKey}
              user={user}
              viewMode={activeTab === "team" ? "team" : viewMode}
              onViewModeChange={setViewMode}
              selectedId={selectedTicketId}
              onSelectTicket={setSelectedTicketId}
            />
            <TicketDetailPage
              ticketId={selectedTicketId}
              user={user}
              onClose={() => setSelectedTicketId(null)}
              onUpdated={() => setRefreshKey((prev) => prev + 1)}
            />
          </div>
        )}
        {activeTab === "new" && (
          <NewTicketPage
            onCreated={(ticket) => {
              setActiveTab("tickets");
              setSelectedTicketId(ticket.ticket_id);
              setRefreshKey((prev) => prev + 1);
            }}
          />
        )}
        {activeTab === "kb" && <KnowledgeBasePage user={user} />}
        {activeTab === "kb-editor" && (isManager || isAdmin) && (
          <KnowledgeBaseEditor />
        )}
        {activeTab === "advanced-reporting" && <AdvancedReportingPage />}
        {activeTab === "changes" && <ChangeManagementPage user={user} />}
        {activeTab === "assets" && <AssetsPage user={user} />}
        {activeTab === "admin-users" && <AdminUsersPage />}
        {activeTab === "sla-standards" && <AdminSlaPage />}
      </main>
    </div>
  );
}

export default App;
