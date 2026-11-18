import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CloudUpload,
  Code2,
  Database,
  Download,
  GitBranch,
  History,
  LockKeyhole,
  Monitor,
  PanelTop,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  TerminalSquare,
  Workflow,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ProjectCard } from '../components/ProjectCard';
import {
  Button,
  Empty,
  ErrorLine,
  Field,
  Link,
  Loading,
  Modal,
  PageTitle,
  SectionHead,
  Status,
} from '../components/UI';
import { api, go, stamp, usePath, useTask } from '../lib/client';
import type { Project } from '../lib/types';
import { useWorkspace } from '../lib/workspace';
import { Builder } from '../workspace/Builder';
import { Preview } from '../workspace/Preview';
import { Workflows } from '../workspace/Workflows';
const Code = lazy(() => import('../workspace/Code'));
function MemoryPanel({ p, reload }: { p: Project; reload: () => Promise<void> }) {
  const [m, setM] = useState(p.memory),
    task = useTask(),
    w = useWorkspace();
  return (
    <div className="two-col">
      <section className="panel form-stack">
        <div className="eyebrow red">PERSISTENT CONTEXT</div>
        <h2>Project memory</h2>
        <p className="fineprint">
          Provider-assisted refinements receive these instructions alongside the existing
          application specification.
        </p>
        <Field label="Project instructions">
          <textarea
            rows={4}
            placeholder="Design preferences, constraints, and conventions…"
            value={m.instructions}
            onChange={(e) => setM({ ...m, instructions: e.target.value })}
          />
        </Field>
        <Field label="Persistent requirements" hint="One requirement per line.">
          <textarea
            rows={4}
            value={m.requirements.join('\n')}
            onChange={(e) => setM({ ...m, requirements: e.target.value.split('\n') })}
          />
        </Field>
        <Field label="Architecture decisions">
          <textarea
            rows={4}
            value={m.decisions.join('\n')}
            onChange={(e) => setM({ ...m, decisions: e.target.value.split('\n') })}
          />
        </Field>
        <ErrorLine text={task.error} />
        <Button
          variant="primary"
          busy={task.busy}
          onClick={() =>
            task.run(async () => {
              await api('/projects/' + p.id + '/memory', 'PUT', {
                ...m,
                requirements: m.requirements.filter(Boolean),
              });
              await reload();
              w.notify('Project memory saved.');
            })
          }
        >
          <Save size={14} />
          Save context
        </Button>
      </section>
      <section className="panel form-stack">
        <div className="eyebrow">PROJECT FACTS</div>
        <h3>{p.spec.name}</h3>
        <p>{p.spec.summary}</p>
        <div className="subtle-row">
          <span>Status</span>
          <Status>Preview ready</Status>
        </div>
        <div className="subtle-row">
          <span>Audience</span>
          <b>{p.spec.audience}</b>
        </div>
        <div className="subtle-row">
          <span>Roles</span>
          <b>{p.spec.roles.join(', ')}</b>
        </div>
        <h3>Collections</h3>
        <div className="tag-group">
          {p.spec.pages.map((f) => (
            <span key={f.id} className="mini-tag">
              {f.title}
            </span>
          ))}
        </div>
        <h3>Recent modifications</h3>
        {p.versions.slice(0, 4).map((v) => (
          <div key={v.id} className="memory-change">
            <GitBranch size={13} />
            <span>{v.label}</span>
            <small>v{v.number}</small>
          </div>
        ))}
      </section>
    </div>
  );
}
function Versions({ p, reload }: { p: Project; reload: () => Promise<void> }) {
  const [label, setLabel] = useState(''),
    [target, setTarget] = useState(''),
    task = useTask(),
    w = useWorkspace();
  return (
    <div className="panel">
      <SectionHead title="Version history" count={p.versions.length} />
      <p className="fineprint">
        Immutable source snapshots. The latest 30 are retained; restoring creates a new version and
        keeps collection records.
      </p>
      <form
        className="inline-form checkpoint"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await api('/projects/' + p.id + '/versions', 'POST', { label });
            setLabel('');
            await reload();
            w.notify('Version checkpoint saved.');
          });
        }}
      >
        <input
          required
          maxLength={100}
          placeholder="Name this checkpoint…"
          aria-label="Checkpoint name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button busy={task.busy}>
          <Plus size={13} />
          Save version
        </Button>
      </form>
      <ErrorLine text={task.error} />
      {p.versions.map((v, i) => (
        <div className="version-row" key={v.id}>
          <span className="version-badge">v{v.number}</span>
          <div>
            <strong>{v.label}</strong>
            <small>{stamp(v.created)}</small>
          </div>
          {i === 0 ? (
            <Status>Current</Status>
          ) : (
            <Button onClick={() => setTarget(v.id)}>
              <RotateCcw size={12} />
              Restore
            </Button>
          )}
        </div>
      ))}
      {target && (
        <Modal title="Restore this version?" close={() => setTarget('')}>
          <p>
            The selected source snapshot will replace the current files. Existing record data and
            the current version history are preserved.
          </p>
          <div className="modal-actions">
            <Button onClick={() => setTarget('')}>Cancel</Button>
            <Button
              variant="primary"
              busy={task.busy}
              onClick={() =>
                task.run(async () => {
                  await api('/projects/' + p.id + '/versions/' + target + '/restore', 'POST');
                  await reload();
                  setTarget('');
                  w.notify('Source version restored.');
                })
              }
            >
              Restore version
            </Button>
          </div>
          <ErrorLine text={task.error} />
        </Modal>
      )}
    </div>
  );
}
function Refine({ p, reload }: { p: Project; reload: () => Promise<void> }) {
  const w = useWorkspace(),
    [text, setText] = useState(''),
    [route, setRoute] = useState(''),
    [result, setResult] = useState(''),
    task = useTask();
  return (
    <aside className="refine-panel panel">
      <div className="eyebrow red">
        <Sparkles size={13} />
        REFINEMENT ENGINE
      </div>
      <h3>Refine your app</h3>
      <p>Describe a change. ATROX updates the project source and saves a version.</p>
      <Field label="Change request">
        <textarea
          rows={4}
          placeholder="Add a reporting page…"
          value={text}
          maxLength={5000}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <select
        aria-label="Refinement engine"
        value={route}
        onChange={(e) => setRoute(e.target.value)}
      >
        <option value="">Automatic routing</option>
        <option value="local">Local engine</option>
        {w.data.providers
          .filter((g) => g.configured)
          .map((g) => (
            <option value={g.slug} key={g.slug}>
              {g.name}
            </option>
          ))}
      </select>
      <Button
        variant="primary"
        busy={task.busy}
        disabled={text.trim().length < 6}
        onClick={() =>
          task.run(async () => {
            const r = await api<{ source: string; notes: string[] }>(
              '/projects/' + p.id + '/refine',
              'POST',
              { prompt: text, mode: w.mode, provider: route || undefined },
            );
            await reload();
            setResult('Applied with ' + r.source + '. ' + r.notes.join(' '));
            setText('');
            w.notify('Refinement saved to source.');
          })
        }
      >
        Apply change <ArrowRight size={14} />
      </Button>
      <ErrorLine text={task.error} />
      {result && (
        <div className="fineprint saved">
          <Check size={14} />
          {result}
        </div>
      )}
      <div className="refine-ideas">
        <div className="eyebrow">QUICK CHANGES</div>
        {['Add dark mode', 'Add a reporting page', 'Make the dashboard more minimal'].map((q) => (
          <button onClick={() => setText(q)} key={q}>
            {q}
            <ArrowUpRight size={12} />
          </button>
        ))}
      </div>
    </aside>
  );
}
const workspaceTabs = [
  { name: 'Preview', icon: Monitor },
  { name: 'Code', icon: Code2 },
  { name: 'Visual builder', icon: PanelTop },
  { name: 'Memory', icon: Database },
  { name: 'Versions', icon: History },
  { name: 'Workflows', icon: Workflow },
];
export default function Workspace() {
  const w = useWorkspace(),
    path = usePath(),
    pid = path.split('?')[0].split('/')[2],
    tab = new URLSearchParams(path.split('?')[1]).get('tab') || 'Preview',
    [p, setP] = useState<Project | null>(null),
    [error, setError] = useState(''),
    [deploy, setDeploy] = useState(false),
    [confirm, setConfirm] = useState(''),
    [receipt, setReceipt] = useState(''),
    [report, setReport] = useState(false),
    task = useTask();
  const load = useCallback(async () => {
    if (pid) setP(await api<Project>('/projects/' + pid));
  }, [pid]);
  const reload = useCallback(async () => {
    await Promise.all([load(), w.refresh()]);
  }, [load, w.refresh]);
  useEffect(() => {
    let alive = true;
    setError('');
    setP(null);
    if (pid)
      api<Project>('/projects/' + pid)
        .then((r) => {
          if (alive) setP(r);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [pid]);
  if (!pid)
    return (
      <div className="page-enter">
        <PageTitle
          kicker="DEVELOPMENT ENVIRONMENT"
          title="AI Workspace"
          subtitle="Open a project to preview, edit, refine, and version its source."
        />
        <div className="workspace-intro">
          <span className="intro-icon">
            <TerminalSquare size={29} />
          </span>
          <div>
            <h2>Your development environment</h2>
            <p>
              A live preview, source editor and visual builder. One isolated workspace per project.
            </p>
          </div>
        </div>
        <SectionHead title="Open a project" />
        <div className="project-grid">
          {w.data.projects.map((p, i) => (
            <ProjectCard key={p.id} index={i} project={p} />
          ))}
        </div>
        {!w.data.projects.length && (
          <Empty title="No projects yet">
            <Button onClick={w.newProject}>Create a project</Button>
          </Empty>
        )}
      </div>
    );
  if (error)
    return (
      <div>
        <ErrorLine text={error} />
        <Link href="/projects" className="btn">
          Back to projects
        </Link>
      </div>
    );
  if (!p) return <Loading text="Reading project files…" />;
  const connected = w.data.integrations.some((s) => s.slug === 'netlify');
  return (
    <div className="studio page-enter">
      <Link className="back-link" href="/projects">
        <ArrowLeft size={13} />
        Project directory
      </Link>
      <div className="studio-heading">
        <div>
          <div className="eyebrow">
            PROJECT WORKSPACE <span>/</span> V{p.versions[0]?.number || 1}
          </div>
          <h1>{p.spec.name}</h1>
          <p>{p.spec.summary}</p>
        </div>
        <div className="studio-actions">
          <a className="btn" href={'/api/projects/' + p.id + '/export'} download>
            <Download size={14} />
            Export ZIP
          </a>
          <Button onClick={() => setDeploy(true)}>
            <CloudUpload size={14} />
            Deploy
          </Button>
        </div>
      </div>
      <nav aria-label="Project tools" className="studio-tabs">
        {workspaceTabs.map((t) => (
          <button
            className={tab === t.name ? 'active' : ''}
            key={t.name}
            onClick={() => go('/workspace/' + p.id + '?tab=' + encodeURIComponent(t.name))}
          >
            <t.icon size={14} />
            {t.name}
          </button>
        ))}
      </nav>
      {tab === 'Preview' ? (
        <div className="studio-grid">
          <div>
            <Preview project={p} onRecordChange={reload} />
            <div className="environment-note">
              <LockKeyhole size={12} />
              Private preview · Not deployed{' '}
              {p.build?.length > 0 && (
                <button className="build-report-button" onClick={() => setReport(true)}>
                  Build report <ArrowUpRight size={10} />
                </button>
              )}
              <span>{Object.keys(p.files).length} source files</span>
            </div>
          </div>
          <Refine p={p} reload={reload} />
        </div>
      ) : tab === 'Code' ? (
        <Suspense fallback={<Loading text="Loading code editor…" />}>
          <Code p={p} reload={reload} />
        </Suspense>
      ) : tab === 'Visual builder' ? (
        <Builder key={p.id} p={p} reload={reload} />
      ) : tab === 'Memory' ? (
        <MemoryPanel p={p} reload={reload} />
      ) : tab === 'Versions' ? (
        <Versions p={p} reload={reload} />
      ) : tab === 'Workflows' ? (
        <Workflows p={p} reload={reload} />
      ) : (
        <Empty title="Unknown workspace tool">
          <Link className="text-link" href={'/workspace/' + p.id}>
            Open preview
          </Link>
        </Empty>
      )}
      {report && (
        <Modal title="Build report" kicker="INITIAL GENERATION" close={() => setReport(false)}>
          <p className="fineprint">
            Compiler milestones recorded when this project was created. These checks are not a
            deployment or an execution of the exported test suite.
          </p>
          {p.build.map((s) => (
            <div className="build-report-row" key={s.stage}>
              <Check size={15} />
              <div>
                <strong>{s.stage}</strong>
                <p>{s.detail}</p>
              </div>
              <small>{s.durationMs} ms</small>
            </div>
          ))}
        </Modal>
      )}
      {deploy && (
        <Modal title="Publish to Netlify" kicker="DEPLOYMENT" close={() => setDeploy(false)}>
          <div className="form-stack">
            <p>
              Publish the current frontend files to your configured site. This replaces the site’s
              published content. The static edition stores records in each visitor’s browser; your
              private preview records and server secrets are never uploaded.
            </p>
            {connected ? (
              <>
                <Field label={'Type “' + p.spec.name + '” to confirm'}>
                  <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </Field>
                <Button
                  variant="primary"
                  disabled={confirm !== p.spec.name}
                  busy={task.busy}
                  onClick={() =>
                    task.run(async () => {
                      const r = await api<{ id: string; state: string }>(
                        '/projects/' + p.id + '/deploy',
                        'POST',
                        { confirm },
                      );
                      setReceipt(
                        'Netlify accepted deploy ' + r.id + '. Reported state: ' + r.state,
                      );
                      await w.refresh();
                    })
                  }
                >
                  Publish static application
                </Button>
              </>
            ) : (
              <>
                <div className="inline-notice">
                  <CloudUpload size={15} />
                  Netlify is not configured. Nothing has been deployed.
                </div>
                <Link className="btn" href="/integrations">
                  Configure integration <ArrowRight size={14} />
                </Link>
              </>
            )}
            <ErrorLine text={task.error} />
            {receipt && <div className="inline-notice">{receipt}</div>}
            <p className="fineprint">
              For a database-backed installation, export the ZIP and run the included Node.js server
              on your own infrastructure.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
