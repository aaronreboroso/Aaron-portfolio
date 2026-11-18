import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from './components/Shell';
import { Empty, Link } from './components/UI';
import { go, usePath } from './lib/client';
import { WorkspaceProvider, useWorkspace } from './lib/workspace';
import { Auth, Settings } from './pages/Account';
import Create from './pages/Create';
import { Activity, Projects, Templates } from './pages/Directory';
import Home from './pages/Home';
import { Integrations } from './pages/Integrations';
import Landing from './pages/Landing';
import Workspace from './pages/Workspace';
import './app.css';
function Application() {
  const path = usePath().split('?')[0],
    w = useWorkspace();
  useEffect(() => {
    if (['/signin', '/signup', '/reset'].includes(path)) {
      w.auth(path.slice(1) as 'signin' | 'signup' | 'reset');
      go('/');
    }
  }, [path]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Shell>
        {path === '/' ? (
          <Home />
        ) : path === '/create' ? (
          <Create />
        ) : path === '/projects' ? (
          <Projects />
        ) : path === '/workspace' || path.startsWith('/workspace/') ? (
          <Workspace />
        ) : path === '/templates' ? (
          <Templates />
        ) : path === '/integrations' ? (
          <Integrations />
        ) : path === '/activity' ? (
          <Activity />
        ) : path === '/settings' ? (
          <Settings />
        ) : (
          <Empty title="Page not found">
            <Link className="btn" href="/">
              Return home
            </Link>
          </Empty>
        )}
      </Shell>
      <Auth />
    </>
  );
}
class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="boot-error">
        <h2>The workspace view could not load.</h2>
        <p>Your saved files are still on the server.</p>
        <button className="btn" onClick={() => location.assign('/')}>
          Reopen workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Root() {
  const path = usePath().split('?')[0];
  return (
    <Boundary>
      {path === '/welcome' || path === '/about' ? (
        <Landing />
      ) : (
        <WorkspaceProvider>
          <Application />
        </WorkspaceProvider>
      )}
    </Boundary>
  );
}
createRoot(document.getElementById('root')!).render(<Root />);
