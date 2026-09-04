import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Theme
      appearance="light"
      accentColor="orange"
      grayColor="sand"
      radius="full"
      style={{ height: "100%", minHeight: 0 }}
    >
      <App />
    </Theme>
  </StrictMode>
);
