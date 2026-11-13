import type { Answer, Citation } from "../api/types";

export type NumberedCitation = Citation & { n: number; claimId: string; claimText: string };

/** Сквозная нумерация цитат ответа: [1], [2]… в порядке выводов. */
export function numberCitations(answer: Answer): NumberedCitation[] {
  let n = 0;
  return answer.claims.flatMap((claim) =>
    claim.citations.map((c) => ({ ...c, n: ++n, claimId: claim.id, claimText: claim.text })),
  );
}

export type Segment = { text: string; claimId: string | null };

/**
 * Делит текст ответа на фрагменты, привязанные к выводам (claims).
 * Если формулировка вывода дословно встречается в тексте, она становится
 * интерактивной: рядом появляются номера оснований.
 */
export function segmentAnswer(text: string, answer: Answer): { segments: Segment[]; inlineClaimIds: Set<string> } {
  const spans: { start: number; end: number; claimId: string }[] = [];
  for (const claim of answer.claims) {
    if (!claim.citations.length || !claim.text.trim()) continue;
    let from = 0;
    let at = -1;
    while ((at = text.indexOf(claim.text, from)) !== -1) {
      const end = at + claim.text.length;
      if (!spans.some((s) => at < s.end && end > s.start)) {
        spans.push({ start: at, end, claimId: claim.id });
        break;
      }
      from = at + 1;
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start > pos) segments.push({ text: text.slice(pos, s.start), claimId: null });
    segments.push({ text: text.slice(s.start, s.end), claimId: s.claimId });
    pos = s.end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos), claimId: null });
  return { segments, inlineClaimIds: new Set(spans.map((s) => s.claimId)) };
}
