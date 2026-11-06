import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ui/Toasts';
import { SessionGate, WorkspaceProvider } from '@/components/workspace/WorkspaceProvider';

// Workspace routes are per-learner and never cached or indexed.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <WorkspaceProvider>
        <SessionGate>{children}</SessionGate>
      </WorkspaceProvider>
    </ToastProvider>
  );
}
