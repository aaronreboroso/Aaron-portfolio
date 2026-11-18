import { useCallback, useState, useSyncExternalStore } from 'react';
export async function api<T = Record<string, unknown>>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-ATROX-Request': 'workspace' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Error('Connection interrupted. Check your connection and try again.');
  }
  let json;
  try {
    json = await response.json();
  } catch {
    throw Error('The server did not return a valid response. Please retry.');
  }
  if (!response.ok) throw Error(json.error || 'This request could not be completed.');
  return json;
}
const subscribe = (cb: () => void) => {
  window.addEventListener('popstate', cb);
  return () => window.removeEventListener('popstate', cb);
};
export const usePath = () =>
  useSyncExternalStore(subscribe, () => location.pathname + location.search);
export function go(path: string) {
  if (location.pathname + location.search === path) return;
  history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}
export function useTask() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const run = useCallback(async <T>(work: () => Promise<T>) => {
    setBusy(true);
    setError('');
    try {
      return await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please retry.');
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}
export function relative(t: number) {
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
  return m < 1
    ? 'just now'
    : m < 60
      ? `${m}m ago`
      : m < 1440
        ? `${Math.floor(m / 60)}h ago`
        : `${Math.floor(m / 1440)}d ago`;
}
export const stamp = (t: number) =>
  new Date(t).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
export const artFor = (kind: string) =>
  '/art/' +
  ({ inventory: 'inventory', analytics: 'analytics', workflow: 'inventory', commerce: 'analytics' }[
    kind
  ] || 'crm') +
  '.svg';
export const kindName = (kind: string) =>
  ({
    crm: 'CRM system',
    inventory: 'Inventory manager',
    analytics: 'Data dashboard',
    learning: 'Learning platform',
    workflow: 'Workflow app',
    commerce: 'Business platform',
    custom: 'Web application',
  })[kind] || 'Web application';
export const number = (n: number) => String(n).padStart(2, '0');

/** Newline-delimited, server-emitted build milestones. No client-side progress timers. */
export async function streamBuild(
  spec: import('./types').Spec,
  onStep: (s: import('./types').BuildStep) => void,
): Promise<string> {
  const res = await fetch('/api/projects/build', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-ATROX-Request': 'workspace' },
    body: JSON.stringify({ spec }),
  });
  if (!res.ok) throw Error((await res.json()).error || 'Build rejected.');
  const reader = res.body?.getReader();
  if (!reader) throw Error('Build response unavailable.');
  const decoder = new TextDecoder();
  let buffer = '',
    pid = '';
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines.filter(Boolean)) {
      const e = JSON.parse(line);
      if (e.error) throw Error(e.error);
      if (e.stage) onStep(e);
      if (e.id) pid = e.id;
    }
    if (done) break;
  }
  if (!pid)
    throw Error(
      'The build connection closed without a receipt. Check My Projects before retrying.',
    );
  return pid;
}
