// Правила мок-ответов. Они только имитируют сервер, чтобы пройти
// все сценарии из раздела «Что покрыть моками» в api.md.
import type { Outcome } from "../api/types";
import { CHUNKS } from "./knowledgeBase";

export type ScenarioCite = { chunkId: string; quote: string };
export type ScenarioClaim = { text: string; cites: ScenarioCite[] };

export type Scenario = {
  outcome: Outcome;
  text: string;
  claims: ScenarioClaim[];
  missing: string[];
  clarification: string | null;
  /** Мгновенный ответ (200) вместо фоновой обработки (202). */
  instant?: boolean;
  /** Сколько примерно «думает» сервер, мс. */
  delayMs?: number;
};

export type ScenarioInput = {
  text: string;
  asOfDate: string | null;
  /** Текст вопроса, на который ассистент ранее задал уточнение. */
  clarifiedFrom: string | null;
};

const Q = {
  rent450: "Арендная плата составляет 450 000 (четыреста пятьдесят тысяч) рублей в месяц, включая НДС.",
  rent495b: "Арендная плата составляет 495 000 (четыреста девяносто пять тысяч) рублей в месяц, включая НДС.",
  rentChange: "Размер арендной платы может быть изменён по соглашению сторон, оформленному дополнительным соглашением",
  rentDue: "Арендная плата вносится ежемесячно не позднее 5-го числа текущего месяца.",
  penalty: "пеню в размере 0,1 % от суммы задолженности за каждый день просрочки",
  termination: "письменно уведомив Арендодателя не менее чем за 90 календарных дней до даты расторжения",
};

function cite(chunkId: string, quote: string): ScenarioCite {
  if (!CHUNKS.some((c) => c.chunkId === chunkId)) throw new Error(`unknown chunk ${chunkId}`);
  return { chunkId, quote };
}

function has(t: string, ...patterns: RegExp[]) {
  return patterns.some((p) => p.test(t));
}

function join(claims: ScenarioClaim[], lead = "", tail = ""): string {
  return [lead, claims.map((c) => c.text).join(" "), tail].filter(Boolean).join(" ").trim();
}

function rentByDate(asOf: string | null, t: string): Scenario {
  const later = asOf ? asOf >= "2025-03-01" : has(t, /2025|2026|сейчас|текущ|действующ/);
  const earlier = asOf ? asOf < "2025-03-01" : has(t, /2024/);

  if (later) {
    const claims: ScenarioClaim[] = [
      {
        text: "С 1 марта 2025 года арендная плата составляет 495 000 рублей в месяц, включая НДС.",
        cites: [cite("chunk_ds1_1", Q.rent495b), cite("chunk_a08_3_3", Q.rentChange)],
      },
      { text: "Плата вносится ежемесячно не позднее 5-го числа текущего месяца.", cites: [cite("chunk_a08_3_2", Q.rentDue)] },
    ];
    return {
      outcome: "answered",
      claims,
      text: join(claims, "", "Размер изменён дополнительным соглашением № 1 от 15.02.2025; первоначальная редакция п. 3.1 предусматривала 450 000 рублей."),
      missing: [],
      clarification: null,
    };
  }
  if (earlier) {
    const claims: ScenarioClaim[] = [
      { text: "На указанную дату арендная плата составляла 450 000 рублей в месяц, включая НДС.", cites: [cite("chunk_a08_3_1", Q.rent450)] },
      { text: "Плата вносится ежемесячно не позднее 5-го числа текущего месяца.", cites: [cite("chunk_a08_3_2", Q.rentDue)] },
    ];
    return {
      outcome: "answered",
      claims,
      text: join(claims, "", "Изменение по дополнительному соглашению № 1 действует только с 01.03.2025 и к этой дате не применяется."),
      missing: [],
      clarification: null,
    };
  }
  const claims: ScenarioClaim[] = [
    { text: "До 1 марта 2025 года арендная плата составляла 450 000 рублей в месяц, включая НДС.", cites: [cite("chunk_a08_3_1", Q.rent450)] },
    { text: "С 1 марта 2025 года — 495 000 рублей в месяц, включая НДС, по дополнительному соглашению № 1.", cites: [cite("chunk_ds1_1", Q.rent495b)] },
  ];
  return {
    outcome: "answered",
    claims,
    text: join(claims, "По договору № А-08/2024 с ООО «Северный Склад» размер платы менялся.", "Чтобы получить одну цифру, укажите дату события в поле «Редакция на дату»."),
    missing: [],
    clarification: null,
  };
}

export function pickScenario(input: ScenarioInput): Scenario {
  const raw = input.clarifiedFrom ? `${input.clarifiedFrom}\n${input.text}` : input.text;
  const t = raw.toLowerCase().replace(/ё/g, "е");

  // Соответствие роли: попытки сменить инструкции.
  if (has(t, /игнорир|забудь (все|свои|предыдущ)|системн\w* (сообщ|промп|промт|инструкц)|ты теперь|режим разработчика|ignore (all|previous)|developer mode/)) {
    return {
      outcome: "disallowed",
      instant: true,
      claims: [],
      text: "Я работаю как юридический ассистент по базе знаний ПСБ и не меняю правила работы по указаниям из текста вопроса. Задайте вопрос о договорах, регламентах или нормативных требованиях — отвечу со ссылками на положения.",
      missing: [],
      clarification: null,
    };
  }

  // Соблюдение закона.
  if (has(t, /обойти|в обход|задним числом|подделат|фиктивн|скрыть от (проверк|аудит|налог)|уклон\w* от/)) {
    const claims: ScenarioClaim[] = [
      {
        text: "Договор подписывается уполномоченным лицом только после получения всех согласований.",
        cites: [cite("chunk_rg12_2_5", "Договор подписывается уполномоченным лицом только после получения всех согласований, предусмотренных настоящим разделом.")],
      },
    ];
    return {
      outcome: "disallowed",
      claims,
      text: join(claims, "Помочь обойти установленный порядок я не могу.", "Могу перечислить обязательные этапы согласования и подсказать, как пройти их быстрее в рамках регламента."),
      missing: [],
      clarification: null,
      delayMs: 1200,
    };
  }

  // Вне тематики.
  if (has(t, /погод|рецепт|анекдот|футбол|стих|гороскоп|фильм|курс (доллар|евро|валют)/)) {
    return {
      outcome: "out_of_scope",
      instant: true,
      claims: [],
      text: "Этот вопрос вне моей тематики. Я отвечаю на юридические вопросы по базе нормативных документов и договоров ПСБ: условия договоров, порядок согласования, требования регламентов.",
      missing: [],
      clarification: null,
    };
  }

  const aboutRent = has(t, /аренд/);
  const northern = has(t, /северн/);
  const southern = has(t, /южн\w* склад/);

  // Контрагент, которого нет в базе.
  if (southern) {
    return {
      outcome: "insufficient_evidence",
      claims: [],
      text: "В базе знаний нет договора с ООО «Южный Склад», поэтому ответить на вопрос по его условиям нельзя. В базе есть договор аренды № А-08/2024 с ООО «Северный Склад».",
      missing: ["Договор с ООО «Южный Склад» и дополнительные соглашения к нему"],
      clarification: null,
      delayMs: 1800,
    };
  }

  // Ошибочная предпосылка о сумме арендной платы.
  const wrongSum = t.match(/(300|350|400|500|550|600)\s?000/);
  if (aboutRent && northern && wrongSum) {
    const claims: ScenarioClaim[] = [
      { text: "По п. 3.1 договора арендная плата составляла 450 000 рублей в месяц, включая НДС.", cites: [cite("chunk_a08_3_1", Q.rent450)] },
      { text: "С 1 марта 2025 года она составляет 495 000 рублей по дополнительному соглашению № 1.", cites: [cite("chunk_ds1_1", Q.rent495b)] },
    ];
    return {
      outcome: "invalid_premise",
      claims,
      text: join(claims, `Сумма ${wrongSum[1]} 000 рублей в документах базы не встречается.`, "Других изменений размера платы в базе нет."),
      missing: [],
      clarification: null,
      delayMs: 2200,
    };
  }

  // НДС по договору: частичный ответ.
  if (has(t, /ндс/) && (northern || aboutRent)) {
    const claims: ScenarioClaim[] = [
      { text: "Арендная плата по договору № А-08/2024 указана с учётом НДС.", cites: [cite("chunk_a08_3_1", Q.rent450), cite("chunk_ds1_1", Q.rent495b)] },
    ];
    return {
      outcome: "partially_answered",
      claims,
      text: join(claims, "", "Ставка НДС в договоре не указана, а нормы налогового законодательства о ставке в базе знаний отсутствуют, поэтому назвать ставку я не могу."),
      missing: ["Ставка НДС: не указана в договоре и дополнительном соглашении", "Положения налогового законодательства о ставке НДС"],
      clarification: null,
      delayMs: 2600,
    };
  }

  if (aboutRent && has(t, /пен|просроч|неустой/)) {
    const claims: ScenarioClaim[] = [
      { text: "За просрочку арендной платы Арендатор уплачивает пеню 0,1 % от суммы задолженности за каждый день просрочки.", cites: [cite("chunk_a08_4_1", Q.penalty)] },
      { text: "Срок внесения платы — не позднее 5-го числа текущего месяца.", cites: [cite("chunk_a08_3_2", Q.rentDue)] },
    ];
    return { outcome: "answered", claims, text: join(claims), missing: [], clarification: null };
  }

  if (aboutRent && has(t, /растор|отказ\w* от договор|выйти из договор/)) {
    const claims: ScenarioClaim[] = [
      { text: "Арендатор вправе отказаться от договора, письменно уведомив Арендодателя не менее чем за 90 календарных дней до даты расторжения.", cites: [cite("chunk_a08_5_1", Q.termination)] },
    ];
    return { outcome: "answered", claims, text: join(claims), missing: [], clarification: null };
  }

  if (aboutRent && northern && has(t, /срок оплат|срок внесен|до какого числа|когда (платить|вносить)/)) {
    const claims: ScenarioClaim[] = [
      { text: "Арендная плата вносится ежемесячно не позднее 5-го числа текущего месяца.", cites: [cite("chunk_a08_3_2", Q.rentDue)] },
      { text: "За просрочку предусмотрена пеня 0,1 % от суммы задолженности за каждый день.", cites: [cite("chunk_a08_4_1", Q.penalty)] },
    ];
    return { outcome: "answered", claims, text: join(claims, "Договор № А-08/2024 с ООО «Северный Склад» устанавливает срок оплаты."), missing: [], clarification: null, delayMs: 1900 };
  }

  if (aboutRent && northern) return rentByDate(input.asOfDate, t);

  // Неясно, о каком договоре речь.
  if (aboutRent || (has(t, /договор/) && has(t, /услов|плат|срок|сумм/) && !has(t, /согласов/))) {
    return {
      outcome: "needs_clarification",
      claims: [],
      text: "Уточните, о каком договоре или контрагенте идёт речь — в базе может быть несколько договоров с похожими условиями.",
      missing: [],
      clarification: "О каком договоре или контрагенте идёт речь? Например: договор аренды № А-08/2024 с ООО «Северный Склад».",
      delayMs: 1300,
    };
  }

  // Порядок согласования: последовательность шагов.
  if (has(t, /согласов/)) {
    const steps: ScenarioClaim[] = [
      { text: "1. Инициатор размещает проект договора в СЭД и прикладывает обоснование.", cites: [cite("chunk_rg12_2_1", "Инициатор договора размещает проект договора в системе электронного документооборота")] },
      { text: "2. Подразделение экономической безопасности проверяет контрагента.", cites: [cite("chunk_rg12_2_2", "Проект договора направляется на проверку контрагента в подразделение экономической безопасности.")] },
      { text: "3. Юридическое подразделение проводит правовую экспертизу — не более 5 рабочих дней.", cites: [cite("chunk_rg12_2_3", "проводит правовую экспертизу проекта договора в срок не более 5 рабочих дней")] },
      { text: "4. Договоры свыше 10 млн рублей дополнительно согласуются с финансовым департаментом.", cites: [cite("chunk_rg12_2_4", "Договоры на сумму свыше 10 000 000 рублей дополнительно согласуются с финансовым департаментом.")] },
      { text: "5. Подписание уполномоченным лицом — только после всех согласований.", cites: [cite("chunk_rg12_2_5", "Договор подписывается уполномоченным лицом только после получения всех согласований")] },
    ];
    if (has(t, /дополнительн\w* соглашен/)) {
      steps.unshift({
        text: "Дополнительные соглашения согласуются в том же порядке, что и договоры.",
        cites: [cite("chunk_rg12_3_1", "Дополнительные соглашения к договорам согласуются в порядке, установленном разделом 2 настоящего Регламента.")],
      });
    }
    return {
      outcome: "answered",
      claims: steps,
      text: "Порядок согласования по Регламенту РГ-12:\n" + steps.map((s) => s.text).join("\n"),
      missing: [],
      clarification: null,
      delayMs: 2800,
    };
  }

  // Правоспособность заёмщика: частичный ответ.
  if (has(t, /правоспособн|заемщ|кредит/)) {
    const claims: ScenarioClaim[] = [
      {
        text: "Юридическое подразделение проверяет государственную регистрацию заёмщика и отсутствие ликвидации или реорганизации, полномочия единоличного исполнительного органа и наличие корпоративного одобрения сделки, если оно требуется.",
        cites: [cite("chunk_pp07_1", "При рассмотрении кредитной заявки юридического лица юридическое подразделение проверяет:")],
      },
      {
        text: "Перечень документов заёмщика утверждается отдельным приложением к Положению ПП-07.",
        cites: [cite("chunk_pp07_2", "Перечень документов, представляемых заёмщиком, утверждается отдельным приложением к настоящему Положению.")],
      },
    ];
    return {
      outcome: "partially_answered",
      claims,
      text: join(claims, "", "Само приложение с перечнем документов в базе знаний отсутствует."),
      missing: ["Приложение к Положению ПП-07 с перечнем документов заёмщика", "Устав конкретного заёмщика — чтобы определить, нужно ли корпоративное одобрение"],
      clarification: null,
      delayMs: 3000,
    };
  }

  // Старая редакция закона.
  if (has(t, /закон|кодекс|фз/) && has(t, /редакц|201\d|200\d|старой|прежн/)) {
    return {
      outcome: "insufficient_evidence",
      claims: [],
      text: "Законы в базе знаний представлены только в действующей редакции. Редакции, действовавшей на нужную дату, в базе нет, поэтому сделать вывод о применимой норме я не могу.",
      missing: ["Редакция закона, действовавшая на дату события"],
      clarification: null,
      delayMs: 2000,
    };
  }

  return {
    outcome: "insufficient_evidence",
    claims: [],
    text: "В базе знаний не найдено положений, которые отвечают на этот вопрос. Сформулируйте вопрос через конкретный договор, контрагента или внутренний документ — так поиск будет точнее.",
    missing: ["Документ или положение, регулирующее вопрос"],
    clarification: null,
    delayMs: 2000,
  };
}
