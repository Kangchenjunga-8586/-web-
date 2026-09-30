import { useCallback, useEffect, useState } from 'react';

export const TAB_ROUTES = ['home', 'history', 'plan', 'settings'] as const;
export type TabRoute = (typeof TAB_ROUTES)[number];
export const SUB_ROUTES = ['settings/income', 'settings/expenses', 'settings/categories'] as const;
export type SubRoute = (typeof SUB_ROUTES)[number];
export type Route = TabRoute | SubRoute;

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === '') return 'home';
  if ((TAB_ROUTES as readonly string[]).includes(path)) return path as TabRoute;
  if ((SUB_ROUTES as readonly string[]).includes(path)) return path as SubRoute;
  return 'home';
}

export function parentOf(route: Route): TabRoute {
  return route.startsWith('settings') ? 'settings' : (route as TabRoute);
}

const hrefFor = (route: Route) => (route === 'home' ? '#/' : `#/${route}`);

let pushedSubRoute = false;

/** Minimal hash router: tabs replace history, sub-pages push so Safari back works. */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    if (parseHash(window.location.hash) === next) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if ((SUB_ROUTES as readonly string[]).includes(next)) {
      pushedSubRoute = true;
      window.location.hash = hrefFor(next);
    } else {
      pushedSubRoute = false;
      window.location.replace(hrefFor(next));
    }
  }, []);

  const back = useCallback(() => {
    const current = parseHash(window.location.hash);
    if (pushedSubRoute) {
      pushedSubRoute = false;
      window.history.back();
    } else {
      window.location.replace(hrefFor(parentOf(current)));
    }
  }, []);

  return { route, navigate, back };
}
