import {
  ArrowRight,
  ArrowUpRight,
  Blocks,
  Cpu,
  Files,
  FolderClosed,
  GitBranch,
  Layers3,
  Radio,
  type LucideIcon,
} from 'lucide-react';
import { catalog } from '../../shared/catalog.mjs';
import { Composer } from '../components/Composer';
import { ProjectCard } from '../components/ProjectCard';
import { Empty, Link, SectionHead, Status, ViewLink } from '../components/UI';
import { number, relative } from '../lib/client';
import type { Activity } from '../lib/types';
import { useWorkspace } from '../lib/workspace';
function Spark({
  values,
  color,
  bars = false,
}: {
  values: number[];
  color: string;
  bars?: boolean;
}) {
  const max = Math.max(1, ...values),
    pts = values.map((n, i) => [(i * 62) / (values.length - 1), 25 - (21 * n) / max]);
  return (
    <svg viewBox="0 0 66 30" className="spark" aria-label="Activity over the last seven days">
      {bars ? (
        values.map((n, i) => (
          <rect
            key={i}
            x={i * 9}
            y={26 - Math.max(3, (n / max) * 21)}
            width="5"
            height={Math.max(3, (n / max) * 21)}
            rx="1"
            fill={color}
            opacity={n ? 0.72 : 0.2}
          />
        ))
      ) : (
        <>
          <path
            d={'M' + pts.map((v) => v.join(',')).join(' L') + ' L62,29 L0,29Z'}
            fill={color}
            opacity=".055"
          />
          <polyline
            points={pts.map((v) => v.join(',')).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="2.2" fill={color} />
        </>
      )}
    </svg>
  );
}
function Metric({
  title,
  value,
  Icon,
  color,
  values,
  bars,
  to,
}: {
  title: string;
  value: number;
  Icon: LucideIcon;
  color: string;
  values: number[];
  bars?: boolean;
  to: string;
}) {
  return (
    <Link href={to} className="metric">
      <div className="metric-heading">
        <span className="metric-icon" style={{ color, background: color + '12' }}>
          <Icon size={15} />
        </span>
        {title}
      </div>
      <div className="metric-bottom">
        <b>{number(value)}</b>
        <Spark values={values} color={color} bars={bars} />
      </div>
    </Link>
  );
}
export function ActivityRow({ item: a }: { item: Activity }) {
  return (
    <div className="activity-row">
      <span className="activity-icon">
        {a.action.includes('Workflow') ? (
          <GitBranch size={16} />
        ) : a.action.includes('Provider') ? (
          <Cpu size={16} />
        ) : a.action.includes('saved') ? (
          <Files size={16} />
        ) : (
          <Layers3 size={16} />
        )}
      </span>
      <div>
        <strong>{a.action}</strong>
        <p>
          {a.project_id ? <Link href={'/workspace/' + a.project_id}>{a.detail}</Link> : a.detail}
        </p>
      </div>
      <time>{relative(a.created)}</time>
    </div>
  );
}
export default function Home() {
  const w = useWorkspace(),
    d = w.data,
    p = d.projects,
    files = p.reduce((n, x) => n + x.files, 0),
    versions = p.reduce((n, x) => n + x.versions, 0);
  const series = <T extends { created: number }>(as: T[], count: (a: T) => number = () => 1) =>
    Array.from({ length: 7 }, (_, i) =>
      as
        .filter((a) => Math.floor((Date.now() - a.created) / 86400000) === 6 - i)
        .reduce((n, a) => n + count(a), 0),
    );
  return (
    <div className="home page-enter">
      <section className="creation-hero">
        <div className="hero-top">
          <div className="hero-mesh" />
          <div className="core-art">
            <img
              src="/art/creation-core.jpg"
              alt="An exploded black and ruby-red ATROX creation core"
            />
            <div className="core-figure">
              <i />
              FIG. 01 <b>/</b> CREATION CORE
            </div>
          </div>
          <div className="hero-copy">
            <div className="hero-kicker">
              <span className="engine-light" />
              CREATION ENGINE<span className="hero-version">V1.0</span>
              {!d.user.guest && (
                <span className="welcome-name">
                  / WELCOME, {d.user.name.split(' ')[0].toUpperCase()}
                </span>
              )}
            </div>
            <h1>
              What will you
              <br />
              create today<span className="red-question">?</span>
            </h1>
            <p>Turn your ideas into functional software with ATROX.</p>
          </div>
        </div>
        <Composer hero />
      </section>
      <div className="overview-metrics">
        <Metric
          title="Total projects"
          value={p.length}
          Icon={FolderClosed}
          color="#B799F2"
          values={series(p)}
          to="/projects"
        />
        <Metric
          title="Project files"
          value={files}
          Icon={Files}
          color="#77B4E5"
          values={series(p, (a) => a.files)}
          bars
          to="/workspace"
        />
        <Metric
          title="Saved versions"
          value={versions}
          Icon={GitBranch}
          color="#E8AD74"
          values={series(
            d.activity.filter((a) =>
              /saved|generated|added|Refined|restored|design/i.test(a.action),
            ),
          )}
          to="/activity"
        />
        <Metric
          title="AI requests"
          value={d.monthly.requests}
          Icon={Cpu}
          color="#78C9A3"
          values={series(d.usage)}
          bars
          to="/settings?tab=usage"
        />
      </div>
      <section className="home-section">
        <SectionHead title="Recent projects" count={p.length}>
          <ViewLink to="/projects">View all projects</ViewLink>
        </SectionHead>
        {p.length ? (
          <div className="project-grid">
            {p.slice(0, 3).map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} />
            ))}
          </div>
        ) : (
          <Empty title="Your project directory is ready">
            <button className="text-link" onClick={w.newProject}>
              Create your first project <ArrowRight size={14} />
            </button>
          </Empty>
        )}
      </section>
      <div className="home-lower">
        <section className="panel">
          <SectionHead title="Recent activity">
            <ViewLink to="/activity">View all</ViewLink>
          </SectionHead>
          {d.activity.slice(0, 3).map((a) => (
            <ActivityRow key={a.id} item={a} />
          ))}
        </section>
        <section className="panel engine-panel">
          <SectionHead title="Engine status">
            <Radio size={17} />
          </SectionHead>
          <div className="engine-status">
            <span className="engine-box">
              <Cpu size={20} />
            </span>
            <div>
              <strong>Local creation engine</strong>
              <small>Schema-driven app generation</small>
            </div>
            <Status>Online</Status>
          </div>
          <div className="subtle-row">
            <span>Configured AI providers</span>
            <b>{number(d.providers.filter((p) => p.configured).length)}</b>
          </div>
          <div className="model-chips" aria-label="Provider availability">
            {d.providers.map((v) => (
              <span
                className={v.configured ? 'configured' : ''}
                key={v.slug}
                title={
                  v.name +
                  ': ' +
                  (v.verified
                    ? 'Verified · ' + v.model
                    : v.configured
                      ? 'Configured · ' + v.model
                      : 'Not configured')
                }
              >
                <i />
                {v.name}
              </span>
            ))}
          </div>
          <Link href="/integrations" className="text-link">
            Manage connections <ArrowRight size={13} />
          </Link>
        </section>
      </div>
      <section className="home-section">
        <SectionHead title="Template picks">
          <ViewLink to="/templates">Explore library</ViewLink>
        </SectionHead>
        <div className="template-picks">
          {catalog.slice(3).map((t) => (
            <Link key={t.kind} href={'/templates?kind=' + t.kind}>
              <span className="template-mini" style={{ color: t.accent }}>
                <Blocks size={19} />
              </span>
              <div>
                <strong>{t.name}</strong>
                <small>{t.category} starter</small>
              </div>
              <ArrowUpRight size={15} />
            </Link>
          ))}
        </div>
      </section>
      <div className="dashboard-footer">
        <Link className="eyebrow" href="/welcome">
          ATROX PLATFORM <b>/</b> V1.0 <ArrowUpRight size={10} />
        </Link>
        <span>Describe it. Build it. Own it.</span>
      </div>
    </div>
  );
}
