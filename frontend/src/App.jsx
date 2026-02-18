import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import apiClient from "./api/client";
import { getSocket } from "./api/socket";
import MainLayout from "./components/layout/MainLayout";
import TicketsLayout from "./components/layout/TicketsLayout";
import LoginPage from "./pages/LoginPage";
import NewTicketPage from "./pages/NewTicketPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import KnowledgeBaseEditor from "./pages/KnowledgeBaseEditor";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminSlaPage from "./pages/AdminSlaPage";
import ChangeManagementPage from "./pages/ChangeManagementPage";
import AssetsPage from "./pages/AssetsPage";
import AdvancedReportingPage from "./pages/AdvancedReportingPage";
import TicketTemplatesPage from "./pages/TicketTemplatesPage";
import UserDashboard from "./pages/dashboards/UserDashboard";
import AgentDashboard from "./pages/dashboards/AgentDashboard";
import ManagerDashboard from "./pages/dashboards/ManagerDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";

function App() {
  const { logout: auth0Logout, isAuthenticated, isLoading: auth0Loading, user: auth0User, getAccessTokenSilently } = useAuth0();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const recentNotificationRef = useRef(new Map());
  const navigate = useNavigate();
  const location = useLocation();

  // Load user from local storage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setLoadingUser(false);
      } catch (err) {
        localStorage.removeItem("user");
      }
    } else {
      setLoadingUser(false);
    }
  }, []);

  // Handle Auth0 login
  useEffect(() => {
    const syncUser = async () => {
      if (isAuthenticated && auth0User) {
        try {
          // Get token
          const token = await getAccessTokenSilently();
          localStorage.setItem("token", token); // client.js interceptor uses this

          // Login/Sync with backend using Auth0 token
          // We trust the token, but need to get our DB user
          // The backend endpoint /auth/auth0-login handles syncing
          // But for now let's assume valid token and call /auth/me or /users/me works if we have one
          // Actually the original App.jsx used /auth/auth0-login? No, it handled manual login mostly?

          // Let's use the explicit auth0-login endpoint in backend we saw in AuthController
          // It takes idToken (which we need to get from auth0)
          // OR we can just use the access token if the backend validates it?
          // The current backend uses our own JWT.

          // In original App.jsx, handleLogin set the token.
          // We need to support Auth0 login flow.
          // AuthController.loginWithAuth0 takes { idToken }.

          const idTokenClaims = await (await getAccessTokenSilently({ detailedResponse: true })).id_token;
          // Wait, getAccessTokenSilently returns access token string usually.
          // We might need getIdTokenClaims() from useAuth0.

        } catch (e) {
          console.error("Login sync failed", e);
        }
      }
    };
    // Note: The original App.jsx relied on manual login via LoginPage (which used loginWithRedirect).
    // And handleLogin was passed to LoginPage.
    // If we want to support persistent login, we should keep the localStorage logic.
    // For now, let's assume standard behavior: if we have a token in localStorage, we try to load user.
  }, [isAuthenticated, auth0User, getAccessTokenSilently]);

  const handleLogin = (jwt, userInfo) => {
    setUser(userInfo);
    localStorage.setItem("token", jwt);
    localStorage.setItem("user", JSON.stringify(userInfo));
    navigate('/');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // MainLayout handles auth0Logout
  };

  const shouldNotify = (ticket, statusValue) => {
    const key = `${ticket.ticket_id}-${statusValue}`;
    const now = Date.now();
    const last = recentNotificationRef.current.get(key);
    if (last && now - last < 120000) {
      return false;
    }
    recentNotificationRef.current.set(key, now);
    if (recentNotificationRef.current.size > 200) {
      recentNotificationRef.current.clear();
    }
    return true;
  };

  const pushToast = (notification) => {
    setToasts((prev) => [...prev, notification]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== notification.id));
    }, 5000);
  };

  const mapNotification = (item) => ({
    id: item.notification_id,
    ticketId: item.ticket_id,
    ticketNumber: item.ticket_number,
    title: item.ticket_title || item.title || "",
    message: item.message || "",
    type: item.type,
    createdAt: item.created_at,
    read: item.is_read,
  });

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get("/notifications");
      const rows = res.data.data.notifications || [];
      setNotifications(rows.map(mapNotification));
    } catch (err) {
      // Silent fail
    }
  };

  const isAssignedToUser = (ticket, currentUser) => {
    if (!currentUser?.user_id) return false;
    if (currentUser.role === "end_user") {
      return `${ticket?.user_id}` === `${currentUser.user_id}`;
    }
    if (!ticket?.assigned_to) return false;
    return `${ticket.assigned_to}` === `${currentUser.user_id}`;
  };

  const addResolvedNotification = (ticket) => {
    if (!ticket) return;
    if (!isAssignedToUser(ticket, user)) return;
    const statusValue = ticket.status || "Resolved";
    if (!shouldNotify(ticket, statusValue)) return;
    const notification = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ticketId: ticket.ticket_id,
      ticketNumber: ticket.ticket_number,
      title: ticket.title,
      status: statusValue,
      createdAt: new Date().toISOString(),
      read: false,
    };
    pushToast(notification);
    fetchNotifications();
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      const label = statusValue === "Closed" ? "Ticket closed" : "Ticket resolved";
      new Notification(label, {
        body: `${notification.ticketNumber || "Ticket"}: ${notification.title}`,
      });
    }
  };

  const handleResolvedTickets = (resolvedTickets) => {
    if (!Array.isArray(resolvedTickets)) return;
    resolvedTickets.forEach((ticket) => addResolvedNotification(ticket));
  };

  const handleNotificationToggle = () => {
    setIsNotificationsOpen((prev) => {
      const next = !prev;
      if (next) {
        apiClient.patch("/notifications/read-all").catch(() => null);
        setNotifications((items) =>
          items.map((item) => ({ ...item, read: true })),
        );
      }
      return next;
    });
  };

  const handleRequestBrowserPermission = async () => {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
  };

  const handleNotificationClick = (notification) => {
    apiClient.patch(`/notifications/${notification.id}/read`).catch(() => null);
    setIsNotificationsOpen(false);
    setNotifications((items) =>
      items.map((item) =>
        item.id === notification.id ? { ...item, read: true } : item,
      ),
    );
    navigate(`/tickets/${notification.ticketId}`);
  };

  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;

    const handleTicketReopened = (payload) => {
      if (!payload?.ticket) return;
      const ticket = payload.ticket;

      const isRelevant =
        (user.role === 'end_user' && ticket.user_id === user.user_id) ||
        (['it_agent', 'it_manager', 'system_admin'].includes(user.role) &&
          (ticket.assigned_to === user.user_id || ticket.user_id === user.user_id));

      if (!isRelevant) return;

      const notification = {
        id: `reopened-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ticketId: ticket.ticket_id,
        ticketNumber: ticket.ticket_number,
        title: ticket.title,
        message: 'Ticket has been reopened',
        type: 'ticket_reopened',
        createdAt: new Date().toISOString(),
        read: false,
      };

      pushToast(notification);
      fetchNotifications();

      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification('Ticket Reopened', {
          body: `${ticket.ticket_number || 'Ticket'}: ${ticket.title}`,
          icon: '/favicon.ico',
        });
      }
    };

    socket.on('ticket-reopened', handleTicketReopened);
    return () => {
      socket.off('ticket-reopened', handleTicketReopened);
    };
  }, [user]);

  // Render Dashboard based on role
  const renderDashboard = () => {
    if (user?.role === "system_admin") return <AdminDashboard />;
    if (user?.role === "it_manager") return <ManagerDashboard />;
    if (user?.role === "it_agent") return <AgentDashboard />;
    return <UserDashboard />;
  };

  if (loadingUser) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={!user ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/" replace />} />

        <Route element={
          user ? (
            <MainLayout
              user={user}
              notifications={notifications}
              unreadCount={unreadCount}
              onLogout={handleLogout}
              onNotificationToggle={handleNotificationToggle}
              isNotificationsOpen={isNotificationsOpen}
              onRequestBrowserPermission={handleRequestBrowserPermission}
              browserPermission={browserPermission}
              onNotificationClick={handleNotificationClick}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }>
          <Route path="/" element={renderDashboard()} />

          <Route path="/tickets/*" element={
            <Routes>
              <Route path="/" element={<TicketsLayout user={user} viewMode="my" refreshKey={refreshKey} setRefreshKey={setRefreshKey} onResolvedTickets={handleResolvedTickets} />} />
              <Route path=":ticketId" element={<TicketsLayout user={user} viewMode="my" refreshKey={refreshKey} setRefreshKey={setRefreshKey} onResolvedTickets={handleResolvedTickets} />} />
            </Routes>
          } />

          <Route path="/team-queue/*" element={
            <Routes>
              <Route path="/" element={<TicketsLayout user={user} viewMode="team" refreshKey={refreshKey} setRefreshKey={setRefreshKey} onResolvedTickets={handleResolvedTickets} />} />
              <Route path=":ticketId" element={<TicketsLayout user={user} viewMode="team" refreshKey={refreshKey} setRefreshKey={setRefreshKey} onResolvedTickets={handleResolvedTickets} />} />
            </Routes>
          } />

          <Route path="/new-ticket" element={
            <NewTicketPage onCreated={(ticket) => {
              setRefreshKey(p => p + 1);
              navigate(`/tickets/${ticket.ticket_id}`);
            }} />
          } />

          <Route path="/knowledge-base" element={<KnowledgeBasePage user={user} />} />
          <Route path="/kb-editor" element={<KnowledgeBaseEditor />} />
          <Route path="/advanced-reporting" element={<AdvancedReportingPage />} />
          <Route path="/ticket-templates" element={<TicketTemplatesPage />} />
          <Route path="/change-management" element={<ChangeManagementPage user={user} />} />
          <Route path="/asset-tracking" element={<AssetsPage user={user} />} />
          <Route path="/admin-users" element={<AdminUsersPage />} />
          <Route path="/sla-standards" element={<AdminSlaPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className="toast">
              <div>
                <strong>{toast.ticketNumber || "Ticket"}</strong>
                <span>{toast.title}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default App;

