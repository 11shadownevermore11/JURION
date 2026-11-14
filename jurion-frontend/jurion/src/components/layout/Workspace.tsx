import { useCallback, useEffect, useState } from "react";
import { FlaskConical, Menu, PanelRightOpen, Plus, X } from "lucide-react";
import type { Conversation } from "../../api/types";
import { useConversations } from "../../hooks/useConversations";
import { useApp } from "../../state/AppContext";
import { ChatPanel } from "../chat/ChatPanel";
import { SourcePanel } from "../sources/SourcePanel";
import { IconButton, Kbd } from "../ui/Button";
import { Sidebar } from "./Sidebar";

export function Workspace({ conversationId }: { conversationId: string | null }) {
  const { session, navigate, source, closeSource, mocksEnabled } = useApp();
  const conversations = useConversations(session.status === "ready");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const [hotkeys, setHotkeys] = useState(false);

  const startNew = useCallback(() => {
    closeSource();
    navigate({ view: "app", conversationId: null });
    setSidebarOpen(false);
    setFocusSignal((n) => n + 1);
  }, [navigate, closeSource]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.closest("input, textarea, [contenteditable]");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        startNew();
      } else if (e.key === "Escape") {
        if (hotkeys) setHotkeys(false);
        else if (source) closeSource();
        else if (sidebarOpen) setSidebarOpen(false);
      } else if (!typing && e.key === "/") {
        e.preventDefault();
        setFocusSignal((n) => n + 1);
      } else if (!typing && e.key === "?") {
        setHotkeys(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startNew, source, closeSource, sidebarOpen, hotkeys]);

  const onCreated = useCallback(
    (c: Conversation) => {
      conversations.upsert(c);
      navigate({ view: "app", conversationId: c.id });
    },
    [conversations, navigate],
  );

  return (
    <div className={`workspace ${source ? "has-source" : ""}`}>
      <Sidebar
        conversations={conversations}
        activeId={conversationId}
        onSelect={(id) => {
          closeSource();
          navigate({ view: "app", conversationId: id });
          setSidebarOpen(false);
        }}
        onNew={startNew}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onShowHotkeys={() => setHotkeys(true)}
      />
      {sidebarOpen && <div className="scrim scrim--sidebar" onClick={() => setSidebarOpen(false)} aria-hidden />}

      <main className="workspace__main">
        <ChatPanel
          conversationId={conversationId}
          focusSignal={focusSignal}
          onConversationCreated={onCreated}
          onActivity={conversations.refresh}
          header={({ title }) => (
            <header className="chat-head">
              <IconButton label="Открыть список диалогов" className="chat-head__menu" onClick={() => setSidebarOpen(true)}>
                <Menu size={18} />
              </IconButton>
              <h1 className="chat-head__title">
                {conversations.items.find((c) => c.id === conversationId)?.title || title || "Новый диалог"}
              </h1>
              {mocksEnabled && (
                <span className="demo-tag" title="Бэкенд не подключён — работают демонстрационные моки по контракту API">
                  <FlaskConical size={13} aria-hidden /> Демо-данные
                </span>
              )}
              <IconButton label="Новый вопрос" className="chat-head__new" onClick={startNew}>
                <Plus size={18} />
              </IconButton>
              <IconButton label="Открыть как виджет" onClick={() => navigate({ view: "widget" })}>
                <PanelRightOpen size={18} />
              </IconButton>
            </header>
          )}
        />
      </main>

      {source && (
        <>
          <div className="scrim scrim--source" onClick={closeSource} aria-hidden />
          <SourcePanel variant="side" />
        </>
      )}

      {hotkeys && (
        <div className="modal-backdrop" onClick={() => setHotkeys(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hk-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal__head">
              <h2 id="hk-title">Горячие клавиши</h2>
              <IconButton label="Закрыть" size="sm" onClick={() => setHotkeys(false)} autoFocus>
                <X size={16} />
              </IconButton>
            </header>
            <dl className="hotkeys">
              <dt>
                <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>
              </dt>
              <dd>Новый вопрос</dd>
              <dt>
                <Kbd>/</Kbd>
              </dt>
              <dd>Перейти к полю ввода</dd>
              <dt>
                <Kbd>Enter</Kbd>
              </dt>
              <dd>Отправить вопрос</dd>
              <dt>
                <Kbd>Shift</Kbd> <Kbd>Enter</Kbd>
              </dt>
              <dd>Новая строка</dd>
              <dt>
                <Kbd>Esc</Kbd>
              </dt>
              <dd>Закрыть источник или окно</dd>
              <dt>
                <Kbd>?</Kbd>
              </dt>
              <dd>Эта подсказка</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
