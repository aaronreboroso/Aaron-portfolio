import {
  ArrowRight,
  ArrowUpRight,
  Database,
  Download,
  FileCode2,
  FolderClosed,
  Grid2X2,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { catalog } from '../../shared/catalog.mjs';
import { ProjectCard } from '../components/ProjectCard';
import {
  Button,
  Empty,
  ErrorLine,
  Field,
  IconButton,
  Link,
  Modal,
  PageTitle,
  SectionHead,
} from '../components/UI';
import { api, artFor, go, kindName, relative, usePath, useTask } from '../lib/client';
import type { ProjectSummary } from '../lib/types';
import { useWorkspace } from '../lib/workspace';
import { ActivityRow } from './Home';
export function Projects() {
  const w = useWorkspace(),
    [q, search] = useState(''),
    [sort, setSort] = useState('recent'),
    [view, setView] = useState('grid'),
    [del, setDel] = useState<ProjectSummary | null>(null),
    [name, setName] = useState(''),
    task = useTask();
  const projects = w.data.projects
    .filter((p) => (p.name + ' ' + p.description).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'old'
          ? a.updated - b.updated
          : b.updated - a.updated,
    );
  return (
    <div className="page-enter">
      <PageTitle
        kicker="PROJECT DIRECTORY"
        title="My Projects"
        subtitle="Your applications, source files, and development workspaces."
        action={
          <Button variant="primary" onClick={w.newProject}>
            <Plus size={14} />
            New project
          </Button>
        }
      />
      <div className="toolbar">
        <div className="input-with-icon">
          <Search size={15} />
          <input
            placeholder="Search projects…"
            aria-label="Search projects"
            value={q}
            onChange={(e) => search(e.target.value)}
          />
        </div>
        <div className="toolbar-end">
          <select aria-label="Sort projects" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Last edited</option>
            <option value="name">Name A–Z</option>
            <option value="old">Oldest first</option>
          </select>
          <div className="segmented">
            <IconButton
              label="Grid view"
              className={view === 'grid' ? 'on' : ''}
              onClick={() => setView('grid')}
            >
              <Grid2X2 size={14} />
            </IconButton>
            <IconButton
              label="List view"
              className={view === 'list' ? 'on' : ''}
              onClick={() => setView('list')}
            >
              <List size={15} />
            </IconButton>
          </div>
        </div>
      </div>
      <SectionHead title="All projects" count={projects.length} />
      {projects.length ? (
        view === 'grid' ? (
          <div className="project-grid">
            {projects.map((p, i) => (
              <div className="managed-card" key={p.id}>
                <ProjectCard project={p} index={i} />
                <IconButton
                  label={'Manage ' + p.name}
                  className="manage-card-action"
                  onClick={() => {
                    setDel(p);
                    setName('');
                  }}
                >
                  <SlidersHorizontal size={13} />
                </IconButton>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel directory-list">
            {projects.map((p) => (
              <div className="directory-row" key={p.id}>
                <img src={artFor(p.kind)} alt="" />
                <Link href={'/workspace/' + p.id}>
                  <strong>{p.name}</strong>
                  <small>{kindName(p.kind)}</small>
                </Link>
                <span>{p.files} files</span>
                <small>{relative(p.updated)}</small>
                <IconButton
                  label={'Manage ' + p.name}
                  onClick={() => {
                    setDel(p);
                    setName('');
                  }}
                >
                  <SlidersHorizontal size={14} />
                </IconButton>
              </div>
            ))}
          </div>
        )
      ) : (
        <Empty
          icon={FolderClosed}
          title={q ? 'No matching projects' : 'Create your first application'}
        >
          <p>
            {q
              ? 'Try another name or description.'
              : 'Start with a natural-language brief or a reusable template.'}
          </p>
          <Button onClick={q ? () => search('') : w.newProject}>
            {q ? 'Clear search' : 'Create project'}
          </Button>
        </Empty>
      )}
      {del && (
        <Modal title={del.name} kicker="PROJECT MANAGEMENT" close={() => setDel(null)}>
          <div className="form-stack">
            <p>{del.description}</p>
            <Link className="btn" href={'/workspace/' + del.id}>
              Open workspace <ArrowUpRight size={14} />
            </Link>
            <a className="btn" download href={'/api/projects/' + del.id + '/export'}>
              <Download size={14} />
              Download source ZIP
            </a>
            <div className="divided">
              <h3>Delete project</h3>
              <p className="fineprint">
                This permanently removes this project, its files, versions, records, and workflows.
                Export a copy first.
              </p>
            </div>
            <Field label={'Type “' + del.name + '” to confirm deletion'}>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <ErrorLine text={task.error} />
            <Button
              variant="danger"
              disabled={name !== del.name}
              busy={task.busy}
              onClick={() =>
                task.run(async () => {
                  await api('/projects/' + del.id, 'DELETE');
                  await w.refresh();
                  setDel(null);
                  w.notify('Project deleted from your workspace.');
                })
              }
            >
              <Trash2 size={14} />
              Delete project
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function Templates() {
  const w = useWorkspace(),
    path = usePath(),
    selected = new URLSearchParams(path.split('?')[1]).get('kind'),
    [q, search] = useState(''),
    [category, setCat] = useState('All templates');
  const t = catalog.find((x) => x.kind === selected),
    list = catalog.filter(
      (v) =>
        (category === 'All templates' || v.category === category) &&
        (v.name + ' ' + v.description + ' ' + v.category).toLowerCase().includes(q.toLowerCase()),
    );
  return (
    <div className="page-enter">
      <PageTitle
        kicker="STARTER LIBRARY"
        title="Templates"
        subtitle="Proven starting points. Each template compiles into a working application you own."
      />
      <div className="toolbar">
        <div className="input-with-icon">
          <Search size={15} />
          <input
            value={q}
            onChange={(e) => search(e.target.value)}
            placeholder="Search the library…"
            aria-label="Search templates"
          />
        </div>
        <select
          aria-label="Template category"
          value={category}
          onChange={(e) => setCat(e.target.value)}
        >
          {['All templates', ...catalog.map((t) => t.category)].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="library-grid">
        {list.map((t, i) => (
          <div key={t.kind} className={'project-card art-' + t.kind}>
            <div className="project-art">
              <img src={artFor(t.kind)} alt="" />
              <span className="figure-label">TPL / 00{i + 1}</span>
            </div>
            <div className="project-info">
              <span className="eyebrow" style={{ fontSize: 8, color: t.accent, marginBottom: 5 }}>
                {t.category.toUpperCase()}
              </span>
              <h3>{t.name}</h3>
              <p>{t.description}</p>
              <Button onClick={() => go('/templates?kind=' + t.kind)}>
                Inspect template <ArrowRight size={13} />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {!list.length && (
        <Empty title="No matching templates">
          <Button
            onClick={() => {
              search('');
              setCat('All templates');
            }}
          >
            Reset filters
          </Button>
        </Empty>
      )}
      {t && (
        <Modal
          title={t.name}
          kicker={'TEMPLATE / ' + t.category.toUpperCase()}
          close={() => go('/templates')}
        >
          <div className="form-stack">
            <img className="template-cover" src={artFor(t.kind)} alt="" />
            <p>{t.description}</p>
            <h3>Included collections</h3>
            {t.pages.map(([name, ...fields]) => (
              <div key={name} className="template-detail">
                <Database size={16} />
                <div>
                  <strong>{name}</strong>
                  <small>{fields.join(' · ')}</small>
                </div>
              </div>
            ))}
            <div className="inline-notice">
              <FileCode2 size={16} />
              Includes an editable frontend, a SQLite-backed API, and source tests.
            </div>
            <ErrorLine text={w.analysisError} />
            <Button
              variant="primary"
              busy={w.analyzing}
              onClick={() => w.analyze(t.prompt, t.kind)}
            >
              Use template <ArrowRight size={14} />
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function Activity() {
  const w = useWorkspace(),
    [q, search] = useState(''),
    [filter, choose] = useState('All projects');
  const list = w.data.activity.filter(
    (a) =>
      (a.action + ' ' + a.detail).toLowerCase().includes(q.toLowerCase()) &&
      (filter === 'All projects' || a.project_id === filter),
  );
  return (
    <div className="page-enter">
      <PageTitle
        kicker="WORKSPACE TELEMETRY"
        title="Activity"
        subtitle="An audit trail of actual changes, executions and account events."
      />
      <div className="toolbar">
        <div className="input-with-icon">
          <Search size={15} />
          <input
            value={q}
            onChange={(e) => search(e.target.value)}
            placeholder="Filter activity…"
            aria-label="Filter activity"
          />
        </div>
        <select
          aria-label="Activity project"
          value={filter}
          onChange={(e) => choose(e.target.value)}
        >
          <option>All projects</option>
          {w.data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <section className="panel activity-log">
        <SectionHead title="Latest events" count={list.length} />
        {list.map((a) => (
          <ActivityRow key={a.id} item={a} />
        ))}
        {!list.length && (
          <Empty title="No matching events">
            <p>Actions in your workspace appear here when they occur.</p>
          </Empty>
        )}
      </section>
    </div>
  );
}
