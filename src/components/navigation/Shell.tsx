'use client';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { SidebarBody } from './Sidebar';

interface ShellValue {
  openDrawer(): void;
  sidebarCollapsed: boolean;
  expandSidebar(): void;
}
const ShellContext = createContext<ShellValue>({ openDrawer: () => undefined, sidebarCollapsed: false, expandSidebar: () => undefined });
export const useShell = () => useContext(ShellContext);

const COLLAPSE_KEY = 'cb:sidebar-collapsed';

/** Workspace shell: sidebar (desktop) or slide-in drawer (mobile, Design.md "Layout"). */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  // The shell only mounts client-side (inside SessionGate), so storage can seed state directly.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [shownPath, setShownPath] = useState(pathname);
  const drawerRef = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  if (shownPath !== pathname) {
    setShownPath(pathname);
    setDrawer(false);
  }

  const setCollapsedPersist = useCallback((v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0');
    } catch {
      // ignore
    }
  }, []);

  const openDrawer = useCallback(() => {
    opener.current = document.activeElement as HTMLElement | null;
    setDrawer(true);
  }, []);
  const closeDrawer = useCallback(() => {
    setDrawer(false);
    opener.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!drawer) return;
    drawerRef.current?.querySelector<HTMLElement>('a, button, input')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
      if (e.key === 'Tab' && drawerRef.current) {
        const els = drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input');
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawer, closeDrawer]);

  return (
    <ShellContext.Provider value={{ openDrawer, sidebarCollapsed: collapsed, expandSidebar: () => setCollapsedPersist(false) }}>
      <div className={`ws${collapsed ? ' side-collapsed' : ''}`}>
        <aside className="side" aria-label="Sidebar">
          <SidebarBody variant="desktop" onCollapse={() => setCollapsedPersist(true)} />
        </aside>
        <div className="main" id="main-content">
          {children}
        </div>
      </div>
      {drawer && (
        <>
          <div className="scrim" aria-hidden="true" onClick={closeDrawer} />
          <nav ref={drawerRef} className="drawer" aria-label="Main menu">
            <SidebarBody variant="drawer" onNavigate={() => setDrawer(false)} onClose={closeDrawer} />
          </nav>
        </>
      )}
    </ShellContext.Provider>
  );
}
