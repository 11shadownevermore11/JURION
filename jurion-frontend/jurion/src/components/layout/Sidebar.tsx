import { useMemo, useState } from "react";
import {
  Bug,
  Database,
  Eraser,
  Keyboard,
  LoaderCircle,
  MessageSquare,
  Moon,
  PanelRightOpen,
  Plus,
  RotateCw,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";
import type { ConversationsState } from "../../hooks/useConversations";
import { dayGroup, type DayGroup } from "../../lib/format";
import { FAIL_NEXT_KEY, resetMockData } from "../../mocks/server";
import { useApp } from "../../state/AppContext";
import { Logo } from "../brand/Logo";
import { PsbLogo } from "../brand/PsbLogo";
import { Aurora } from "../brand/Aurora";
import { Button, IconButton, Kbd } from "../ui/Button";
import { Popover } from "../ui/Popover";

type Props = {
  conversations: ConversationsState & { loadMore: () => void; refresh: () => void };
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  open: boolean;
  onClose: () => void;
  onShowHotkeys: () => void;
};

const ORDER: DayGroup[] = ["Сегодня", "Вчера", "За неделю", "Ранее"];

export function Sidebar({ conversations, activeId, onSelect, onNew, open, onClose, onShowHotkeys }: Props) {
  const { session, theme, toggleTheme, navigate, mocksEnabled, toast } = useApp();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = conversations.items.filter((c) => !q || c.title.toLowerCase().includes(q));
    const map = new Map<DayGroup, typeof filtered>();
    for (const c of filtered) {
      const g = dayGroup(c.updated_at);
      map.set(g, [...(map.get(g) ?? []), c]);
    }
    return ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }, [conversations.items, query]);

  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  return (
    <nav className={`sidebar ${open ? "is-open" : ""}`} aria-label="Диалоги">
      <div className="sidebar__top">
        <PsbLogo className="sidebar__psb" />
        <IconButton label="Закрыть меню" className="sidebar__close" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="sidebar__product">
        <Logo />
      </div>

      <Button
        variant="evidence"
        className="sidebar__new"
        icon={<Plus size={16} />}
        trailing={<Kbd>{isMac ? "⌘K" : "Ctrl K"}</Kbd>}
        onClick={onNew}
      >
        Новый вопрос
      </Button>

      <div className="sidebar__search">
        <Search size={15} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по диалогам"
          aria-label="Поиск по названиям диалогов"
        />
      </div>

      <div className="sidebar__list scroll">
        {conversations.status === "loading" && (
          <div className="sk-list" role="status" aria-label="Загрузка диалогов">
            {[70, 90, 60, 80].map((w, i) => (
              <div key={i} className="sk sk--row" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {conversations.status === "error" && (
          <div className="sidebar__state">
            <p>Список диалогов не загрузился. {conversations.error}</p>
            <Button size="sm" icon={<RotateCw size={14} />} onClick={conversations.refresh}>
              Повторить
            </Button>
          </div>
        )}

        {conversations.status === "ready" && conversations.items.length === 0 && (
          <div className="sidebar__state">
            <MessageSquare size={18} aria-hidden />
            <p>Здесь появятся ваши диалоги. Задайте первый вопрос.</p>
          </div>
        )}

        {conversations.status === "ready" && conversations.items.length > 0 && groups.length === 0 && (
          <div className="sidebar__state">
            <p>Ничего не найдено по запросу «{query}».</p>
          </div>
        )}

        {groups.map(({ group, items }) => (
          <div key={group} className="conv-group">
            <h2 className="conv-group__title">{group}</h2>
            <ul>
              {items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`conv ${c.id === activeId ? "is-active" : ""}`}
                    aria-current={c.id === activeId ? "page" : undefined}
                    onClick={() => onSelect(c.id)}
                    title={c.title}
                  >
                    {c.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {conversations.nextCursor && !query && (
          <Button size="sm" variant="ghost" className="sidebar__more" onClick={conversations.loadMore} loading={conversations.loadingMore}>
            Показать ещё
          </Button>
        )}
      </div>

      <Aurora className="sidebar__aurora" intensity={0.55} />
      <div className="sidebar__foot">
        <div className="kb-pill" title="Ответы формируются только по этой базе знаний">
          {session.status === "ready" ? (
            <>
              <Database size={14} aria-hidden />
              <span>{session.kb.title}</span>
            </>
          ) : (
            <>
              <LoaderCircle size={14} className="spin" aria-hidden />
              <span>Подключение…</span>
            </>
          )}
        </div>
        <div className="sidebar__tools">
          <IconButton label="Режим виджета" onClick={() => navigate({ view: "widget" })}>
            <PanelRightOpen size={17} />
          </IconButton>
          <IconButton label={theme === "dark" ? "Светлая тема" : "Тёмная тема"} onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </IconButton>
          <IconButton label="Горячие клавиши" onClick={onShowHotkeys}>
            <Keyboard size={17} />
          </IconButton>
          {mocksEnabled && (
            <Popover
              id="demo-pop"
              label="Демо-режим"
              side="top"
              align="end"
              trigger={({ open, toggle, id }) => (
                <IconButton label="Демо-режим" onClick={toggle} aria-expanded={open} aria-controls={id} active={open}>
                  <Settings size={17} />
                </IconButton>
              )}
            >
              {(close) => (
                <div className="menu">
                  <p className="menu__note">
                    Бэкенд не подключён: ответы формирует встроенный мок по контракту API на демонстрационных документах.
                  </p>
                  <button
                    type="button"
                    className="menu__item"
                    onClick={() => {
                      localStorage.setItem(FAIL_NEXT_KEY, "1");
                      toast("Следующий ответ завершится технической ошибкой", "info");
                      close();
                    }}
                  >
                    <Bug size={15} aria-hidden /> Сымитировать сбой следующего ответа
                  </button>
                  <button
                    type="button"
                    className="menu__item menu__item--bad"
                    onClick={() => {
                      resetMockData();
                      window.location.hash = "#/";
                      window.location.reload();
                    }}
                  >
                    <Eraser size={15} aria-hidden /> Очистить демо-данные
                  </button>
                </div>
              )}
            </Popover>
          )}
        </div>
      </div>
    </nav>
  );
}
