/**
 * Live agent UI: chat → POST /api/chat → widget (view name + button) → panel.
 */

const API_BASE = window.location.port === "5173" ? "http://127.0.0.1:8000" : "";

const messagesEl = document.getElementById("messages");
const composer = document.getElementById("composer");
const input = document.getElementById("input");
const panel = document.getElementById("panel");
const panelBody = document.getElementById("panelBody");
const panelClose = document.getElementById("panelClose");
const sendBtn = composer.querySelector(".send");

let entitySchema = {
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
};

/** @type {any} */
let lastView = null;
let busy = false;

const sessionId =
  localStorage.getItem("crudSessionId") ||
  (() => {
    const id = `web-${crypto.randomUUID()}`;
    localStorage.setItem("crudSessionId", id);
    return id;
  })();

async function loadSchema() {
  try {
    const res = await fetch(`${API_BASE}/api/entities/organizations/schema`);
    if (res.ok) entitySchema = await res.json();
  } catch {
    /* keep fallback schema */
  }
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

function scrollChatToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
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
  lastView = view;

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

  if (view && (view.type === "table" || view.type === "form")) {
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
    btn.textContent =
      view.type === "table" ? "Открыть таблицу" : "Посмотреть данные";
    btn.addEventListener("click", () => openPanel(view));

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
  closePanel();
}

function openPanel(view) {
  if (!view) return;
  lastView = view;
  panelBody.replaceChildren();
  if (view.type === "table") renderTable(view);
  else if (view.type === "form") renderForm(view);
  else {
    const p = document.createElement("p");
    p.textContent = JSON.stringify(view.data ?? view, null, 2);
    panelBody.appendChild(p);
  }
  panel.hidden = false;
}

function closePanel() {
  panel.hidden = true;
  panelBody.replaceChildren();
}

function renderTable(view) {
  const h2 = document.createElement("h2");
  h2.textContent = view.title || entitySchema.title || view.entity;

  const table = document.createElement("table");
  table.className = "table";
  const thead = document.createElement("thead");
  thead.innerHTML =
    "<tr><th>Организация</th><th>ID</th><th>Статус</th></tr>";
  const tbody = document.createElement("tbody");
  const rows = Array.isArray(view.data) ? view.data : [];

  for (const row of rows) {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    const tdId = document.createElement("td");
    const tdStatus = document.createElement("td");
    tdName.textContent = row.name ?? "";
    tdId.textContent = row.id ?? "";
    const badge = document.createElement("span");
    badge.className = `badge ${statusClass(row.status)}`;
    badge.textContent = row.status ?? "";
    tdStatus.appendChild(badge);
    tr.append(tdName, tdId, tdStatus);
    tbody.appendChild(tr);
  }

  table.append(thead, tbody);
  panelBody.append(h2, table);
}

function renderForm(view) {
  const row = view.data || {};
  const h2 = document.createElement("h2");
  h2.textContent =
    view.title || `Данные организации id ${row.id ?? "?"}`;

  const form = document.createElement("div");
  form.className = "form-grid";
  const fields = entitySchema.fields || [];

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
      el.type = "text";
      el.value = row[field.key] ?? "";
      if (field.readOnly) el.readOnly = true;
      box.appendChild(el);
    }
    form.appendChild(box);
  }

  panelBody.append(h2, form);
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

panelClose.addEventListener("click", closePanel);

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  if (busy) return;
  const value = input.value.trim();
  if (!value) return;
  input.value = "";
  sendToAgent(value);
});

await loadSchema();
addAgentText("Агент готов. Спросите, например: «Покажи список организаций».");
