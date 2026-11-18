import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import {
  Braces,
  Code2,
  FileCode2,
  FilePlus2,
  FileText,
  FolderOpen,
  Save,
  Search,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, ErrorLine, Field, IconButton, Modal } from '../components/UI';
import { api, useTask } from '../lib/client';
import type { Project } from '../lib/types';
import { useWorkspace } from '../lib/workspace';
export default function Code({ p, reload }: { p: Project; reload: () => Promise<void> }) {
  const [path, setPath] = useState('index.html'),
    [value, setValue] = useState(p.files['index.html']),
    [query, search] = useState(''),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(''),
    [assist, openAssist] = useState(false),
    [action, setAction] = useState('Explain code'),
    [answer, setAnswer] = useState(''),
    view = useRef<EditorView | null>(null),
    w = useWorkspace(),
    task = useTask(),
    helper = useTask();
  const dirty = value !== p.files[path];
  useEffect(() => {
    setValue(p.files[path] || '');
  }, [path, p.files]);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [dirty]);
  const save = () =>
    task.run(async () => {
      await api('/projects/' + p.id + '/files', 'PUT', {
        path,
        content: value,
        base: p.files[path],
      });
      await reload();
      w.notify('File validated and saved. A new version is available.');
    });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty && !task.busy) void save();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const extensions = useMemo(() => {
    const ext = path.split('.').at(-1);
    return [
      ...(ext === 'html'
        ? [html()]
        : ext === 'css'
          ? [css()]
          : ['js', 'mjs', 'ts', 'tsx', 'jsx'].includes(ext || '')
            ? [javascript({ jsx: ext?.endsWith('x'), typescript: ext?.startsWith('ts') })]
            : ext === 'json'
              ? [json()]
              : []),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': { fontSize: '12px', backgroundColor: '#101015' },
        '.cm-gutters': {
          backgroundColor: '#131318',
          color: '#656575',
          borderRight: '1px solid #262630',
        },
        '.cm-activeLine': { backgroundColor: '#1f1c24' },
      }),
    ];
  }, [path]);
  const list = Object.keys(p.files).filter(
    (k) => !query || (k + ' ' + p.files[k]).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="code-layout">
        <aside className="file-explorer">
          <div className="small-panel-title">
            <span>
              <FolderOpen size={14} />
              Explorer
            </span>
            <IconButton label="Create source file" onClick={() => setCreating(true)}>
              <FilePlus2 size={14} />
            </IconButton>
          </div>
          <div className="input-with-icon small-search">
            <Search size={13} />
            <input
              placeholder="Search project…"
              aria-label="Search project source"
              value={query}
              onChange={(e) => search(e.target.value)}
            />
          </div>
          <div className="file-list">
            {list.map((f) => (
              <button
                key={f}
                className={path === f ? 'active' : ''}
                onClick={() => {
                  if (!dirty || window.confirm('Discard unsaved changes to this file?')) setPath(f);
                }}
              >
                {/\.json$/.test(f) ? (
                  <Braces size={13} />
                ) : f.endsWith('.md') ? (
                  <FileText size={13} />
                ) : (
                  <FileCode2 size={13} />
                )}
                <span>{f}</span>
              </button>
            ))}
            {!list.length && <small>No matching files.</small>}
          </div>
        </aside>
        <div className="editor-main">
          <div className="editor-head">
            <span>
              <FileCode2 size={14} />
              {path}
              {dirty && <i />}
            </span>
            <Button
              onClick={() => {
                openAssist(true);
                setAnswer('');
                helper.setError('');
              }}
            >
              <Sparkles size={13} />
              Assist
            </Button>
            <Button busy={task.busy} disabled={!dirty} onClick={save}>
              <Save size={13} />
              Save
            </Button>
          </div>
          <CodeMirror
            key={path}
            value={value}
            height="460px"
            theme="dark"
            extensions={extensions}
            onCreateEditor={(v) => (view.current = v)}
            onChange={setValue}
            basicSetup={{ foldGutter: true, highlightActiveLine: true, autocompletion: true }}
          />
          <div className="editor-status">
            <span>{dirty ? 'Unsaved changes' : 'Saved source'}</span>
            <span>{value.split('\n').length} lines · UTF-8</span>
          </div>
        </div>
      </div>
      <ErrorLine text={task.error} />
      {creating && (
        <Modal
          title="Create source file"
          kicker="PROJECT FILESYSTEM"
          close={() => setCreating(false)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                await api('/projects/' + p.id + '/files', 'PUT', {
                  path: name,
                  content: name.endsWith('.json') ? '{}' : '',
                  create: true,
                });
                await reload();
                setPath(name);
                setName('');
                setCreating(false);
                w.notify('Source file created.');
              });
            }}
          >
            <Field
              label="Relative file path"
              hint="HTML, CSS, JS, TS, JSX, TSX, JSON, SQL, Markdown and text are supported."
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="components/widget.js"
                required
              />
            </Field>
            <ErrorLine text={task.error} />
            <Button type="submit" variant="primary" busy={task.busy}>
              Create file
            </Button>
          </form>
        </Modal>
      )}
      {assist && (
        <Modal title="Code assistant" kicker="DEVELOPER TOOLS" close={() => openAssist(false)}>
          <div className="form-stack">
            <p>
              Inspect the saved file or select a code range in the editor. Suggestions never
              overwrite your source.
            </p>
            <Field label="Task">
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setAnswer('');
                }}
              >
                {[
                  'Explain code',
                  'Find errors',
                  'Suggest improvements',
                  'Generate component',
                  'Refactor selection',
                ].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
            <div className="inline-notice">
              <Code2 size={15} />
              {path} ·{' '}
              {w.data.providers.some((s) => s.configured)
                ? 'Configured provider'
                : 'Local validation available'}
            </div>
            <Button
              variant="primary"
              busy={helper.busy}
              onClick={() =>
                helper.run(async () => {
                  const s = view.current?.state.selection.main,
                    selection = s ? view.current?.state.sliceDoc(s.from, s.to) : '';
                  const r = await api<{ text: string; source: string; notes?: string[] }>(
                    '/projects/' + p.id + '/assist',
                    'POST',
                    { path, action, selection },
                  );
                  setAnswer([...(r.notes || []), r.source, r.text].join('\n\n'));
                  await w.refresh();
                })
              }
            >
              Run {action === 'Find errors' ? 'validation' : 'assistant'}
            </Button>
            <ErrorLine text={helper.error} />
            {answer && <pre className="output">{answer}</pre>}
          </div>
        </Modal>
      )}
    </>
  );
}
