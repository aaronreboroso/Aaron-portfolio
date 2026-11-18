import { AlertCircle, Check, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Button, Loading } from '../components/UI';
import { api, go, useTask } from './client';
import type { Draft, Mode, State } from './types';
export type AuthMode = 'signin' | 'signup' | 'reset';
interface Context {
  data: State;
  refresh: () => Promise<void>;
  notify: (msg: string) => void;
  auth: (mode: AuthMode) => void;
  authMode: AuthMode | null;
  closeAuth: () => void;
  draft: Draft | null;
  setDraft: (p: Draft | null) => void;
  prompt: string;
  setPrompt: (s: string) => void;
  mode: Mode;
  setMode: (s: Mode) => void;
  engine: string;
  setEngine: (s: string) => void;
  analyze: (text?: string, template?: string) => Promise<void>;
  analyzing: boolean;
  analysisError: string;
  setAnalysisError: (s: string) => void;
  newProject: () => void;
}
const C = createContext<Context | null>(null);
export const useWorkspace = () => useContext(C)!;
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<State | null>(null),
    [bootError, setBootError] = useState(''),
    [authMode, auth] = useState<AuthMode | null>(null),
    [message, setMessage] = useState(''),
    [draft, setDraft] = useState<Draft | null>(null),
    [prompt, setPrompt] = useState(''),
    [mode, setMode] = useState<Mode>('Automatic'),
    [engine, setEngine] = useState(''),
    task = useTask();
  const refresh = useCallback(async () => {
    setData(await api<State>('/workspace'));
  }, []);
  const boot = useCallback(async () => {
    setBootError('');
    try {
      await api('/session/guest', 'POST');
      const s = await api<State>('/workspace');
      setData(s);
      setMode(s.user.preferences.mode || 'Automatic');
    } catch (e) {
      setBootError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void boot();
  }, [boot]);
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 4800);
      return () => clearTimeout(t);
    }
  }, [message]);
  const analyze = async (text = prompt, template?: string) => {
    if (text.trim().length < 6) {
      task.setError('Describe what you want to build in at least 6 characters.');
      document.querySelector<HTMLTextAreaElement>('[data-prompt]')?.focus();
      return;
    }
    await task.run(async () => {
      const p = await api<Draft>('/plans', 'POST', {
        prompt: text,
        mode,
        template,
        provider: engine || undefined,
      });
      setPrompt(text);
      setDraft(p);
      go('/create?stage=plan');
      await refresh();
    });
  };
  if (!data)
    return bootError ? (
      <div className="boot-error">
        <AlertCircle />
        <h2>Workspace could not open</h2>
        <p>{bootError}</p>
        <Button onClick={boot}>Try again</Button>
      </div>
    ) : (
      <Loading text="Preparing your private workspace…" />
    );
  return (
    <C.Provider
      value={{
        data,
        refresh,
        notify: setMessage,
        auth,
        authMode,
        closeAuth: () => auth(null),
        draft,
        setDraft,
        prompt,
        setPrompt,
        mode,
        setMode,
        engine,
        setEngine,
        analyze,
        analyzing: task.busy,
        analysisError: task.error,
        setAnalysisError: task.setError,
        newProject: () => {
          setDraft(null);
          setPrompt('');
          task.setError('');
          go('/create');
        },
      }}
    >
      {children}
      {message && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{message}</span>
          <button aria-label="Dismiss notification" onClick={() => setMessage('')}>
            <X size={15} />
          </button>
        </div>
      )}
    </C.Provider>
  );
}
