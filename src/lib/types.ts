import type {
  Depth,
  ExperienceLevel,
  ExplanationLanguage,
  Language,
  MessageStatus,
  Mode,
} from '@shared/constants.ts';

export type { Depth, ExperienceLevel, ExplanationLanguage, Language, MessageStatus, Mode };

export interface Profile {
  id: string;
  preferred_language: Language;
  explanation_language: ExplanationLanguage;
  experience_level: ExperienceLevel;
  explanation_depth: Depth;
  enter_to_send: boolean;
  reduce_motion: boolean;
  onboarded_at: string | null;
}

export type ProfilePrefs = Pick<
  Profile,
  'preferred_language' | 'explanation_language' | 'experience_level' | 'explanation_depth' | 'enter_to_send' | 'reduce_motion'
>;

export interface Conversation {
  id: string;
  title: string;
  mode: Mode;
  language: Language;
  created_at: string;
  updated_at: string;
}

export interface Source {
  label: string;
  title: string;
  url: string | null;
  section: string | null;
}

export type Rating = 'helpful' | 'not_helpful';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: MessageStatus;
  mode: Mode;
  language: Language;
  created_at: string;
  turnId: string | null;
  sources: Source[];
  rating: Rating | null;
  bookmarked: boolean;
}

export interface SavedItem {
  message_id: string;
  saved_at: string;
  conversation_id: string;
  mode: Mode;
  language: Language;
  content: string;
  conversation_title: string;
  question: string | null;
}

export type TurnStage = 'submitting' | 'accepted' | 'retrieving' | 'streaming' | 'saving' | 'completed';
