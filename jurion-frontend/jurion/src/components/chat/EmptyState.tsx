import { CalendarClock, CircleHelp, FileSearch, ListChecks, MessageSquareText, Quote, ShieldCheck, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import notebook from "../../assets/brand/notebook.webp";
import padlock from "../../assets/brand/padlock.webp";
import terminal from "../../assets/brand/terminal.webp";
import { Aurora } from "../brand/Aurora";

export type Suggestion = { title: string; question: string; asOf?: string; icon: ReactNode };

export const SUGGESTIONS: Suggestion[] = [
  {
    title: "Ответ со ссылкой на пункт",
    question: "Какая арендная плата по договору с ООО «Северный Склад»?",
    icon: <Quote size={18} />,
  },
  {
    title: "Редакция на дату события",
    question: "Какая арендная плата по договору с ООО «Северный Склад»?",
    asOf: "2025-06-01",
    icon: <CalendarClock size={18} />,
  },
  {
    title: "Порядок действий по регламенту",
    question: "Как согласовать договор с контрагентом?",
    icon: <ListChecks size={18} />,
  },
  {
    title: "Честно о том, чего нет в базе",
    question: "Какая ставка НДС применяется к арендной плате по договору с ООО «Северный Склад»?",
    icon: <FileSearch size={18} />,
  },
  {
    title: "Исправление ошибки в вопросе",
    question: "Почему арендная плата по договору с ООО «Северный Склад» составляет 300 000 рублей?",
    icon: <TriangleAlert size={18} />,
  },
  {
    title: "Уточняющий вопрос",
    question: "Какой срок оплаты по договору аренды?",
    icon: <CircleHelp size={18} />,
  },
];

const STEPS = [
  {
    icon: <MessageSquareText size={18} />,
    title: "Спросите обычными словами",
    text: "Назовите договор, контрагента или дату события. Если чего-то не хватит, JURION уточнит.",
  },
  {
    icon: <Quote size={18} />,
    title: "Получите ответ с основаниями",
    text: "Каждый вывод подчёркнут в тексте и связан с конкретным пунктом документа.",
  },
  {
    icon: <ShieldCheck size={18} />,
    title: "Сверьте с оригиналом",
    text: "Цитаты сверяются с текстом положения автоматически, документ открывается рядом с ответом.",
  },
];

type Props = { onPick: (s: Suggestion) => void; compact?: boolean; kbTitle: string };

function SuggestList({ list, onPick }: { list: Suggestion[]; onPick: (s: Suggestion) => void }) {
  return (
    <ul className="suggest" aria-label="Примеры вопросов">
      {list.map((s) => (
        <li key={s.title}>
          <button type="button" className="suggest__item" onClick={() => onPick(s)}>
            <span className="tile" aria-hidden>
              {s.icon}
            </span>
            <span className="suggest__body">
              <span className="suggest__title">{s.title}</span>
              <span className="suggest__q">{s.question}</span>
              {s.asOf && <span className="suggest__asof">Редакция на 01.06.2025</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ onPick, compact, kbTitle }: Props) {
  if (compact) {
    return (
      <div className="empty empty--compact">
        <section className="hero hero--compact">
          <div className="hero__copy">
            <h1 className="hero__title">Чем помочь?</h1>
            <p className="hero__lead">Отвечу по документам «{kbTitle}» со ссылками на пункты.</p>
          </div>
          <img className="hero__terminal" src={terminal} alt="" width={120} height={91} />
          <Aurora className="hero__aurora" />
        </section>
        <SuggestList list={SUGGESTIONS.slice(0, 3)} onPick={onPick} />
      </div>
    );
  }

  return (
    <div className="empty">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__copy">
          <div className="hero__pills">
            <span className="pill pill--orange">ИИ-ассистент</span>
            <span className="pill pill--glass">для юристов ПСБ</span>
          </div>
          <h1 id="hero-title" className="hero__title">
            Найду норму и покажу, на чём держится вывод
          </h1>
          <p className="hero__lead">
            Отвечаю только по документам «{kbTitle}». Если данных не хватает, скажу об этом прямо и назову, чего именно нет.
          </p>
        </div>
        <div className="hero__art" aria-hidden>
          <img className="hero__notebook" src={notebook} alt="" width={640} height={558} />
          <img className="hero__padlock" src={padlock} alt="" width={640} height={412} />
        </div>
        <Aurora className="hero__aurora" />
      </section>

      <section aria-labelledby="steps-title" className="block">
        <h2 id="steps-title" className="block__title">
          Как JURION отвечает
        </h2>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="step">
              <div className="step__top">
                <span className="step__n tnum">{String(i + 1).padStart(2, "0")}</span>
                <span className="tile" aria-hidden>
                  {s.icon}
                </span>
              </div>
              <p className="step__title">{s.title}</p>
              <p className="step__text">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="try-title" className="block">
        <h2 id="try-title" className="block__title">
          Попробуйте спросить
        </h2>
        <SuggestList list={SUGGESTIONS} onPick={onPick} />
      </section>
    </div>
  );
}
