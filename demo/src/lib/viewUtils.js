export const FALLBACK_SCHEMAS = {
  organizations: {
    key: "organizations",
    title: "Организации",
    fields: [
      { key: "name", label: "Организация", type: "text", required: true },
      {
        key: "id",
        label: "ID",
        type: "integer",
        required: true,
        readOnly: true,
        source: "backend",
      },
      {
        key: "status",
        label: "Статус",
        type: "select",
        required: true,
        options: ["Одобрено", "Возвращено", "На рассмотрении", "Черновик"],
      },
    ],
  },
  users: {
    key: "users",
    title: "Пользователи",
    fields: [
      { key: "fullName", label: "ФИО", type: "text", required: true },
      {
        key: "registeredAt",
        label: "Дата регистрации",
        type: "date",
        required: true,
      },
      {
        key: "id",
        label: "ID",
        type: "integer",
        required: true,
        readOnly: true,
        source: "backend",
      },
    ],
  },
};

export function statusClass(status) {
  if (status === "Одобрено") return "ok";
  if (status === "Возвращено") return "bad";
  if (status === "Черновик") return "draft";
  return "wait";
}

export function statusColor(status) {
  if (status === "Одобрено") return "green";
  if (status === "Возвращено") return "red";
  if (status === "Черновик") return "gray";
  return "blue";
}

export function schemaFor(schemas, view) {
  const key = view?.entity || "organizations";
  return schemas[key] || schemas.organizations || FALLBACK_SCHEMAS.organizations;
}

export function viewName(view) {
  if (!view) return "view: ?";
  if (view.type === "table") return `view: table · ${view.entity}`;
  if (view.type === "form") {
    const id = view.data?.id != null ? ` #${view.data.id}` : "";
    return `view: form · ${view.entity}${id}`;
  }
  return `view: ${view.type} · ${view.entity}`;
}

export function windowTitle(schemas, view) {
  const schema = schemaFor(schemas, view);
  if (view.type === "table") {
    return view.title || schema.title || view.entity || "Таблица";
  }
  if (view.type === "form") {
    const id = view.data?.id != null ? ` #${view.data.id}` : "";
    return view.title || `${schema.title || view.entity || "Запись"}${id}`;
  }
  return viewName(view);
}

export function viewKey(view) {
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
