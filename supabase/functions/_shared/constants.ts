// Shared, runtime-agnostic constants (imported by Edge Functions and the Next.js app).

export const PROMPT_VERSION = 'codebloom-tutor-v1';
export const EMBEDDING_MODEL = 'gte-small';
export const EMBEDDING_VERSION = 'gte-small-384-v1';
export const EMBEDDING_DIMENSIONS = 384;

export const MODES = ['explain', 'debug', 'practice'] as const;
export type Mode = (typeof MODES)[number];

export const LANGUAGES = ['python', 'javascript', 'typescript', 'sql', 'html_css'] as const;
export type Language = (typeof LANGUAGES)[number];

export const EXPLANATION_LANGUAGES = ['en', 'roman_ur'] as const;
export type ExplanationLanguage = (typeof EXPLANATION_LANGUAGES)[number];

export const EXPERIENCE_LEVELS = ['new', 'basics', 'comfortable'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const DEPTHS = ['concise', 'detailed'] as const;
export type Depth = (typeof DEPTHS)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  sql: 'SQL',
  html_css: 'HTML/CSS',
};

export const MODE_LABELS: Record<Mode, string> = {
  explain: 'Explain',
  debug: 'Debug',
  practice: 'Practice',
};

/** Application limits (TRD "Application limits"). Server-enforced; the UI mirrors them. */
export const LIMITS = {
  maxMessageChars: 12_000,
  maxRequestBodyBytes: 32 * 1024,
  maxOutputChars: 30_000,
  maxRetrievedChunks: 4,
  maxReferenceChars: 900,
  historyChars: 6_000,
  historyMessages: 10,
  chatDeadlineMs: 90_000,
  upstreamIdleTimeoutMs: 30_000,
  cancelPollMs: 1_500,
  retrievalTimeoutMs: 8_000,
  maxTitleChars: 120,
} as const;

export const TURN_ACTIVE_STATUSES = ['accepted', 'retrieving', 'streaming'] as const;
export type TurnStatus = 'accepted' | 'retrieving' | 'streaming' | 'completed' | 'failed' | 'interrupted' | 'incomplete';
export type MessageStatus = 'streaming' | 'completed' | 'failed' | 'interrupted' | 'incomplete';
