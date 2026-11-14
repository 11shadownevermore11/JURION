import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Copy, Download, FileText, LoaderCircle, RotateCw, ShieldAlert, X } from "lucide-react";
import { describeError } from "../../api/client";
import type { SourceChunk } from "../../api/types";
import { loadChunk, loadOriginal } from "../../lib/chunkCache";
import { findQuoteRange, verifyQuote } from "../../lib/verify";
import { useApp } from "../../state/AppContext";
import { Button, IconButton } from "../ui/Button";

type Tab = "fragment" | "document";

function Highlighted({ text, quote }: { text: string; quote: string }) {
  const range = findQuoteRange(text, quote);
  if (!range) return <>{text}</>;
  return (
    <>
      {text.slice(0, range[0])}
      <mark className="quote-mark">{text.slice(range[0], range[1])}</mark>
      {text.slice(range[1])}
    </>
  );
}

function OriginalView({ chunk, quote }: { chunk: SourceChunk; quote: string }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ready"; lines: string[] } | { status: "error"; msg: string }>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const target = useRef<HTMLLIElement>(null);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    loadOriginal(chunk.file.url)
      .then((t) => alive && setState({ status: "ready", lines: t.replace(/\r\n/g, "\n").split("\n") }))
      .catch((e) => alive && setState({ status: "error", msg: describeError(e).detail }));
    return () => {
      alive = false;
    };
  }, [chunk.file.url, attempt]);

  useEffect(() => {
    if (state.status === "ready") target.current?.scrollIntoView({ block: "center" });
  }, [state.status]);

  if (state.status === "loading")
    return (
      <div className="src-loading" role="status">
        <LoaderCircle size={18} className="spin" aria-hidden /> Загружаем оригинал документа
      </div>
    );
  if (state.status === "error")
    return (
      <div className="src-error" role="alert">
        <p>Оригинал не открылся: {state.msg}</p>
        <Button size="sm" icon={<RotateCw size={14} />} onClick={() => setAttempt((a) => a + 1)}>
          Повторить
        </Button>
      </div>
    );

  return (
    <ol className="doc-lines" aria-label={`Текст документа ${chunk.document_title}`}>
      {state.lines.map((line, i) => {
        const n = i + 1;
        const hit = n >= chunk.line_start && n <= chunk.line_end;
        return (
          <li key={n} ref={n === chunk.line_start ? target : undefined} className={hit ? "is-hit" : ""}>
            <span className="doc-lines__n tnum" aria-hidden>
              {n}
            </span>
            <span className="doc-lines__t">{hit ? <Highlighted text={line} quote={quote} /> : line || " "}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function SourcePanel({ variant = "side" }: { variant?: "side" | "overlay" }) {
  const { source, closeSource, toast } = useApp();
  const [state, setState] = useState<{ status: "loading" } | { status: "ready"; chunk: SourceChunk } | { status: "error"; title: string; msg: string }>({
    status: "loading",
  });
  const [tab, setTab] = useState<Tab>("fragment");
  const [attempt, setAttempt] = useState(0);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!source) return;
    let alive = true;
    setState({ status: "loading" });
    setTab("fragment");
    loadChunk(source.snapshotId, source.citation.chunk_id)
      .then((chunk) => alive && setState({ status: "ready", chunk }))
      .catch((e) => {
        const d = describeError(e);
        if (alive) setState({ status: "error", title: d.title, msg: d.detail });
      });
    return () => {
      alive = false;
    };
  }, [source, attempt]);

  useEffect(() => {
    if (source) closeBtn.current?.focus({ preventScroll: true });
  }, [source]);

  const verdict = useMemo(
    () => (state.status === "ready" && source ? verifyQuote(source.citation.quote, state.chunk.text) : null),
    [state, source],
  );

  if (!source) return null;

  const download = async (chunk: SourceChunk) => {
    try {
      const text = await loadOriginal(chunk.file.url);
      const url = URL.createObjectURL(new Blob([text], { type: chunk.file.media_type || "text/plain;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = chunk.file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast(`Не удалось скачать оригинал. ${describeError(e).detail}`, "bad");
    }
  };

  const copyQuote = async () => {
    try {
      await navigator.clipboard.writeText(`«${source.citation.quote}» (${source.citation.label})`);
      toast("Цитата скопирована", "ok");
    } catch {
      toast("Браузер запретил доступ к буферу обмена", "bad");
    }
  };

  return (
    <aside className={`source source--${variant}`} aria-label="Источник">
      <header className="source__head">
        <span className="source__n tnum" aria-hidden>
          {source.index}
        </span>
        <p className="source__label">{source.citation.label}</p>
        <IconButton ref={closeBtn} label="Закрыть источник (Esc)" onClick={closeSource} size="sm">
          <X size={16} />
        </IconButton>
      </header>

      <div className="source__body scroll">
        {state.status === "loading" && (
          <div className="src-skeleton" role="status" aria-label="Загрузка источника">
            <div className="sk sk--line" />
            <div className="sk sk--line sk--w60" />
            <div className="sk sk--block" />
          </div>
        )}

        {state.status === "error" && (
          <div className="src-error" role="alert">
            <p className="src-error__title">{state.title}</p>
            <p>{state.msg} Ответ при этом остаётся доступен.</p>
            <Button size="sm" icon={<RotateCw size={14} />} onClick={() => setAttempt((a) => a + 1)}>
              Повторить
            </Button>
          </div>
        )}

        {state.status === "ready" && (
          <>
            <div className="source__doc">
              <FileText size={18} aria-hidden className="source__doc-icon" />
              <div>
                <h2 className="source__title">{state.chunk.document_title}</h2>
                <p className="source__meta">
                  {[state.chunk.version_label, state.chunk.provision_label].filter(Boolean).join(", ")}
                  {state.chunk.line_start ? (
                    <span className="tnum">
                      {" "}
                      — строки {state.chunk.line_start}
                      {state.chunk.line_end !== state.chunk.line_start ? `–${state.chunk.line_end}` : ""}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            <div className={`verdict ${verdict === "match" ? "verdict--ok" : "verdict--bad"}`} role="status">
              {verdict === "match" ? <BadgeCheck size={16} aria-hidden /> : <ShieldAlert size={16} aria-hidden />}
              <span>
                {verdict === "match"
                  ? "Цитата из ответа дословно найдена в тексте положения"
                  : "Цитата в ответе не совпадает с текстом положения — проверьте формулировку"}
              </span>
            </div>

            <div className="source__claim">
              <span>Вывод в ответе</span>
              <p>{source.claimText}</p>
            </div>

            <div className="tabs" role="tablist" aria-label="Режим просмотра">
              <button type="button" role="tab" aria-selected={tab === "fragment"} className="tab" onClick={() => setTab("fragment")}>
                Фрагмент
              </button>
              <button type="button" role="tab" aria-selected={tab === "document"} className="tab" onClick={() => setTab("document")}>
                Документ целиком
              </button>
            </div>

            <div role="tabpanel" className="source__panel">
              {tab === "fragment" ? (
                <blockquote className="fragment pre-wrap">
                  <Highlighted text={state.chunk.text} quote={source.citation.quote} />
                </blockquote>
              ) : (
                <OriginalView chunk={state.chunk} quote={source.citation.quote} />
              )}
            </div>
          </>
        )}
      </div>

      {state.status === "ready" && (
        <footer className="source__foot">
          <Button size="sm" variant="ghost" icon={<Copy size={14} />} onClick={copyQuote}>
            Копировать цитату
          </Button>
          <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => void download(state.chunk)}>
            Скачать оригинал
          </Button>
        </footer>
      )}
    </aside>
  );
}
