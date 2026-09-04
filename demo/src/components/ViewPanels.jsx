import { useMemo, useState } from "react";
import { Badge, Select, Table, Text, TextField } from "@radix-ui/themes";
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

export function ViewForm({ view, schemas }) {
  const schema = schemaFor(schemas, view);
  const row = view.data || {};
  const fields = schema.fields || [];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {fields.map((field) => (
        <label key={field.key} style={{ display: "grid", gap: 6 }}>
          <Text size="1" color="gray" weight="medium">
            {field.label || field.key}
          </Text>
          {field.type === "select" ? (
            <Select.Root value={row[field.key] ?? ""} disabled>
              <Select.Trigger />
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
              value={row[field.key] ?? ""}
              readOnly={Boolean(field.readOnly)}
              onChange={() => {}}
            />
          )}
        </label>
      ))}
    </div>
  );
}
