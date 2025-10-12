import "./styles/tailwind.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./sections/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
