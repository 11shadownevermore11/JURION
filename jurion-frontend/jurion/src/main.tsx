import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installMockServer } from "./mocks/server";
// Шрифты встроены в сборку: интерфейс не зависит от внешних CDN во внутреннем контуре банка.
import "@fontsource/onest/400.css";
import "@fontsource/onest/500.css";
import "@fontsource/onest/600.css";
import "@fontsource/onest/700.css";
import "@fontsource/pt-serif/400.css";
import "@fontsource/pt-serif/400-italic.css";
import "@fontsource/pt-serif/700.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/brand.css";
import "./styles/layout.css";
import "./styles/chat.css";
import "./styles/source.css";
import "./styles/widget.css";

// Моки включены по умолчанию; для реального бэкенда — VITE_USE_MOCKS=false.
const useMocks = import.meta.env.VITE_USE_MOCKS !== "false";
if (useMocks) installMockServer();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App mocksEnabled={useMocks} />
  </StrictMode>,
);
