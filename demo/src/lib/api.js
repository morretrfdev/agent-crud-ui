export const API_BASE =
  typeof window !== "undefined" && window.location.port === "5173"
    ? "http://127.0.0.1:8000"
    : "";

export const MAX_WINDOWS = 8;
export const WINDOW_W = 420;

export function getSessionId() {
  const existing = localStorage.getItem("crudSessionId");
  if (existing) return existing;
  const id = `web-${crypto.randomUUID()}`;
  localStorage.setItem("crudSessionId", id);
  return id;
}

export async function fetchSchema(entityKey) {
  const res = await fetch(`${API_BASE}/api/entities/${entityKey}/schema`);
  if (!res.ok) throw new Error(`schema ${entityKey}: ${res.status}`);
  return res.json();
}

export async function postChat(sessionId, message) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message }),
  });
  const data = await res.json();
  if (!res.ok) {
    const detail = data.detail || res.status;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}
