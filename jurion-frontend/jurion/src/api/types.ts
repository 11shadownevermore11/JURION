// Типы строго по контракту api.md (MVP веб-чата юридического ассистента).

export type KnowledgeBase = { id: string; title: string };

export type Conversation = {
  id: string;
  knowledge_base_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ConversationPage = {
  items: Conversation[];
  next_cursor: string | null;
};

export type MessageBase = {
  id: string;
  seq: number;
  text: string;
  created_at: string;
};

export type UserMessage = MessageBase & { role: "user" };

export type AssistantMessage = MessageBase & {
  role: "assistant";
  answer: Answer;
};

export type Message = UserMessage | AssistantMessage;

export type MessagePage = {
  conversation: Conversation;
  items: Message[];
  next_before_seq: number | null;
  latest_run_id: string | null;
};

export type ApiError = {
  code: string;
  message: string;
  retryable: boolean;
  run_id?: string;
  field_errors?: { field: string; message: string }[];
};

type RunBase = {
  run_id: string;
  conversation_id: string;
  user_message: UserMessage;
};

export type AnswerRun = RunBase &
  (
    | { state: "running"; assistant_message: null; error: null }
    | { state: "completed"; assistant_message: AssistantMessage; error: null }
    | { state: "failed"; assistant_message: null; error: ApiError }
  );

export type Outcome =
  | "answered"
  | "partially_answered"
  | "needs_clarification"
  | "insufficient_evidence"
  | "invalid_premise"
  | "out_of_scope"
  | "disallowed";

export type Answer = {
  outcome: Outcome;
  snapshot_id: string;
  claims: Claim[];
  missing_information: string[];
  clarification_question: string | null;
};

export type Claim = {
  id: string;
  text: string;
  citations: Citation[];
};

export type Citation = {
  chunk_id: string;
  label: string;
  quote: string;
};

export type SourceChunk = {
  chunk_id: string;
  snapshot_id: string;
  document_title: string;
  version_label: string | null;
  provision_label: string | null;
  text: string;
  line_start: number;
  line_end: number;
  file: {
    id: string;
    name: string;
    media_type: string;
    url: string;
  };
};

export type SendMessageBody = {
  text: string;
  as_of_date?: string;
};
