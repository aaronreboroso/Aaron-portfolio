import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Cpu,
  Database,
  Layers3,
  PanelTop,
  Plus,
  TerminalSquare,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { catalog, pageFrom } from '../../shared/catalog.mjs';
import { Composer } from '../components/Composer';
import { Button, ErrorLine, Field, IconButton, PageTitle, SectionHead } from '../components/UI';
import { go, streamBuild, usePath, useTask } from '../lib/client';
import type { BuildStep, Spec } from '../lib/types';
import { useWorkspace } from '../lib/workspace';
export default function Create() {
  const w = useWorkspace(),
    path = usePath(),
    task = useTask(),
    [page, setPage] = useState(''),
    [details, setDetails] = useState(false),
    [buildSteps, setBuildSteps] = useState<BuildStep[]>([]),
    [fieldsPage, setFieldsPage] = useState('');
  const draft = w.draft,
    isPlan = !!draft && path.includes('stage=plan');
  const upd = (s: Partial<Spec>) => {
    if (draft) w.setDraft({ ...draft, spec: { ...draft.spec, ...s } });
  };
  const build = () =>
    task.run(async () => {
      setBuildSteps([]);
      const pid = await streamBuild(draft!.spec, (event) =>
        setBuildSteps((prev) => [...prev.filter((s) => s.stage !== event.stage), event]),
      );
      await w.refresh();
      w.notify('Source files created and validated. Your preview is ready.');
      w.setDraft(null);
      w.setPrompt('');
      go('/workspace/' + pid);
    });
  return (
    <div className="page-enter">
      <PageTitle
        kicker="CREATION ENGINE"
        title={isPlan ? 'Review your build plan' : 'Create an application'}
        subtitle={
          isPlan
            ? 'Shape the specification before ATROX writes your project files.'
            : 'Start with an objective. The engine turns it into an editable plan.'
        }
      />
      <div className="stage-rail">
        {['Understand', 'Plan', 'Generate', 'Preview'].map((s, i) => (
          <div
            key={s}
            className={
              i === (task.busy ? 2 : isPlan ? 1 : 0)
                ? 'current'
                : i < (isPlan ? 1 : 0)
                  ? 'complete'
                  : ''
            }
          >
            <b>{i === 0 && isPlan ? <Check size={13} /> : String(i + 1).padStart(2, '0')}</b>
            {s}
            {i < 3 && <ChevronRight size={13} />}
          </div>
        ))}
      </div>
      {!isPlan ? (
        <>
          <section className="panel create-input">
            <div className="eyebrow red">
              <TerminalSquare size={13} />
              PROJECT BRIEF
            </div>
            <h2>What should your software do?</h2>
            <p>
              Describe your users, the information they manage, and what a successful day looks
              like.
            </p>
            <Composer />
          </section>
          <SectionHead title="Start with a brief" />
          <div className="brief-grid">
            {catalog.slice(0, 6).map((t) => (
              <button
                key={t.kind}
                className="brief-card"
                onClick={() => {
                  w.setPrompt(t.prompt);
                  document.querySelector<HTMLTextAreaElement>('[data-prompt]')?.focus();
                }}
              >
                <span style={{ color: t.accent }}>
                  <Layers3 size={17} />
                </span>
                <h3>{t.category}</h3>
                <p>{t.prompt}</p>
                <ArrowUpRightMini />
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="inline-notice">
            <Cpu size={16} />
            <span>
              Planned with <strong>{draft.source}</strong>.{' '}
              {draft.source === 'Local engine'
                ? 'No external AI request was made. The local engine builds record-based web applications.'
                : 'Review the provider’s proposal before generating.'}
            </span>
          </div>
          {draft.notes.map((n) => (
            <p className="inline-notice" key={n}>
              {n}
            </p>
          ))}
          <div className="plan-grid">
            <section className="panel form-stack">
              <div className="eyebrow red">01 / PROJECT OVERVIEW</div>
              <Field label="Application name">
                <input
                  value={draft.spec.name}
                  maxLength={100}
                  onChange={(e) => upd({ name: e.target.value })}
                />
              </Field>
              <Field label="Objective">
                <textarea
                  rows={3}
                  value={draft.spec.summary}
                  onChange={(e) => upd({ summary: e.target.value })}
                />
              </Field>
              <Field label="Intended audience">
                <input
                  value={draft.spec.audience}
                  onChange={(e) => upd({ audience: e.target.value })}
                />
              </Field>
              <Field
                label="Feature breakdown"
                hint="One per line, saved in project memory. Collections and components below determine what is compiled."
              >
                <textarea
                  rows={3}
                  value={draft.spec.features.join('\n')}
                  onChange={(e) => upd({ features: e.target.value.split('\n') })}
                />
              </Field>
            </section>
            <section className="panel">
              <div className="eyebrow red">02 / APPLICATION STRUCTURE</div>
              <h3 className="subheading">Pages & collections</h3>
              {draft.spec.pages.map((p, i) => (
                <div key={p.id} className="plan-page">
                  <div>
                    <PanelTop size={15} />
                    <input
                      aria-label={'Page ' + (i + 1) + ' name'}
                      value={p.title}
                      onChange={(e) =>
                        upd({
                          pages: draft.spec.pages.map((v, j) =>
                            j === i
                              ? {
                                  ...v,
                                  title: e.target.value,
                                  components: v.components.map((c) =>
                                    c.type === 'header' ? { ...c, title: e.target.value } : c,
                                  ),
                                }
                              : v,
                          ),
                        })
                      }
                    />
                    <IconButton
                      label={'Remove ' + p.title}
                      disabled={draft.spec.pages.length < 2}
                      onClick={() => upd({ pages: draft.spec.pages.filter((_, j) => j !== i) })}
                    >
                      <X size={13} />
                    </IconButton>
                  </div>
                  <button
                    className="schema-toggle"
                    onClick={() => setFieldsPage(fieldsPage === p.id ? '' : p.id)}
                    aria-expanded={fieldsPage === p.id}
                  >
                    <Database size={11} />
                    {p.fields.map((f) => f.label).join(' · ')}
                    <ChevronRight size={11} />
                  </button>
                  {fieldsPage === p.id && (
                    <section className="schema-fields">
                      <span className="eyebrow">DATABASE FIELDS</span>
                      {p.fields.map((f, k) => (
                        <div className="schema-field" key={f.key}>
                          <input
                            aria-label={'Field ' + (k + 1) + ' label'}
                            value={f.label}
                            onChange={(e) =>
                              upd({
                                pages: draft.spec.pages.map((pg) =>
                                  pg.id === p.id
                                    ? {
                                        ...pg,
                                        fields: pg.fields.map((v, j) =>
                                          j === k ? { ...v, label: e.target.value } : v,
                                        ),
                                      }
                                    : pg,
                                ),
                              })
                            }
                          />
                          <select
                            aria-label={f.label + ' field type'}
                            value={f.type}
                            onChange={(e) =>
                              upd({
                                pages: draft.spec.pages.map((pg) =>
                                  pg.id === p.id
                                    ? {
                                        ...pg,
                                        fields: pg.fields.map((v, j) =>
                                          j === k
                                            ? {
                                                ...v,
                                                type: e.target.value as
                                                  'text' | 'number' | 'email' | 'date',
                                              }
                                            : v,
                                        ),
                                      }
                                    : pg,
                                ),
                              })
                            }
                          >
                            {['text', 'number', 'email', 'date'].map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                          <IconButton
                            label={'Remove field ' + f.label}
                            disabled={p.fields.length === 1}
                            onClick={() =>
                              upd({
                                pages: draft.spec.pages.map((pg) =>
                                  pg.id === p.id
                                    ? { ...pg, fields: pg.fields.filter((_, j) => k !== j) }
                                    : pg,
                                ),
                              })
                            }
                          >
                            <X size={12} />
                          </IconButton>
                        </div>
                      ))}
                      <Button
                        disabled={p.fields.length >= 20}
                        onClick={() =>
                          upd({
                            pages: draft.spec.pages.map((pg) =>
                              pg.id === p.id
                                ? {
                                    ...pg,
                                    fields: [
                                      ...pg.fields,
                                      {
                                        key: 'field-' + crypto.randomUUID().slice(0, 8),
                                        label: 'New field',
                                        type: 'text',
                                      },
                                    ],
                                  }
                                : pg,
                            ),
                          })
                        }
                      >
                        <Plus size={12} />
                        Add field
                      </Button>
                    </section>
                  )}
                </div>
              ))}
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (page.trim()) {
                    const p = pageFrom(page.trim()) as Spec['pages'][number];
                    if (draft.spec.pages.some((x) => x.id === p.id)) {
                      task.setError('Choose a unique page name.');
                      return;
                    }
                    upd({ pages: [...draft.spec.pages, p] });
                    setPage('');
                  }
                }}
              >
                <input
                  required
                  aria-label="New collection name"
                  value={page}
                  maxLength={60}
                  onChange={(e) => setPage(e.target.value)}
                  placeholder="New collection…"
                />
                <IconButton type="submit" label="Add collection">
                  <Plus size={16} />
                </IconButton>
              </form>
              <h3 className="subheading">Implementation</h3>
              <ul className="check-list">
                {draft.architecture.map((a) => (
                  <li key={a}>
                    <Check size={13} />
                    {a}
                  </li>
                ))}
              </ul>
              <button className="text-link" onClick={() => setDetails(!details)}>
                {details ? 'Hide' : 'Inspect'} API & access plan <ChevronRight size={13} />
              </button>
              {details && (
                <p className="fineprint">
                  Each collection receives GET, POST, PUT and DELETE record routes. The exported
                  server supports an owner password. No external integrations are enabled by
                  default. Complexity: bounded CRUD application.
                </p>
              )}
            </section>
          </div>
          {buildSteps.length > 0 && (
            <div className="build-progress" aria-live="polite">
              {buildSteps.map((b) => (
                <span key={b.stage}>
                  {b.state === 'complete' ? <Check size={13} /> : <Cpu size={13} />} {b.stage}
                </span>
              ))}
            </div>
          )}
          <ErrorLine text={task.error} />
          <div className="plan-actions">
            <Button onClick={() => go('/create')}>
              <ArrowLeft size={14} />
              Edit brief
            </Button>
            <Button variant="primary" busy={task.busy} onClick={build}>
              {task.busy ? 'Creating and validating files…' : 'Build application'}
              <ArrowRight size={15} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
function ArrowUpRightMini() {
  return <ArrowRight className="brief-arrow" size={15} />;
}
