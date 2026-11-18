import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Box,
  Check,
  ChevronsUpDown,
  FolderClosed,
  Grid2X2,
  House,
  Layers3,
  LayoutTemplate,
  LogIn,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  SquarePen,
  SquareTerminal,
  Unplug,
  UserRoundPlus,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { catalog } from '../../shared/catalog.mjs';
import { api, go, relative, usePath } from '../lib/client';
import { useWorkspace } from '../lib/workspace';
import { Brand, Button, Empty, IconButton, Link, Modal } from './UI';
// UI-only preferences. Browsers that block storage can still open a workspace.
const uiPreference = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Optional preference storage is unavailable. */
    }
  },
};
export const nav = [
  { path: '/', name: 'Home', icon: House },
  { path: '/create', name: 'Create', icon: SquarePen },
  { path: '/projects', name: 'My Projects', icon: FolderClosed },
  { path: '/workspace', name: 'AI Workspace', icon: SquareTerminal },
  { path: '/templates', name: 'Templates', icon: LayoutTemplate },
  { path: '/integrations', name: 'Integrations', icon: Unplug },
  { path: '/activity', name: 'Activity', icon: Activity },
  { path: '/settings', name: 'Settings', icon: Settings2 },
];
function SearchDialog({ close }: { close: () => void }) {
  const w = useWorkspace(),
    [q, setQ] = useState(''),
    [idx, setIdx] = useState(0),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const results = [
    ...w.data.projects.map((p) => ({
      name: p.name,
      group: 'Project',
      path: '/workspace/' + p.id,
      icon: FolderClosed,
    })),
    ...nav.map((n) => ({ ...n, group: 'Section' })),
    ...catalog.map((t) => ({
      name: t.name + ' template',
      group: 'Template',
      path: '/templates?kind=' + t.kind,
      icon: LayoutTemplate,
    })),
  ]
    .filter((o) => (o.name + ' ' + o.group).toLowerCase().includes(q.toLowerCase()))
    .slice(0, 12);
  const select = (p: string) => {
    close();
    go(p);
  };
  return (
    <Modal title="Search workspace" kicker="COMMAND CENTER" close={close}>
      <div className="command-search">
        <Search size={18} />
        <input
          ref={input}
          placeholder="Find a project, page, or template…"
          aria-label="Search workspace"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIdx((i) => Math.min(i + 1, results.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIdx((i) => Math.max(0, i - 1));
            }
            if (e.key === 'Enter' && results[idx]) select(results[idx].path);
          }}
        />
      </div>
      <div className="command-results">
        {results.length ? (
          results.map((r, i) => (
            <button
              key={r.path + r.group}
              className={i === idx ? 'selected' : ''}
              onClick={() => select(r.path)}
              onMouseEnter={() => setIdx(i)}
            >
              <r.icon size={17} />
              <span>{r.name}</span>
              <small>{r.group}</small>
            </button>
          ))
        ) : (
          <Empty icon={Search} title="No matches">
            <p>Try a different name or search term.</p>
          </Empty>
        )}
      </div>
      <div className="keyhint">
        <kbd>↑</kbd>
        <kbd>↓</kbd> to navigate <kbd>↵</kbd> to open <kbd>esc</kbd> to close
      </div>
    </Modal>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const w = useWorkspace(),
    path = usePath(),
    base = path.split('?')[0],
    current = nav.find((n) => (n.path === '/' ? base === '/' : base.startsWith(n.path))) || nav[0],
    [compact, setCompact] = useState(() => uiPreference.get('atrox.sidebar') === 'compact'),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(false),
    [pop, setPop] = useState(''),
    [seen, setSeen] = useState(() => uiPreference.get('atrox.activity.seen') || '');
  const u = w.data.user,
    plan = w.data.plans[u.plan];
  useEffect(() => {
    setMobile(false);
    setPop('');
    document.title = current.name + ' · ATROX';
  }, [path]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch((s) => !s);
      }
      if (e.key === 'Escape') {
        setPop('');
        setMobile(false);
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);
  useEffect(() => {
    if (!pop) return;
    const outside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-popover-zone]')) setPop('');
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [pop]);
  const collapse = () => {
    setCompact(!compact);
    uiPreference.set('atrox.sidebar', compact ? 'wide' : 'compact');
  };
  const navItem = (n: (typeof nav)[number]) => (
    <Link
      key={n.path}
      href={n.path}
      title={compact ? n.name : undefined}
      className={'nav-item ' + (current.path === n.path ? 'active' : '')}
      aria-current={current.path === n.path ? 'page' : undefined}
      onClick={(e) => {
        if (n.path === '/create') {
          e.preventDefault();
          w.newProject();
        }
      }}
    >
      <n.icon size={17} strokeWidth={1.7} />
      <span>{n.name}</span>
      {n.path === '/create' && <small>+</small>}
    </Link>
  );
  return (
    <div className={'app-shell ' + (compact ? 'collapsed ' : '') + (mobile ? 'mobile-open' : '')}>
      {mobile && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link href="/" aria-label="ATROX Home">
            <Brand />
          </Link>
          <IconButton
            className="collapse-button"
            label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={collapse}
          >
            {compact ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </IconButton>
          <IconButton
            className="mobile-close"
            label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={17} />
          </IconButton>
        </div>
        <div className="workspace-switch-wrap" data-popover-zone>
          <button
            className="workspace-switch"
            aria-expanded={pop === 'space'}
            onClick={() => setPop(pop === 'space' ? '' : 'space')}
            title="Workspace menu"
          >
            <span className="workspace-icon">
              <Layers3 size={18} />
            </span>
            <div>
              <strong>My workspace</strong>
              <small>{plan.name} plan</small>
            </div>
            <ChevronsUpDown size={13} />
          </button>
          {pop === 'space' && (
            <div className="popover switch-pop">
              <div className="menu-label">CURRENT WORKSPACE</div>
              <button
                onClick={() => {
                  setPop('');
                  go('/');
                }}
              >
                <Layers3 size={15} />
                Personal workspace
                <Check size={13} />
              </button>
              <button onClick={() => go('/settings')}>
                <Settings2 size={15} />
                Workspace settings
              </button>
              <button onClick={() => go('/welcome')}>
                <BookOpen size={15} />
                About ATROX
              </button>
            </div>
          )}
        </div>
        <nav className="main-nav" aria-label="Primary navigation">
          <div className="nav-label">WORKSPACE</div>
          {nav.slice(0, 4).map(navItem)}
          <div className="nav-label second">PLATFORM</div>
          {nav.slice(4).map(navItem)}
        </nav>
        <div className="side-bottom">
          <div className="usage-card">
            <div className="usage-title">
              <span>
                <Box size={14} />
                Workspace usage
              </span>
              <Link aria-label="View usage" href="/settings?tab=usage">
                <ArrowUpRight size={13} />
              </Link>
            </div>
            <div className="usage-track">
              <span
                style={{
                  width: Math.min(100, (100 * w.data.projects.length) / plan.projects) + '%',
                }}
              />
            </div>
            <p>
              <b>
                {w.data.projects.length} of {plan.projects}
              </b>{' '}
              projects
            </p>
          </div>
          <div className="profile-wrap" data-popover-zone>
            <button
              className="profile-button"
              title="Account menu"
              onClick={() => setPop(pop === 'profile' ? '' : 'profile')}
            >
              <span className="avatar">
                {u.name
                  .split(' ')
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
              <div>
                <strong>{u.name}</strong>
                <small>{u.guest ? 'Guest workspace' : 'Account owner'}</small>
              </div>
              <ChevronsUpDown size={14} />
            </button>
            {pop === 'profile' && (
              <div className="popover profile-pop">
                <div className="menu-label">{u.guest ? 'PRIVATE GUEST SESSION' : u.email}</div>
                <button onClick={() => go('/settings')}>
                  <Settings2 size={15} />
                  Account settings
                </button>
                {u.guest ? (
                  <>
                    <button
                      onClick={() => {
                        setPop('');
                        w.auth('signup');
                      }}
                    >
                      <UserRoundPlus size={15} />
                      Create an account
                    </button>
                    <button
                      onClick={() => {
                        setPop('');
                        w.auth('signin');
                      }}
                    >
                      <LogIn size={15} />
                      Sign in
                    </button>
                  </>
                ) : (
                  <button
                    onClick={async () => {
                      await api('/auth/signout', 'POST');
                      location.assign('/welcome');
                    }}
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                )}
                <button onClick={() => go('/welcome')}>
                  <BookOpen size={15} />
                  About ATROX
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            <IconButton
              className="mobile-menu"
              label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </IconButton>
            <Grid2X2 size={14} className="crumb-icon" />
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <b>{current.name}</b>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              onClick={() => setSearch(true)}
              aria-label="Search workspace"
            >
              <Search size={15} />
              <span>Search workspace</span>
              <kbd>⌘ K</kbd>
            </button>
            <div className="notification-wrap" data-popover-zone>
              <IconButton
                label="Notifications"
                className="bell"
                onClick={() => {
                  const next = pop === 'bell' ? '' : 'bell';
                  setPop(next);
                  if (next && w.data.activity[0]) {
                    setSeen(w.data.activity[0].id);
                    uiPreference.set('atrox.activity.seen', w.data.activity[0].id);
                  }
                }}
              >
                <Bell size={17} />
                {w.data.activity[0]?.id !== seen && <i />}
              </IconButton>
              {pop === 'bell' && (
                <div className="popover notification-pop">
                  <div className="menu-label">WORKSPACE NOTIFICATIONS</div>
                  {w.data.activity.slice(0, 4).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setPop('');
                        go(a.project_id ? '/workspace/' + a.project_id : '/activity');
                      }}
                    >
                      <span>
                        <strong>{a.action}</strong>
                        <small>
                          {a.detail} · {relative(a.created)}
                        </small>
                      </span>
                    </button>
                  ))}
                  <button className="text-link" onClick={() => go('/activity')}>
                    Activity log <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </div>
            <span className="top-separator" />
            <Button className="new-project" onClick={w.newProject}>
              <Plus size={14} />
              New project
            </Button>
          </div>
        </header>
        <main
          id="main"
          className={'main-content ' + (base.startsWith('/workspace/') ? 'workspace-content' : '')}
          key={base.split('/')[1]}
        >
          {children}
        </main>
      </div>
      {search && <SearchDialog close={() => setSearch(false)} />}
    </div>
  );
}
