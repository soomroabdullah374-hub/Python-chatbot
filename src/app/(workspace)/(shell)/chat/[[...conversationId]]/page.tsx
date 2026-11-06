import type { Metadata } from 'next';
import { ChatView } from '@/components/chat/ChatView';

export const metadata: Metadata = { title: 'Chat' };

// One page for /chat and /chat/<id>: the view keeps streaming when a new chat gets its id.
export default function ChatPage() {
  return <ChatView />;
}
