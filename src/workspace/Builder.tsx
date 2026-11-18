import {
  ChevronDown,
  ChevronUp,
  Component,
  Layers3,
  Palette,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { componentTypes, pageFrom, pretty } from '../../shared/catalog.mjs';
import { Button, ErrorLine, Field, IconButton } from '../components/UI';
import { api, useTask } from '../lib/client';
import type { Block, Project, Spec } from '../lib/types';
import { useWorkspace } from '../lib/workspace';
import { Preview } from './Preview';
export function Builder({ p, reload }: { p: Project; reload: () => Promise<void> }) {
  const [s, setS] = useState<Spec>(() => structuredClone(p.spec)),
    [pid, setPid] = useState(s.pages[0].id),
    [sel, setSel] = useState(s.pages[0].components[0]?.id || ''),
    [type, setType] = useState('cards'),
    [adder, setAdder] = useState(false),
    [name, setName] = useState('');
  const w = useWorkspace(),
    task = useTask(),
    page = s.pages.find((p) => p.id === pid) || s.pages[0],
    block = page.components.find((c) => c.id === sel);
  const blocks = (arr: Block[]) =>
      setS({ ...s, pages: s.pages.map((p) => (p.id === pid ? { ...p, components: arr } : p)) }),
    edit = (key: keyof Block, val: string | number) =>
      blocks(page.components.map((c) => (c.id === sel ? { ...c, [key]: val } : c)));
  const reorder = (i: number, d: number) => {
    const a = [...page.components];
    [a[i], a[i + d]] = [a[i + d], a[i]];
    blocks(a);
  };
  return (
    <div className="stack">
      <div className="builder-banner">
        <div>
          <strong>Visual builder</strong>
          <p>
            Edit the component tree. Save to update <code>app.config.json</code>.
          </p>
        </div>
        <Button
          variant="primary"
          disabled={JSON.stringify(s) === JSON.stringify(p.spec)}
          busy={task.busy}
          onClick={() =>
            task.run(async () => {
              await api('/projects/' + p.id + '/design', 'PUT', { spec: s, base: p.updated });
              await reload();
              w.notify('Design saved to project source.');
            })
          }
        >
          <Save size={14} />
          Save design
        </Button>
      </div>
      <ErrorLine text={task.error} />
      <div className="builder-layout">
        <aside className="panel builder-tree">
          <div className="small-panel-title">
            <span>
              <Layers3 size={14} />
              Page structure
            </span>
            <IconButton label="Add page" onClick={() => setAdder(!adder)}>
              <Plus size={14} />
            </IconButton>
          </div>
          {adder && (
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                const pg = pageFrom(name) as Spec['pages'][number];
                if (s.pages.some((p) => p.id === pg.id)) {
                  task.setError('Choose a unique page name.');
                  return;
                }
                setS({ ...s, pages: [...s.pages, pg] });
                setPid(pg.id);
                setSel(pg.components[0].id);
                setName('');
                setAdder(false);
              }}
            >
              <input
                required
                aria-label="New page title"
                placeholder="Page name"
                value={name}
                maxLength={50}
                onChange={(e) => setName(e.target.value)}
              />
              <IconButton type="submit" label="Create page">
                <Plus size={13} />
              </IconButton>
            </form>
          )}
          <select
            aria-label="Edit page"
            value={pid}
            onChange={(e) => {
              setPid(e.target.value);
              setSel(s.pages.find((p) => p.id === e.target.value)!.components[0]?.id || '');
            }}
          >
            {s.pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <div className="tree-list">
            {page.components.map((c, i) => (
              <div key={c.id} className={sel === c.id ? 'active' : ''}>
                <button onClick={() => setSel(c.id)}>
                  <Component size={12} />
                  {pretty(c.type)}
                </button>
                <IconButton
                  label={'Move ' + c.title + ' up'}
                  disabled={!i}
                  onClick={() => reorder(i, -1)}
                >
                  <ChevronUp size={11} />
                </IconButton>
                <IconButton
                  label={'Move ' + c.title + ' down'}
                  disabled={i === page.components.length - 1}
                  onClick={() => reorder(i, 1)}
                >
                  <ChevronDown size={11} />
                </IconButton>
              </div>
            ))}
          </div>
          <Field label="Component library">
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {componentTypes.map((t) => (
                <option key={t} value={t}>
                  {pretty(t)}
                </option>
              ))}
            </select>
          </Field>
          <Button
            onClick={() => {
              const c = {
                id: crypto.randomUUID(),
                type,
                title: pretty(type),
                text: '',
                color: '',
                spacing: 16,
              };
              blocks([...page.components, c]);
              setSel(c.id);
            }}
          >
            <Plus size={13} />
            Add component
          </Button>
        </aside>
        <div className="builder-canvas">
          <Preview project={p} design={s} page={pid} compact />
        </div>
        <aside className="panel builder-properties">
          <div className="small-panel-title">
            <span>
              <SlidersHorizontal size={14} />
              Properties
            </span>
          </div>
          {block ? (
            <div className="form-stack">
              <Field label="Component title">
                <input value={block.title} onChange={(e) => edit('title', e.target.value)} />
              </Field>
              <Field label="Supporting text">
                <textarea
                  rows={2}
                  value={block.text}
                  onChange={(e) => edit('text', e.target.value)}
                />
              </Field>
              <Field label={'Spacing · ' + block.spacing + ' px'}>
                <input
                  type="range"
                  min={0}
                  max={64}
                  value={block.spacing}
                  onChange={(e) => edit('spacing', Number(e.target.value))}
                />
              </Field>
              <Field label="Component color">
                <input
                  type="color"
                  value={block.color || s.accent}
                  onChange={(e) => edit('color', e.target.value)}
                />
              </Field>
              <button
                className="text-link"
                onClick={() => {
                  blocks(page.components.filter((c) => c.id !== sel));
                  setSel('');
                }}
              >
                <Trash2 size={12} />
                Remove component
              </button>
            </div>
          ) : (
            <p className="fineprint">Select a component to edit its properties.</p>
          )}
          <div className="small-panel-title divided">
            <span>
              <Palette size={14} />
              Design settings
            </span>
          </div>
          <div className="form-stack">
            <Field label="Accent color">
              <input
                type="color"
                value={s.accent}
                onChange={(e) => setS({ ...s, accent: e.target.value })}
              />
            </Field>
            {(['theme', 'layout', 'density'] as const).map((k) => (
              <Field key={k} label={pretty(k)}>
                <select value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })}>
                  {{
                    theme: ['light', 'dark'],
                    layout: ['sidebar', 'top'],
                    density: ['comfortable', 'compact'],
                  }[k].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
