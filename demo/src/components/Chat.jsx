import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  IconButton,
  Text,
  TextField,
} from "@radix-ui/themes";
import { viewName } from "../lib/viewUtils.js";

function Widget({ view, onOpen }) {
  return (
    <Card size="2" variant="surface" style={{ maxWidth: 280 }}>
      <Flex direction="column" gap="3">
        <Box>
          <Text size="1" color="gray">
            Результат
          </Text>
          <Text size="2" weight="bold" as="div">
            {viewName(view)}
          </Text>
        </Box>
        <Button onClick={() => onOpen(view)}>Показать на холсте</Button>
      </Flex>
    </Card>
  );
}

function Message({ msg, onOpen }) {
  const hasWidget =
    msg.view && (msg.view.type === "table" || msg.view.type === "form");
  const hasOtherView =
    msg.view && msg.view.type !== "table" && msg.view.type !== "form";
  const text =
    msg.text || (!hasWidget && !hasOtherView ? "Пустой ответ." : "");

  return (
    <Box className={`msg ${msg.role}`}>
      <Flex direction="column" gap="2">
        {text ? (
          msg.role === "user" ? (
            <Card size="2" variant="soft">
              <Text size="2">{text}</Text>
            </Card>
          ) : (
            <Text size="2">{text}</Text>
          )
        ) : null}
        {hasWidget ? <Widget view={msg.view} onOpen={onOpen} /> : null}
        {hasOtherView ? (
          <Text size="2">
            {viewName(msg.view)}
            {msg.view.data?.message ? `: ${msg.view.data.message}` : ""}
          </Text>
        ) : null}
      </Flex>
    </Box>
  );
}

export function Chat({ messages, busy, onSend, onOpenView }) {
  const [text, setText] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    const value = text.trim();
    if (!value) return;
    setText("");
    onSend(value);
  }

  return (
    <aside className="chat" aria-label="Чат">
      <div className="messages" ref={listRef}>
        {messages.map((msg) => (
          <Message key={msg.id} msg={msg} onOpen={onOpenView} />
        ))}
      </div>

      <form className="composer" onSubmit={submit}>
        <Flex direction="column" gap="2">
          <TextField.Root
            placeholder="Спросите что-нибудь..."
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
          />
          <Flex align="center" justify="between">
            <Badge color="gray" variant="soft" size="2">
              Агент
            </Badge>
            <IconButton
              type="submit"
              radius="full"
              disabled={busy}
              aria-label="Отправить"
            >
              ↑
            </IconButton>
          </Flex>
        </Flex>
      </form>
    </aside>
  );
}
