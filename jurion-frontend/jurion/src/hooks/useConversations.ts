import { useCallback, useEffect, useRef, useState } from "react";
import { api, describeError } from "../api/client";
import type { Conversation } from "../api/types";

export type ConversationsState = {
  items: Conversation[];
  status: "loading" | "ready" | "error";
  error: string | null;
  nextCursor: string | null;
  loadingMore: boolean;
};

export function useConversations(enabled: boolean) {
  const [state, setState] = useState<ConversationsState>({
    items: [],
    status: "loading",
    error: null,
    nextCursor: null,
    loadingMore: false,
  });
  const gen = useRef(0);

  const refresh = useCallback(async () => {
    const g = ++gen.current;
    try {
      const page = await api.listConversations(null, 20);
      if (g !== gen.current) return;
      setState((s) => ({ ...s, items: page.items, nextCursor: page.next_cursor, status: "ready", error: null }));
    } catch (e) {
      if (g !== gen.current) return;
      setState((s) => ({ ...s, status: s.items.length ? "ready" : "error", error: describeError(e).detail }));
    }
  }, []);

  const loadMore = useCallback(async () => {
    const cursor = state.nextCursor;
    if (!cursor || state.loadingMore) return;
    setState((s) => ({ ...s, loadingMore: true }));
    try {
      const page = await api.listConversations(cursor, 20);
      setState((s) => {
        const seen = new Set(s.items.map((c) => c.id));
        return {
          ...s,
          items: [...s.items, ...page.items.filter((c) => !seen.has(c.id))],
          nextCursor: page.next_cursor,
          loadingMore: false,
        };
      });
    } catch (e) {
      setState((s) => ({ ...s, loadingMore: false, error: describeError(e).detail }));
    }
  }, [state.nextCursor, state.loadingMore]);

  /** Локально поднимает диалог наверх, пока сервер не вернул свежий список. */
  const upsert = useCallback((c: Conversation) => {
    setState((s) => ({ ...s, items: [c, ...s.items.filter((x) => x.id !== c.id)] }));
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { ...state, refresh, loadMore, upsert };
}
