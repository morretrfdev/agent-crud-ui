import { Badge, Select, Table, Text, TextField } from "@radix-ui/themes";
import { schemaFor, statusColor } from "../lib/viewUtils.js";

export function ViewTable({ view, schemas }) {
  const schema = schemaFor(schemas, view);
  const fields = schema.fields || [];
  const rows = Array.isArray(view.data) ? view.data : [];

  return (
    <Table.Root size="1" variant="surface" className="win-table">
      <Table.Header>
        <Table.Row>
          {fields.map((field) => (
            <Table.ColumnHeaderCell key={field.key}>
              <Text size="2" weight="medium">
                {field.label || field.key}
              </Text>
            </Table.ColumnHeaderCell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row, i) => (
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
