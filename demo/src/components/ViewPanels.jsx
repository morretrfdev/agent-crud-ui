import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Flex, Select, Table, Text, TextField } from "@radix-ui/themes";
import { schemaFor, statusColor } from "../lib/viewUtils.js";

function compareValues(a, b, field) {
  const av = a ?? "";
  const bv = b ?? "";

  if (field?.type === "integer" || typeof av === "number" || typeof bv === "number") {
    const an = Number(av);
    const bn = Number(bv);
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
  }

  if (field?.type === "date" || /^\d{4}-\d{2}-\d{2}/.test(String(av))) {
    const at = Date.parse(String(av));
    const bt = Date.parse(String(bv));
    if (!Number.isNaN(at) && !Number.isNaN(bt)) return at - bt;
  }

  return String(av).localeCompare(String(bv), "ru", { sensitivity: "base" });
}

function isEditableField(field) {
  if (!field) return false;
  if (field.readOnly) return false;
  if (field.source === "backend") return false;
  return true;
}

function buildInitialValues(fields, data) {
  const row = data || {};
  const values = {};
  for (const field of fields) {
    const raw = row[field.key];
    values[field.key] = raw == null ? "" : String(raw);
  }
  return values;
}

function collectPayload(fields, values) {
  const payload = {};
  for (const field of fields) {
    if (!isEditableField(field)) continue;
    const raw = values[field.key];
    if (field.type === "integer") {
      if (raw === "" || raw == null) continue;
      payload[field.key] = Number(raw);
    } else {
      payload[field.key] = typeof raw === "string" ? raw.trim() : raw;
    }
  }
  return payload;
}

function missingRequired(fields, values) {
  const missing = [];
  for (const field of fields) {
    if (!isEditableField(field) || !field.required) continue;
    const raw = values[field.key];
    const empty =
      raw == null || (typeof raw === "string" && raw.trim() === "");
    if (empty) missing.push(field.label || field.key);
  }
  return missing;
}

export function ViewTable({ view, schemas }) {
  const schema = schemaFor(schemas, view);
  const fields = schema.fields || [];
  const rows = Array.isArray(view.data) ? view.data : [];
  const [sort, setSort] = useState({ key: null, dir: "asc" });

  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;
    const field = fields.find((f) => f.key === sort.key);
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp = compareValues(a[sort.key], b[sort.key], field);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort, fields]);

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return { key: null, dir: "asc" };
    });
  }

  return (
    <Table.Root size="1" variant="surface" className="win-table">
      <Table.Header>
        <Table.Row>
          {fields.map((field) => {
            const active = sort.key === field.key;
            const marker = !active ? "↑" : sort.dir === "asc" ? "↑" : "↓";
            return (
              <Table.ColumnHeaderCell key={field.key}>
                <button
                  type="button"
                  className="win-table-sort"
                  onClick={() => toggleSort(field.key)}
                >
                  <span className="win-table-sort-label">
                    {field.label || field.key}
                  </span>
                  <span
                    className={`win-table-sort-marker${active ? " is-active" : ""}`}
                    aria-hidden
                  >
                    {marker}
                  </span>
                </button>
              </Table.ColumnHeaderCell>
            );
          })}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {sortedRows.map((row, i) => (
          <Table.Row key={row.id ?? i}>
            {fields.map((field) => {
              const value = row[field.key] ?? "";
              return (
                <Table.Cell key={field.key}>
                  {field.key === "status" ? (
                    <Badge color={statusColor(value)} variant="soft">
                      {value}
                    </Badge>
                  ) : (
                    value
                  )}
                </Table.Cell>
              );
            })}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

export function ViewForm({ view, schemas, onSubmit }) {
  const schema = schemaFor(schemas, view);
  const fields = schema.fields || [];
  const dataKey = JSON.stringify(view?.data ?? null);
  const recordId = view?.data?.id;
  const isCreate = recordId == null;

  const [values, setValues] = useState(() =>
    buildInitialValues(fields, view?.data)
  );
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const baseline = buildInitialValues(fields, view?.data);
  const dirty = fields.some((field) => {
    if (!isEditableField(field)) return false;
    return (values[field.key] ?? "") !== (baseline[field.key] ?? "");
  });

  useEffect(() => {
    setValues(buildInitialValues(fields, view?.data));
    setErrors([]);
    setStatus("");
  }, [dataKey, view?.entity]);

  function setField(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setStatus("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!onSubmit || busy) return;
    if (!isCreate && !dirty) return;

    const missing = missingRequired(fields, values);
    if (missing.length) {
      setErrors(missing);
      setStatus("");
      return;
    }
    setErrors([]);
    setBusy(true);
    setStatus("");
    try {
      const payload = collectPayload(fields, values);
      await onSubmit({
        mode: isCreate ? "create" : "update",
        entity: view.entity,
        id: recordId,
        payload,
        view,
      });
      setStatus(isCreate ? "Создано" : "Сохранено");
    } catch (err) {
      setStatus(`Ошибка: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  const submitDisabled = busy || (!isCreate && !dirty);

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      {fields.map((field) => {
        const editable = isEditableField(field);
        return (
          <label key={field.key} style={{ display: "grid", gap: 6 }}>
            <Text size="1" color="gray" weight="medium">
              {field.label || field.key}
              {editable && field.required ? " *" : ""}
            </Text>
            {field.type === "select" ? (
              <Select.Root
                value={values[field.key] || undefined}
                disabled={!editable || busy}
                onValueChange={(v) => setField(field.key, v)}
              >
                <Select.Trigger placeholder="Выберите…" />
                <Select.Content>
                  {(field.options || []).map((opt) => (
                    <Select.Item key={opt} value={opt}>
                      {opt}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            ) : (
              <TextField.Root
                type={field.type === "date" ? "date" : "text"}
                value={values[field.key] ?? ""}
                readOnly={!editable}
                disabled={busy}
                onChange={(ev) => setField(field.key, ev.target.value)}
              />
            )}
          </label>
        );
      })}

      {errors.length > 0 ? (
        <Text size="1" color="red">
          Заполните: {errors.join(", ")}
        </Text>
      ) : null}
      {status ? (
        <Text size="1" color={status.startsWith("Ошибка") ? "red" : "green"}>
          {status}
        </Text>
      ) : null}

      <Flex justify="end">
        <Button type="submit" disabled={submitDisabled}>
          {busy ? "…" : isCreate ? "Создать" : "Сохранить"}
        </Button>
      </Flex>
    </form>
  );
}
