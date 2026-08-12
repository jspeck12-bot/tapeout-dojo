import React from "react";
import { createRoot } from "react-dom/client";
import App from "./tapeout.jsx";

// ============================================================
// LOCAL ENTRY POINT — not part of the game.
//
// The game file (tapeout-rpg_4.jsx) must stay artifact-legal, so it never
// touches localStorage directly. Instead it calls an async `window.storage`
// API and degrades to in-memory saves if that API is absent. This shim
// provides local persistence backed by localStorage for `npm run dev`.
// ============================================================
if (typeof window !== "undefined" && !window.storage) {
  const PREFIX = "tapeout:";
  window.storage = {
    async get(key) {
      try {
        const value = window.localStorage.getItem(PREFIX + key);
        return value == null ? null : { value };
      } catch (e) {
        return null;
      }
    },
    async set(key, value) {
      try {
        window.localStorage.setItem(PREFIX + key, value);
      } catch (e) {}
    },
    async delete(key) {
      try {
        window.localStorage.removeItem(PREFIX + key);
      } catch (e) {}
    },
  };
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
