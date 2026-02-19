import { io } from "socket.io-client";

const socketUrl = process.env.REACT_APP_API_URL || "ws://localhost:3000";
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
  if (!s) return () => { };
  s.on("dashboard-refresh", onRefresh);
  return () => s.off("dashboard-refresh", onRefresh);
}

/**
 * Subscribe to ticket-specific updates when viewing a ticket.
 */
export function subscribeTicket(ticketId, onUpdate, user = null) {
  const s = getSocket();
  if (!s || !ticketId) return () => { };
  s.emit("subscribe-ticket", { ticketId, user });
  const handler = (payload) => onUpdate(payload);
  s.on("ticket-updated", handler);
  s.on("ticket-created", handler);
  s.on("ticket-comment", handler);
  s.on("ticket-reopened", handler);
  s.on("ticket-confirmed", handler);
  return () => {
    s.emit("unsubscribe-ticket", ticketId);
    s.off("ticket-updated", handler);
    s.off("ticket-created", handler);
    s.off("ticket-comment", handler);
    s.off("ticket-reopened", handler);
    s.off("ticket-confirmed", handler);
  };
}

/**
 * Presence: Notify backend we are viewing a ticket
 */
export function joinTicket(ticketId, user) {
  const s = getSocket();
  if (s && ticketId && user) {
    s.emit("join-ticket", { ticketId, user });
  }
}

/**
 * Presence: Notify backend we stopped viewing a ticket
 */
export function leaveTicket(ticketId) {
  const s = getSocket();
  if (s && ticketId) {
    s.emit("leave-ticket", ticketId);
  }
}

/**
 * Presence: Listen for viewer updates
 */
export function onPresenceUpdate(onUpdate) {
  const s = getSocket();
  if (!s) return () => { };
  s.on("presence-update", onUpdate);
  return () => s.off("presence-update", onUpdate);
}
