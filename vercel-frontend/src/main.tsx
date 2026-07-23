import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LumaApp from "../../shared/LumaApp";
import "../../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LumaApp />
  </StrictMode>,
);
