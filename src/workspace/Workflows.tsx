import { ArrowDown, Play, Plus, Save, Trash2, Workflow, Zap } from 'lucide-react';
import { useState } from 'react';
import { Button, Empty, ErrorLine, Field, IconButton, Status } from '../components/UI';
import { api, stamp, useTask } from '../lib/client';
import type { Execution, Flow, Project } from '../lib/types';
import { useWorkspace } from '../lib/workspace';
const blank = (): Flow => ({
  id: '',
  name: 'New workflow',
  trigger: 'manual',
  enabled: false,
  steps: [{ type: 'log', key: 'result', value: 'Received a request from {{name}}.' }],
  executions: [],
});
const hints: Record<string, string> = {
  log: 'Write an execution log message. Use {{name}} for a variable.',
  variable: 'Set a named variable to a text value.',
  condition: 'Continue only if the variable matches this value.',
  record: 'Use a collection ID and a JSON object with its field keys.',
  ai: 'Send a prompt to a configured AI provider; store its response in a variable.',
  request: 'POST this message to your allowlisted webhook integration.',
};
export function Workflows({ p, reload }: { p: Project; reload: () => Promise<void> }) {
  const [sel, setSel] = useState<Flow | null>(
      p.workflows[0] ? structuredClone(p.workflows[0]) : null,
    ),
    [input, setInput] = useState('{"name":"Workspace owner"}'),
    [result, setResult] = useState<Execution | null>(null),
    task = useTask(),
    w = useWorkspace();
  const base = '/projects/' + p.id + '/workflows',
    choose = (f: Flow) => {
      setSel(structuredClone(f));
      setResult(null);
      task.setError('');
    };
  const save = async () => {
    if (!sel) return;
    const r = await api<{ id: string }>(
      base + (sel.id ? '/' + sel.id : ''),
      sel.id ? 'PUT' : 'POST',
      sel,
    );
    const wid = sel.id || r.id;
    await reload();
    setSel({ ...sel, id: wid });
    w.notify('Workflow definition saved.');
    return wid;
  };
  const definition = (f?: Flow | null) =>
    f
      ? JSON.stringify([f.name, f.trigger, f.enabled, f.steps.map((s) => [s.type, s.key, s.value])])
      : '';
  const dirty = definition(sel) !== definition(p.workflows.find((f) => f.id === sel?.id));
  return (
    <div className="flow-layout">
      <aside className="panel flow-list">
        <div className="small-panel-title">
          <span>
            <Workflow size={15} />
            Workflows
          </span>
          <IconButton label="New workflow" onClick={() => choose(blank())}>
            <Plus size={15} />
          </IconButton>
        </div>
        {p.workflows.map((f) => (
          <button
            key={f.id}
            className={'flow-choice ' + (sel?.id === f.id ? 'active' : '')}
            onClick={() => choose(f)}
          >
            {f.name}
            <small>{f.enabled ? 'Enabled' : 'Disabled'}</small>
          </button>
        ))}
        {!p.workflows.length && <p className="fineprint">No saved workflows.</p>}
      </aside>
      <div>
        {!sel ? (
          <Empty icon={Workflow} title="Automate a repeatable task">
            <p>Connect a trigger to real actions. Every manual test produces an execution log.</p>
            <Button onClick={() => choose(blank())}>
              <Plus size={14} />
              Create workflow
            </Button>
          </Empty>
        ) : (
          <div className="panel form-stack">
            <div className="row-between">
              <h2>Workflow editor</h2>
              <Status tone={dirty ? 'amber' : sel.enabled ? 'green' : 'neutral'}>
                {dirty ? 'Unsaved changes' : sel.enabled ? 'Trigger enabled' : 'Trigger disabled'}
              </Status>
            </div>
            <div className="two-col">
              <Field label="Workflow name">
                <input
                  value={sel.name}
                  onChange={(e) => setSel({ ...sel, name: e.target.value })}
                />
              </Field>
              <Field label="Trigger">
                <select
                  value={sel.trigger}
                  onChange={(e) => setSel({ ...sel, trigger: e.target.value })}
                >
                  <option value="manual">Manual execution</option>
                  <option value="record.created">New record created</option>
                </select>
              </Field>
            </div>
            <label className="check-option">
              <input
                type="checkbox"
                checked={sel.enabled}
                onChange={(e) => setSel({ ...sel, enabled: e.target.checked })}
              />
              Enable automatic trigger
            </label>
            <div className="flow-diagram">
              <div className="flow-trigger">
                <Zap size={15} />{' '}
                {sel.trigger === 'manual' ? 'Manual trigger' : 'New record created'}
              </div>
              {sel.steps.map((s, i) => (
                <div key={i}>
                  <ArrowDown className="flow-arrow" size={16} />
                  <div className="flow-node">
                    <div className="row-between">
                      <span className="eyebrow">ACTION {String(i + 1).padStart(2, '0')}</span>
                      <IconButton
                        label={'Remove step ' + (i + 1)}
                        disabled={sel.steps.length < 2}
                        onClick={() =>
                          setSel({ ...sel, steps: sel.steps.filter((_, j) => j !== i) })
                        }
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    </div>
                    <select
                      aria-label={'Step ' + (i + 1) + ' type'}
                      value={s.type}
                      onChange={(e) =>
                        setSel({
                          ...sel,
                          steps: sel.steps.map((a, j) =>
                            i === j
                              ? {
                                  ...a,
                                  type: e.target.value,
                                  key: e.target.value === 'record' ? p.spec.pages[0].id : 'result',
                                  value:
                                    e.target.value === 'record'
                                      ? JSON.stringify({
                                          [p.spec.pages[0].fields[0].key]: '{{name}}',
                                        })
                                      : a.value,
                                }
                              : a,
                          ),
                        })
                      }
                    >
                      {Object.keys(hints).map((t) => (
                        <option value={t} key={t}>
                          {
                            {
                              log: 'Log message',
                              variable: 'Set variable',
                              condition: 'Condition',
                              record: 'Create record',
                              ai: 'AI response',
                              request: 'API request',
                            }[t]
                          }
                        </option>
                      ))}
                    </select>
                    <small>{hints[s.type]}</small>
                    {['variable', 'condition', 'record', 'ai'].includes(s.type) && (
                      <Field label={s.type === 'record' ? 'Collection ID' : 'Variable name'}>
                        <input
                          value={s.key}
                          onChange={(e) =>
                            setSel({
                              ...sel,
                              steps: sel.steps.map((a, j) =>
                                i === j ? { ...a, key: e.target.value } : a,
                              ),
                            })
                          }
                        />
                      </Field>
                    )}
                    <textarea
                      aria-label={'Step ' + (i + 1) + ' value'}
                      rows={2}
                      value={s.value}
                      onChange={(e) =>
                        setSel({
                          ...sel,
                          steps: sel.steps.map((a, j) =>
                            i === j ? { ...a, value: e.target.value } : a,
                          ),
                        })
                      }
                    />
                  </div>
                </div>
              ))}
              <Button
                onClick={() =>
                  setSel({
                    ...sel,
                    steps: [...sel.steps, { type: 'log', value: 'Step complete.', key: 'result' }],
                  })
                }
              >
                <Plus size={13} />
                Add action
              </Button>
            </div>
            <Button variant="primary" busy={task.busy} onClick={() => task.run(save)}>
              <Save size={14} />
              Save workflow
            </Button>
            <div className="divided">
              <h3>Manual test</h3>
              <p className="fineprint">
                Tests execute the saved actions, even when automatic triggers are disabled.
              </p>
            </div>
            <Field label="Input variables (JSON)">
              <textarea value={input} rows={2} onChange={(e) => setInput(e.target.value)} />
            </Field>
            <Button
              busy={task.busy}
              disabled={!sel.id || !!dirty}
              onClick={() =>
                task.run(async () => {
                  let v;
                  try {
                    v = JSON.parse(input);
                  } catch {
                    throw Error('Enter valid JSON for the test input.');
                  }
                  const r = await api<Execution>(base + '/' + sel.id + '/run', 'POST', {
                    input: v,
                  });
                  setResult(r);
                  await reload();
                })
              }
            >
              <Play size={13} />
              Run saved workflow
            </Button>
            <ErrorLine text={task.error} />
            {result && (
              <div className="run-result">
                <Status tone={result.status === 'success' ? 'green' : 'amber'}>
                  {result.status}
                </Status>
                <pre className="output">
                  {result.log.map((l) => l.type + ' → ' + l.message).join('\n')}
                </pre>
              </div>
            )}
            <h3>Execution history</h3>
            {(p.workflows.find((f) => f.id === sel.id)?.executions || []).map((r) => (
              <details key={r.id} className="history-detail">
                <summary>
                  {stamp(r.created)} · {r.status}
                </summary>
                <pre className="output">{r.log.map((l) => l.message).join('\n')}</pre>
              </details>
            ))}
            {!p.workflows.find((f) => f.id === sel.id)?.executions.length && (
              <p className="fineprint">No executions have been recorded.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
