/**
 * Live agent UI: chat → widget + canvas windows (multi, draggable).
 */

const API_BASE = window.location.port === "5173" ? "http://127.0.0.1:8000" : "";
const MAX_WINDOWS = 8;
const WINDOW_W = 420;

const messagesEl = document.getElementById("messages");
const composer = document.getElementById("composer");
const input = document.getElementById("input");
const workspace = document.getElementById("workspace");
const canvas = document.getElementById("canvas");
const canvasHint = document.getElementById("canvasHint");
const sendBtn = composer.querySelector(".send");

/** @type {Record<string, any>} */
const schemas = {
  organizations: {
    key: "organizations",
    title: "Организации",
    fields: [
      { key: "name", label: "Организация", type: "text" },
      { key: "id", label: "ID", type: "integer", readOnly: true },
      {
        key: "status",
        label: "Статус",
        type: "select",
        options: ["Одобрено", "Возвращено", "На рассмотрении", "Черновик"],
      },
    ],
  },
  users: {
    key: "users",
    title: "Пользователи",
    fields: [
      { key: "fullName", label: "ФИО", type: "text" },
      { key: "registeredAt", label: "Дата регистрации", type: "date" },
      { key: "id", label: "ID", type: "integer", readOnly: true },
    ],
  },
};

let busy = false;
let zCounter = 10;
let cascade = 0;
/** @type {Map<string, { id: string, el: HTMLElement, view: any }>} */
const windows = new Map();

const sessionId =
  localStorage.getItem("crudSessionId") ||
  (() => {
    const id = `web-${crypto.randomUUID()}`;
    localStorage.setItem("crudSessionId", id);
    return id;
  })();

async function loadSchemas() {
  for (const key of Object.keys(schemas)) {
    try {
      const res = await fetch(`${API_BASE}/api/entities/${key}/schema`);
      if (res.ok) schemas[key] = await res.json();
    } catch {
      /* keep fallback */
    }
  }
}

function schemaFor(view) {
  const key = view?.entity || "organizations";
  return schemas[key] || schemas.organizations;
}

function statusClass(status) {
  if (status === "Одобрено") return "ok";
  if (status === "Возвращено") return "bad";
  if (status === "Черновик") return "draft";
  return "wait";
}

function viewName(view) {
  if (!view) return "view: ?";
  if (view.type === "table") return `view: table · ${view.entity}`;
  if (view.type === "form") {
    const id = view.data?.id != null ? ` #${view.data.id}` : "";
    return `view: form · ${view.entity}${id}`;
  }
  return `view: ${view.type} · ${view.entity}`;
}

function windowTitle(view) {
  const schema = schemaFor(view);
  if (view.type === "table") {
    return view.title || schema.title || view.entity || "Таблица";
  }
  if (view.type === "form") {
    const id = view.data?.id != null ? ` #${view.data.id}` : "";
    return view.title || `${schema.title || view.entity || "Запись"}${id}`;
  }
  return viewName(view);
}

function scrollChatToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateCanvasHint() {
  canvasHint.hidden = windows.size > 0;
}

function bringToFront(id) {
  const win = windows.get(id);
  if (!win) return;
  zCounter += 1;
  win.el.style.zIndex = String(zCounter);
}

function nextPosition() {
  const rect = workspace.getBoundingClientRect();
  const pad = 24;
  const step = 28;
  const maxX = Math.max(pad, rect.width - WINDOW_W - pad);
  const maxY = Math.max(pad, rect.height - 200);
  const n = cascade % 8;
  cascade += 1;
  const x = Math.min(pad + n * step, maxX);
  const y = Math.min(pad + n * step, maxY);
  return { x, y };
}

function closeWindow(id) {
  const win = windows.get(id);
  if (!win) return;
  win.el.remove();
  windows.delete(id);
  updateCanvasHint();
}

function enableDrag(el, handle, id) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("button")) return;
    dragging = true;
    bringToFront(id);
    startX = e.clientX;
    startY = e.clientY;
    origLeft = parseFloat(el.style.left) || 0;
    origTop = parseFloat(el.style.top) || 0;
    handle.setPointerCapture(e.pointerId);
    el.classList.add("is-dragging");
    e.preventDefault();
  });

  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.left = `${Math.max(0, origLeft + dx)}px`;
    el.style.top = `${Math.max(0, origTop + dy)}px`;
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove("is-dragging");
    try {
      handle.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
}

function renderTableInto(container, view) {
  const schema = schemaFor(view);
  const fields = schema.fields || [];
  const table = document.createElement("table");
  table.className = "table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const field of fields) {
    const th = document.createElement("th");
    th.textContent = field.label || field.key;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  const rows = Array.isArray(view.data) ? view.data : [];

  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const field of fields) {
      const td = document.createElement("td");
      const value = row[field.key] ?? "";
      if (field.key === "status") {
        const badge = document.createElement("span");
        badge.className = `badge ${statusClass(value)}`;
        badge.textContent = value;
        td.appendChild(badge);
      } else {
        td.textContent = value;
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  table.append(thead, tbody);
  container.appendChild(table);
}

function renderFormInto(container, view) {
  const schema = schemaFor(view);
  const row = view.data || {};
  const form = document.createElement("div");
  form.className = "form-grid";
  const fields = schema.fields || [];

  for (const field of fields) {
    const box = document.createElement("div");
    box.className = "field";
    const lab = document.createElement("label");
    lab.textContent = field.label || field.key;
    box.appendChild(lab);

    if (field.type === "select") {
      const select = document.createElement("select");
      for (const opt of field.options || []) {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        if (opt === row[field.key]) o.selected = true;
        select.appendChild(o);
      }
      box.appendChild(select);
    } else {
      const el = document.createElement("input");
      el.type = field.type === "date" ? "date" : "text";
      el.value = row[field.key] ?? "";
      if (field.readOnly) el.readOnly = true;
      box.appendChild(el);
    }
    form.appendChild(box);
  }

  container.appendChild(form);
}

function viewKey(view) {
  if (!view) return "";
  const entity = view.entity || "";
  if (view.type === "table") {
    const slot = view.source?.slot || "list";
    const filter = view.source?.filters
      ? JSON.stringify(view.source.filters)
      : "";
    return `table:${entity}:${slot}:${filter}`;
  }
  if (view.type === "form") {
    const id = view.data?.id != null ? String(view.data.id) : "new";
    return `form:${entity}:${id}`;
  }
  return `${view.type}:${entity}`;
}

function findWindowByViewKey(key) {
  for (const win of windows.values()) {
    if (win.viewKey === key) return win;
  }
  return null;
}

function fillWindowBody(body, view) {
  body.replaceChildren();
  if (view.type === "table") renderTableInto(body, view);
  else renderFormInto(body, view);
}

function openWindow(view) {
  if (!view || (view.type !== "table" && view.type !== "form")) return null;

  const key = viewKey(view);
  const existing = findWindowByViewKey(key);
  if (existing) {
    existing.view = view;
    const titleEl = existing.el.querySelector(".win-title");
    const bodyEl = existing.el.querySelector(".win-body");
    if (titleEl) titleEl.textContent = windowTitle(view);
    if (bodyEl) fillWindowBody(bodyEl, view);
    bringToFront(existing.id);
    return existing.id;
  }

  while (windows.size >= MAX_WINDOWS) {
    const oldestId = windows.keys().next().value;
    closeWindow(oldestId);
  }

  const id = crypto.randomUUID();
  const { x, y } = nextPosition();

  const el = document.createElement("div");
  el.className = "win";
  el.dataset.id = id;
  el.dataset.viewKey = key;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${WINDOW_W}px`;
  el.style.zIndex = String(++zCounter);

  const header = document.createElement("div");
  header.className = "win-header";

  const title = document.createElement("div");
  title.className = "win-title";
  title.textContent = windowTitle(view);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "win-close";
  closeBtn.setAttribute("aria-label", "Закрыть");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => closeWindow(id));

  header.append(title, closeBtn);

  const body = document.createElement("div");
  body.className = "win-body";
  fillWindowBody(body, view);

  el.append(header, body);
  el.addEventListener("mousedown", () => bringToFront(id));
  enableDrag(el, header, id);

  canvas.appendChild(el);
  windows.set(id, { id, el, view, viewKey: key });
  updateCanvasHint();
  return id;
}

function addUserMessage(text) {
  const wrap = document.createElement("div");
  wrap.className = "msg user";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const t = document.createElement("div");
  t.className = "text";
  t.textContent = text;
  bubble.appendChild(t);
  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);
  scrollChatToBottom();
}

function addAgentText(text) {
  const wrap = document.createElement("div");
  wrap.className = "msg agent";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const t = document.createElement("div");
  t.className = "text";
  t.textContent = text;
  bubble.appendChild(t);
  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);
  scrollChatToBottom();
}

function addAgentWidget(view, message) {
  const wrap = document.createElement("div");
  wrap.className = "msg agent";
  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (message) {
    const t = document.createElement("div");
    t.className = "text";
    t.textContent = message;
    bubble.appendChild(t);
  }

  let windowId = null;
  if (view && (view.type === "table" || view.type === "form")) {
    windowId = openWindow(view);

    const widget = document.createElement("div");
    widget.className = "widget";

    const label = document.createElement("div");
    label.className = "widget-label";
    label.textContent = "Результат";

    const name = document.createElement("div");
    name.className = "widget-name";
    name.textContent = viewName(view);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "widget-btn";
    btn.textContent = "Показать на холсте";
    btn.addEventListener("click", () => openWindow(view));

    widget.append(label, name, btn);
    bubble.appendChild(widget);
  } else if (view) {
    const t = document.createElement("div");
    t.className = "text";
    t.textContent = `${viewName(view)}${
      view.data?.message ? `: ${view.data.message}` : ""
    }`;
    bubble.appendChild(t);
  }

  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);
  scrollChatToBottom();

  if (windowId) bringToFront(windowId);
}

function setBusy(on) {
  busy = on;
  sendBtn.disabled = on;
  input.disabled = on;
}

async function sendToAgent(text) {
  addUserMessage(text);
  setBusy(true);
  addAgentText("Ищу данные…");
  const thinking = messagesEl.lastElementChild;

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message: text }),
    });
    const data = await res.json();
    thinking?.remove();

    if (!res.ok) {
      addAgentText(`Ошибка: ${data.detail || res.status}`);
      return;
    }

    addAgentWidget(data.view, data.message || "");
  } catch (err) {
    thinking?.remove();
    addAgentText(`Сеть: ${err.message || err}`);
  } finally {
    setBusy(false);
  }
}

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  if (busy) return;
  const value = input.value.trim();
  if (!value) return;
  input.value = "";
  sendToAgent(value);
});

await loadSchemas();
updateCanvasHint();
addAgentText(
  "Агент готов. Например: «Покажи список организаций» или «Покажи пользователей»."
);
