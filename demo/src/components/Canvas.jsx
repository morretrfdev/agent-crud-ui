import { useRef, useState } from "react";
import { Box, Flex, Text } from "@radix-ui/themes";
import { ViewForm, ViewTable } from "./ViewPanels.jsx";
import { windowTitle } from "../lib/viewUtils.js";

export function CanvasWindow({
  win,
  schemas,
  onClose,
  onFocus,
  onMove,
  onFormSubmit,
}) {
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);

  function onPointerDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest("button")) return;
    onFocus(win.id);
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: win.x,
      origY: win.y,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    onMove(win.id, {
      x: Math.max(0, d.origX + (e.clientX - d.startX)),
      y: Math.max(0, d.origY + (e.clientY - d.startY)),
    });
  }

  function endDrag(e) {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  return (
    <Box
      className={`win${dragging ? " is-dragging" : ""}`}
      style={{
        left: win.x,
        top: win.y,
        width: win.width,
        zIndex: win.zIndex,
      }}
      onMouseDown={() => onFocus(win.id)}
    >
      <Flex
        className="win-header"
        align="center"
        justify="between"
        gap="3"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <Text size="2" weight="medium" highContrast truncate style={{ flex: 1, minWidth: 0 }}>
          {windowTitle(schemas, win.view)}
        </Text>
        <button
          type="button"
          className="win-close"
          aria-label="Закрыть"
          onClick={() => onClose(win.id)}
        >
          ×
        </button>
      </Flex>

      <Box className="win-panel">
        <div className="win-body">
          {win.view.type === "table" ? (
            <ViewTable view={win.view} schemas={schemas} />
          ) : (
            <div className="win-form-pad">
              <ViewForm
                view={win.view}
                schemas={schemas}
                onSubmit={
                  onFormSubmit
                    ? (payload) => onFormSubmit(win.id, payload)
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </Box>
    </Box>
  );
}

export function Canvas({
  workspaceRef,
  windows,
  schemas,
  onClose,
  onFocus,
  onMove,
  onFormSubmit,
}) {
  return (
    <main
      className="workspace"
      aria-label="Холст результатов"
      ref={workspaceRef}
    >
      {windows.length === 0 && (
        <Flex
          position="absolute"
          inset="0"
          align="center"
          justify="center"
          style={{ pointerEvents: "none", zIndex: 0 }}
        >
          <Text size="2" color="gray">
            Результаты появятся здесь
          </Text>
        </Flex>
      )}
      <div className="canvas">
        {windows.map((win) => (
          <CanvasWindow
            key={win.id}
            win={win}
            schemas={schemas}
            onClose={onClose}
            onFocus={onFocus}
            onMove={onMove}
            onFormSubmit={onFormSubmit}
          />
        ))}
      </div>
    </main>
  );
}
