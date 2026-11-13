import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, FileText, Maximize2, MessagesSquare, Minus, Plus } from "lucide-react";
import type { Conversation } from "../../api/types";
import { useConversations } from "../../hooks/useConversations";
import { useApp } from "../../state/AppContext";
import terminal from "../../assets/brand/terminal.webp";
import { LogoMark } from "../brand/Logo";
import { PsbLogo } from "../brand/PsbLogo";
import { ChatPanel } from "../chat/ChatPanel";
import { SourcePanel } from "../sources/SourcePanel";
import { Button, IconButton } from "../ui/Button";
import { Popover } from "../ui/Popover";

const CONV_KEY = "jurion.widget.conv";

function readConv() {
  try {
    return localStorage.getItem(CONV_KEY);
  } catch {
    return null;
  }
}

/**
 * Демонстрация встраивания: JURION как боковое окно внутри рабочей системы
 * юриста (здесь — условная карточка договора в СЭД).
 */
export function WidgetDemo() {
  const { session, navigate, source, closeSource } = useApp();
  const conversations = useConversations(session.status === "ready");
  const [open, setOpen] = useState(true);
  const [convId, setConvId] = useState<string | null>(readConv);
  const [prefill, setPrefill] = useState<{ text: string; n: number } | null>(null);

  useEffect(() => {
    try {
      if (convId) localStorage.setItem(CONV_KEY, convId);
      else localStorage.removeItem(CONV_KEY);
    } catch {
      /* noop */
    }
  }, [convId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && source) closeSource();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [source, closeSource]);

  const onCreated = useCallback(
    (c: Conversation) => {
      conversations.upsert(c);
      setConvId(c.id);
    },
    [conversations],
  );

  const askAboutContract = () => {
    setOpen(true);
    setPrefill((p) => ({ text: "По договору аренды № А-08/2024 с ООО «Северный Склад»: ", n: (p?.n ?? 0) + 1 }));
  };

  return (
    <div className={`host ${open ? "has-widget" : ""}`}>
      <div className="host__page">
        <header className="host__bar">
          <button type="button" className="host__back" onClick={() => navigate({ view: "app", conversationId: null })}>
            <ArrowLeft size={16} aria-hidden /> Полноэкранный режим
          </button>
          <span className="host__system">
            <PsbLogo variant="compact" className="host__psb" />
            Система электронного документооборота (демо)
          </span>
        </header>

        <main className="host__content">
          <p className="host__crumbs">Договоры / Аренда / А-08/2024</p>
          <div className="host__title-row">
            <FileText size={22} aria-hidden />
            <h1>Договор аренды нежилого помещения № А-08/2024</h1>
          </div>
          <dl className="host__fields">
            <div>
              <dt>Контрагент</dt>
              <dd>ООО «Северный Склад»</dd>
            </div>
            <div>
              <dt>Дата договора</dt>
              <dd>01.08.2024</dd>
            </div>
            <div>
              <dt>Срок действия</dt>
              <dd>до 31.07.2027</dd>
            </div>
            <div>
              <dt>Связанные документы</dt>
              <dd>Дополнительное соглашение № 1 от 15.02.2025</dd>
            </div>
            <div>
              <dt>Ответственное подразделение</dt>
              <dd>Отдел договорной работы</dd>
            </div>
            <div>
              <dt>Статус</dt>
              <dd>
                <span className="host__status">Действует</span>
              </dd>
            </div>
          </dl>
          <div className="host__ask">
            <div>
              <p className="host__ask-title">Вопрос по условиям договора?</p>
              <p>JURION ответит со ссылками на пункты договора и допсоглашений.</p>
            </div>
            <Button variant="evidence" icon={<MessagesSquare size={16} />} onClick={askAboutContract}>
              Спросить JURION
            </Button>
          </div>
          <div className="host__placeholder" aria-hidden>
            <span />
            <span />
            <span />
          </div>
        </main>
      </div>

      {open ? (
        <div className="widget" role="complementary" aria-label="JURION — юридический ассистент">
          <ChatPanel
            compact
            conversationId={convId}
            onConversationCreated={onCreated}
            onActivity={conversations.refresh}
            prefill={prefill}
            header={({ title }) => (
              <header className="widget__head">
                <LogoMark size={26} />
                <Popover
                  id="widget-convs"
                  label="Диалоги"
                  trigger={({ open: o, toggle, id }) => (
                    <button type="button" className="widget__title" onClick={toggle} aria-expanded={o} aria-controls={id}>
                      <span>
                        {convId ? conversations.items.find((c) => c.id === convId)?.title || title || "Диалог" : "Новый вопрос"}
                      </span>
                      <ChevronDown size={14} aria-hidden />
                    </button>
                  )}
                >
                  {(close) => (
                    <div className="menu menu--list">
                      <button
                        type="button"
                        className="menu__item"
                        onClick={() => {
                          closeSource();
                          setConvId(null);
                          close();
                        }}
                      >
                        <Plus size={15} aria-hidden /> Новый вопрос
                      </button>
                      {conversations.items.slice(0, 8).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`menu__item ${c.id === convId ? "is-active" : ""}`}
                          onClick={() => {
                            closeSource();
                            setConvId(c.id);
                            close();
                          }}
                        >
                          <span className="menu__ellipsis">{c.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </Popover>
                <IconButton
                  label="Развернуть на весь экран"
                  size="sm"
                  onClick={() => navigate({ view: "app", conversationId: convId })}
                >
                  <Maximize2 size={15} />
                </IconButton>
                <IconButton label="Свернуть" size="sm" onClick={() => setOpen(false)}>
                  <Minus size={16} />
                </IconButton>
              </header>
            )}
          />
          {source && <SourcePanel variant="overlay" />}
        </div>
      ) : (
        <button type="button" className="launcher" onClick={() => setOpen(true)} aria-label="Открыть JURION">
          <img src={terminal} alt="" width={52} height={40} className="launcher__art" />
          <span>Спросить JURION</span>
        </button>
      )}
    </div>
  );
}
