'use client';
// Invisible Cloudflare Turnstile for silent anonymous sign-in (IDENTITY.md). Only active when
// NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; nothing for the learner to click.
import { env } from '@/lib/env';

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  execute(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile failed to load'));
    document.head.appendChild(s);
  });
  return loading;
}

export async function getCaptchaToken(): Promise<string | undefined> {
  if (!env.turnstileSiteKey) return undefined;
  await loadScript();
  const api = window.turnstile;
  if (!api) return undefined;
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.bottom = '0';
  host.style.right = '0';
  document.body.appendChild(host);
  return new Promise<string | undefined>((resolve, reject) => {
    const id = api.render(host, {
      sitekey: env.turnstileSiteKey,
      size: 'invisible',
      callback: (token: string) => {
        resolve(token);
        setTimeout(() => {
          api.remove(id);
          host.remove();
        }, 0);
      },
      'error-callback': () => {
        api.remove(id);
        host.remove();
        reject(new Error('captcha failed'));
      },
    });
    api.execute(id);
  });
}
