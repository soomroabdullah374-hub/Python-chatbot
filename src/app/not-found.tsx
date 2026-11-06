import Link from 'next/link';
import { Logo } from '@/components/ui/Icon';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main id="main-content" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card card-lg pop" style={{ width: '100%', maxWidth: 460, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
        <Logo size={40} />
        <span className="eyebrow">404</span>
        <h1 className="h3">This page doesn&apos;t exist</h1>
        <p className="muted" style={{ fontSize: 15 }}>
          There&apos;s nothing to sign in to — CodeBloom opens straight to the tutor.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, paddingTop: 6 }}>
          <Link href="/chat" className="btn btn-primary">
            Open CodeBloom
          </Link>
          <Link href="/" className="btn btn-secondary">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
