import { useEffect, useState } from "react";
import type { Citation } from "../api/types";
import { loadChunk } from "../lib/chunkCache";
import { verifyQuote } from "../lib/verify";

export type QuoteStatus = "checking" | "match" | "mismatch" | "unavailable";

/**
 * Независимая клиентская сверка: каждую цитату ответа ищем в тексте
 * фрагмента, который сервер отдаёт по chunk_id. Ключ — индекс цитаты.
 */
export function useQuoteVerification(snapshotId: string, citations: Citation[]) {
  const [status, setStatus] = useState<Record<number, QuoteStatus>>(() =>
    Object.fromEntries(citations.map((_, i) => [i, "checking" as QuoteStatus])),
  );
  const key = snapshotId + "|" + citations.map((c) => c.chunk_id + c.quote).join("|");

  useEffect(() => {
    let alive = true;
    setStatus(Object.fromEntries(citations.map((_, i) => [i, "checking" as QuoteStatus])));
    citations.forEach((c, i) => {
      loadChunk(snapshotId, c.chunk_id)
        .then((chunk) => {
          if (alive) setStatus((s) => ({ ...s, [i]: verifyQuote(c.quote, chunk.text) }));
        })
        .catch(() => {
          if (alive) setStatus((s) => ({ ...s, [i]: "unavailable" }));
        });
    });
    return () => {
      alive = false;
    };
    // key описывает набор цитат полностью
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const values = Object.values(status);
  const summary = {
    total: citations.length,
    matched: values.filter((v) => v === "match").length,
    mismatched: values.filter((v) => v === "mismatch").length,
    unavailable: values.filter((v) => v === "unavailable").length,
    done: values.every((v) => v !== "checking"),
  };
  return { status, summary };
}
