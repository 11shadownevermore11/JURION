import type { AssistantMessage, UserMessage } from "../api/types";
import { formatDateTime, formatEventDate } from "./format";
import { OUTCOME_META } from "./outcome";

type ReportInput = {
  question: UserMessage | null;
  answer: AssistantMessage;
  asOfDate: string | null;
  conversationTitle: string;
};

/** Плоский текст ответа с основаниями — для копирования в письмо или заключение. */
export function answerToPlainText({ question, answer, asOfDate }: ReportInput): string {
  const lines: string[] = [];
  if (question) lines.push(`Вопрос: ${question.text}`);
  if (asOfDate) lines.push(`Редакция на дату: ${formatEventDate(asOfDate)}`);
  lines.push(`Статус: ${OUTCOME_META[answer.answer.outcome].label}`, "", answer.text);

  const cites = answer.answer.claims.flatMap((c) => c.citations);
  if (cites.length) {
    lines.push("", "Основания:");
    let n = 0;
    for (const claim of answer.answer.claims) {
      for (const c of claim.citations) lines.push(`[${++n}] ${c.label} — «${c.quote}»`);
    }
  }
  if (answer.answer.missing_information.length) {
    lines.push("", "Чего не хватает:");
    answer.answer.missing_information.forEach((m) => lines.push(`— ${m}`));
  }
  lines.push("", `Снимок базы знаний: ${answer.answer.snapshot_id}. Сформировано JURION ${formatDateTime(answer.created_at)}.`);
  return lines.join("\n");
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Печатная справка с основаниями. Открывается системным диалогом печати (можно сохранить в PDF). */
export function printReport(input: ReportInput) {
  const { question, answer, asOfDate, conversationTitle } = input;
  const meta = OUTCOME_META[answer.answer.outcome];
  let n = 0;
  const basis = answer.answer.claims
    .map((claim) => {
      const cites = claim.citations
        .map((c) => `<li><span class="num">[${++n}]</span> <b>${esc(c.label)}</b><blockquote>${esc(c.quote)}</blockquote></li>`)
        .join("");
      return `<section class="claim"><p class="claim-text">${esc(claim.text)}</p>${cites ? `<ol>${cites}</ol>` : ""}</section>`;
    })
    .join("");
  const missing = answer.answer.missing_information.length
    ? `<h2>Чего не хватает для полного ответа</h2><ul>${answer.answer.missing_information.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>`
    : "";

  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Справка JURION — ${esc(conversationTitle)}</title>
<style>
@page{size:A4;margin:22mm 20mm}
body{font-family:"PT Serif",Georgia,serif;color:#0c1a4b;font-size:11.5pt;line-height:1.55;margin:0}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0c1a4b;padding-bottom:8pt;margin-bottom:16pt;font-family:Onest,Arial,sans-serif}
.brand{font-weight:700;font-size:15pt;letter-spacing:.04em}.brand small{display:block;font-weight:400;font-size:8.5pt;letter-spacing:0;color:#6b7497}
.meta{font-size:8.5pt;color:#6b7497;text-align:right}
h1{font-family:Onest,Arial,sans-serif;font-size:14pt;margin:0 0 4pt}
h2{font-family:Onest,Arial,sans-serif;font-size:11pt;margin:18pt 0 6pt}
.status{display:inline-block;font-family:Onest,Arial,sans-serif;font-size:9pt;border:1px solid #c9cde0;border-radius:4pt;padding:1pt 6pt;margin-bottom:10pt}
.q{background:#f3f3f8;padding:8pt 10pt;border-radius:4pt;margin-bottom:12pt}
.answer{white-space:pre-wrap}
.claim{margin:0 0 10pt;break-inside:avoid}.claim-text{margin:0 0 4pt;font-weight:700}
ol{margin:0;padding-left:0;list-style:none}li{margin:0 0 6pt}
.num{color:#c2410c;font-family:Onest,Arial,sans-serif;font-weight:700}
blockquote{margin:3pt 0 0 18pt;padding-left:8pt;border-left:2pt solid #ff5f1f;font-style:italic}
footer{margin-top:24pt;border-top:1px solid #c9cde0;padding-top:6pt;font-family:Onest,Arial,sans-serif;font-size:8pt;color:#6b7497}
</style></head><body>
<header><div class="brand">JURION<small>Юридический интеллект нового поколения · ПСБ</small></div>
<div class="meta">Справка по базе знаний<br>${esc(formatDateTime(answer.created_at))}</div></header>
<h1>${esc(conversationTitle)}</h1>
<div class="status">${esc(meta.label)}${asOfDate ? ` · редакция на ${esc(formatEventDate(asOfDate))}` : ""}</div>
${question ? `<div class="q"><b>Вопрос.</b> ${esc(question.text)}</div>` : ""}
<h2>Ответ</h2><div class="answer">${esc(answer.text)}</div>
${basis ? `<h2>Основания</h2>${basis}` : ""}
${missing}
<footer>Справка сформирована автоматически по снимку базы знаний ${esc(answer.answer.snapshot_id)}. Выводы опираются только на документы базы знаний и требуют проверки юристом перед использованием.</footer>
</body></html>`;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  const run = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  };
  if (doc.readyState === "complete") setTimeout(run, 150);
  else frame.onload = run;
}
