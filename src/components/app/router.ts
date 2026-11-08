'use client';

// Minimal hash router — the whole product lives at "/" as a single-page
// app (sandbox constraint), with in-app navigation via the URL hash.

import { useEffect, useState } from 'react';

export type Route =
  | { view: 'dashboard' }
  | { view: 'admin' }
  | { view: 'events' }
  | { view: 'event'; id: string; tab: string }
  | { view: 'tasks' }
  | { view: 'vendors' }
  | { view: 'finance' }
  | { view: 'team' }
  | { view: 'audit' }
  | { view: 'reports' }
  | { view: 'settings' };

export function parseHash(raw: string): Route {
  const hash = raw.replace(/^#\/?/, '').split('?')[0];
  const parts = hash.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { view: 'dashboard' };
  switch (parts[0]) {
    case 'admin':
      return { view: 'admin' };
    case 'events':
      if (parts[1]) return { view: 'event', id: parts[1], tab: parts[2] ?? 'overview' };
      return { view: 'events' };
    case 'tasks':
    case 'vendors':
    case 'finance':
    case 'team':
    case 'audit':
    case 'reports':
    case 'settings':
      return { view: parts[0] as Route['view'] };
    default:
      return { view: 'dashboard' };
  }
}

export function navigate(path: string) {
  const target = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash === target) return;
  window.location.hash = target;
}

export function routeToHash(r: Route): string {
  switch (r.view) {
    case 'dashboard':
      return '#/dashboard';
    case 'admin':
      return '#/admin';
    case 'events':
      return '#/events';
    case 'event':
      return `#/events/${encodeURIComponent(r.id)}/${r.tab}`;
    default:
      return `#/${r.view}`;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? { view: 'dashboard' } : parseHash(window.location.hash)
  );
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
