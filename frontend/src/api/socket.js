import { io } from "socket.io-client";

const socketUrl = process.env.REACT_APP_API_URL || (typeof window !== "undefined" ? window.location.origin : "");
let socket = null;

export function getSocket() {
  if (!socket && typeof window !== "undefined") {
    socket = io(socketUrl, {
      path: "/socket.io",
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

/**
 * Subscribe to dashboard-refresh events (e.g. after ticket create/update).
 * Call onRefresh when event is received. Returns unsubscribe function.
 */
export function onDashboardRefresh(onRefresh) {
  const s = getSocket();
  if (!s) return () => {};
  s.on("dashboard-refresh", onRefresh);
  return () => s.off("dashboard-refresh", onRefresh);
}

/**
 * Subscribe to ticket-specific updates when viewing a ticket.
 */
export function subscribeTicket(ticketId, onUpdate) {
  const s = getSocket();
  if (!s || !ticketId) return () => {};
  s.emit("subscribe-ticket", ticketId);
  const handler = (payload) => onUpdate(payload);
  s.on("ticket-updated", handler);
  s.on("ticket-created", handler);
  s.on("ticket-comment", handler);
  return () => {
    s.emit("unsubscribe-ticket", ticketId);
    s.off("ticket-updated", handler);
    s.off("ticket-created", handler);
    s.off("ticket-comment", handler);
  };
}
