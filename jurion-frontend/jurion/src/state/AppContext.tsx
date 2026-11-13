import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, describeError } from "../api/client";
import type { Citation, KnowledgeBase } from "../api/types";

export type Route = { view: "app"; conversationId: string | null } | { view: "widget" };

export type SourceTarget = {
  snapshotId: string;
  citation: Citation;
  claimText: string;
  /** Порядковый номер цитаты в ответе, как в тексте: [1], [2]… */
  index: number;
};

export type Toast = { id: number; text: string; tone: "ok" | "bad" | "info" };

type SessionState =
  | { status: "loading" }
  | { status: "ready"; kb: KnowledgeBase }
  | { status: "error"; title: string; detail: string };

type AppCtx = {
  session: SessionState;
  retrySession: () => void;
  route: Route;
  navigate: (r: Route) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  source: SourceTarget | null;
  openSource: (t: SourceTarget) => void;
  closeSource: () => void;
  toasts: Toast[];
  toast: (text: string, tone?: Toast["tone"]) => void;
  mocksEnabled: boolean;
};

const Ctx = createContext<AppCtx | null>(null);

function parseHash(): Route {
  const h = window.location.hash.replace(/^#/, "");
  if (h.startsWith("/widget")) return { view: "widget" };
  const m = h.match(/^\/c\/([^/?#]+)/);
  return { view: "app", conversationId: m ? decodeURIComponent(m[1]) : null };
}

function routeToHash(r: Route) {
  if (r.view === "widget") return "#/widget";
  return r.conversationId ? `#/c/${encodeURIComponent(r.conversationId)}` : "#/";
}

function initialTheme(): "light" | "dark" {
  try {
    const saved = localStorage.getItem("jurion.theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* noop */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AppProvider({ children, mocksEnabled }: { children: ReactNode; mocksEnabled: boolean }) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [route, setRoute] = useState<Route>(parseHash);
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);
  const [source, setSource] = useState<SourceTarget | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const initSession = useCallback(async () => {
    setSession({ status: "loading" });
    try {
      const items = await api.listKnowledgeBases();
      if (!items.length) {
        setSession({ status: "error", title: "Нет доступных баз знаний", detail: "Обратитесь к администратору, чтобы получить доступ." });
        return;
      }
      // В MVP база одна — выбираем её автоматически.
      setSession({ status: "ready", kb: items[0] });
    } catch (e) {
      const d = describeError(e);
      setSession({ status: "error", title: d.title, detail: d.detail });
    }
  }, []);

  useEffect(() => {
    void initSession();
  }, [initSession]);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("jurion.theme", theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  const navigate = useCallback((r: Route) => {
    const hash = routeToHash(r);
    if (window.location.hash !== hash) window.location.hash = hash;
    setRoute(r);
  }, []);

  const toast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const value = useMemo<AppCtx>(
    () => ({
      session,
      retrySession: () => void initSession(),
      route,
      navigate,
      theme,
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      source,
      openSource: setSource,
      closeSource: () => setSource(null),
      toasts,
      toast,
      mocksEnabled,
    }),
    [session, initSession, route, navigate, theme, source, toasts, toast, mocksEnabled],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp вне AppProvider");
  return v;
}
