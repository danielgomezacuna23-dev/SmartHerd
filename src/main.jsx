import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { AppErrorBoundary, ErrorPage } from "./Errors.jsx";
import "./style.css";
import "./theme.css";
import "./layout.css";
createRoot(document.getElementById("root")).render(
  <AppErrorBoundary>
    {[
      import.meta.env.BASE_URL,
      `${import.meta.env.BASE_URL}index.html`,
    ].includes(window.location.pathname) ? (
      <App />
    ) : (
      <ErrorPage
        error="route-not-found"
        onBack={() => window.location.assign(import.meta.env.BASE_URL)}
      />
    )}
  </AppErrorBoundary>,
);
