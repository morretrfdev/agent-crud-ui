import { useCallback, useEffect, useRef, useState } from "react";
import { Chat } from "./components/Chat.jsx";
import { Canvas } from "./components/Canvas.jsx";
import {
  MAX_WINDOWS,
  WINDOW_W,
  fetchSchema,
  getSessionId,
  postChat,
} from "./lib/api.js";
import { FALLBACK_SCHEMAS, viewKey } from "./lib/viewUtils.js";

function nextMsgId() {
  return crypto.randomUUID();
}

export default function App() {
  const sessionId = useRef(getSessionId()).current;
  const workspaceRef = useRef(null);
  const zRef = useRef(10);
  const cascadeRef = useRef(0);

  const [schemas, setSchemas] = useState(FALLBACK_SCHEMAS);
  const [messages, setMessages] = useState([
    {
      id: nextMsgId(),
      role: "agent",
      text: "Агент готов. Например: «Покажи список организаций» или «Покажи пользователей».",
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [windows, setWindows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = { ...FALLBACK_SCHEMAS };
      for (const key of Object.keys(FALLBACK_SCHEMAS)) {
        try {
          next[key] = await fetchSchema(key);
        } catch {
          /* keep fallback */
        }
      }
      if (!cancelled) setSchemas(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nextPosition = useCallback(() => {
    const el = workspaceRef.current;
    const rect = el?.getBoundingClientRect?.() || { width: 800, height: 600 };
    const pad = 24;
    const step = 28;
    const maxX = Math.max(pad, rect.width - WINDOW_W - pad);
    const maxY = Math.max(pad, rect.height - 200);
    const n = cascadeRef.current % 8;
    cascadeRef.current += 1;
    return {
      x: Math.min(pad + n * step, maxX),
      y: Math.min(pad + n * step, maxY),
    };
  }, []);

  const openWindow = useCallback(
    (view) => {
      if (!view || (view.type !== "table" && view.type !== "form")) return;
      const key = viewKey(view);

      setWindows((prev) => {
        const existing = prev.find((w) => w.viewKey === key);
        zRef.current += 1;
        const zIndex = zRef.current;

        if (existing) {
          return prev.map((w) =>
            w.id === existing.id ? { ...w, view, zIndex } : w
          );
        }

        const { x, y } = nextPosition();
        const win = {
          id: crypto.randomUUID(),
          viewKey: key,
          view,
          x,
          y,
          width: WINDOW_W,
          zIndex,
        };
        const trimmed =
          prev.length >= MAX_WINDOWS
            ? prev.slice(prev.length - MAX_WINDOWS + 1)
            : prev;
        return [...trimmed, win];
      });
    },
    [nextPosition]
  );

  const closeWindow = useCallback((id) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const focusWindow = useCallback((id) => {
    zRef.current += 1;
    const zIndex = zRef.current;
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, zIndex } : w))
    );
  }, []);

  const moveWindow = useCallback((id, { x, y }) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, x, y } : w))
    );
  }, []);

  async function sendMessage(text) {
    setMessages((prev) => [
      ...prev,
      { id: nextMsgId(), role: "user", text },
      { id: nextMsgId(), role: "agent", text: "Ищу данные…", thinking: true },
    ]);
    setBusy(true);

    try {
      const data = await postChat(sessionId, text);
      setMessages((prev) => {
        const withoutThinking = prev.filter((m) => !m.thinking);
        return [
          ...withoutThinking,
          {
            id: nextMsgId(),
            role: "agent",
            text: data.message || "",
            view: data.view || null,
          },
        ];
      });
      if (data.view && (data.view.type === "table" || data.view.type === "form")) {
        openWindow(data.view);
      }
    } catch (err) {
      setMessages((prev) => {
        const withoutThinking = prev.filter((m) => !m.thinking);
        return [
          ...withoutThinking,
          {
            id: nextMsgId(),
            role: "agent",
            text: `Ошибка: ${err.message || err}`,
          },
        ];
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="shell">
        <Chat
          messages={messages}
          busy={busy}
          onSend={sendMessage}
          onOpenView={openWindow}
        />
        <Canvas
          workspaceRef={workspaceRef}
          windows={windows}
          schemas={schemas}
          onClose={closeWindow}
          onFocus={focusWindow}
          onMove={moveWindow}
        />
      </div>
    </div>
  );
}
