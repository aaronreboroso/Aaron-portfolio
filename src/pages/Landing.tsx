import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  Database,
  Layers3,
  Menu,
  PanelTop,
  Plus,
  Router,
  ShieldCheck,
  Workflow,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { plans } from '../../shared/plans.mjs';
import { Brand, Link } from '../components/UI';
const areas = [
  {
    I: Layers3,
    n: 'Software creation engine',
    d: 'Start with a goal, not a blank repository. Review the collections, features and architecture before the engine creates a runnable application.',
    tag: '01 / COMPILE',
  },
  {
    I: PanelTop,
    n: 'Visual builder',
    d: 'Compose pages from functional components. Adjust their properties and see the actual project configuration change.',
    tag: '02 / COMPOSE',
  },
  {
    I: Router,
    n: 'AI model routing',
    d: 'Bring your own authorized providers. Choose a routing mode and opt in to transparent fallback when a provider is unavailable.',
    tag: '03 / ROUTE',
  },
  {
    I: Database,
    n: 'Project memory',
    d: 'Keep requirements and architecture decisions next to the source. Refine an existing application without starting from zero.',
    tag: '04 / REMEMBER',
  },
  {
    I: Braces,
    n: 'Code workspace',
    d: 'Inspect every source file. Edit with syntax highlighting, validate changes and restore previous versions when you need a fresh start.',
    tag: '05 / REFINE',
  },
  {
    I: Workflow,
    n: 'Workflow automation',
    d: 'Connect record events, conditions, variables and actions. Test a saved workflow and inspect its real execution history.',
    tag: '06 / AUTOMATE',
  },
];
export default function Landing() {
  const [menu, setMenu] = useState(false);
  return (
    <div className="landing">
      <header className="land-nav">
        <Link href="/welcome" aria-label="ATROX overview">
          <Brand />
        </Link>
        <nav className={menu ? 'open' : ''}>
          <a href="#how" onClick={() => setMenu(false)}>
            How it works
          </a>
          <a href="#system" onClick={() => setMenu(false)}>
            Platform
          </a>
          <a href="#pricing" onClick={() => setMenu(false)}>
            Pricing
          </a>
          <a href="#faq" onClick={() => setMenu(false)}>
            FAQ
          </a>
        </nav>
        <Link href="/" className="btn">
          Open workspace <ArrowUpRight size={14} />
        </Link>
        <button
          aria-label="Toggle landing navigation"
          className="land-toggle"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X size={19} /> : <Menu size={19} />}
        </button>
      </header>
      <main>
        <section className="land-hero">
          <div className="land-hero-copy">
            <div className="hero-kicker">
              <span className="engine-light" />
              ADAPTIVE SOFTWARE PLATFORM
            </div>
            <h1>
              Software should
              <br />
              adapt to you<span>.</span>
            </h1>
            <p>
              Meet ATROX. Transform ideas into intelligent, functional applications through one
              adaptive creation environment.
            </p>
            <div className="land-actions">
              <Link href="/" className="btn primary">
                Start Creating <ArrowRight size={15} />
              </Link>
              <a href="#how" className="btn">
                Explore ATROX
              </a>
            </div>
            <div className="land-tagline">DESCRIBE IT. BUILD IT. OWN IT.</div>
          </div>
          <div className="land-art">
            <img
              src="/art/creation-core.jpg"
              alt="Exploded ATROX creation core with illuminated red layers"
            />
            <div className="core-figure">FIG. 01 / CREATION CORE</div>
          </div>
        </section>
        <section className="land-section" id="how">
          <div className="eyebrow red">THE PROCESS</div>
          <h2>From a sentence to source code.</h2>
          <div className="land-process">
            {[
              {
                t: 'Describe the objective',
                d: 'Tell ATROX who the app serves and what they need to accomplish.',
              },
              {
                t: 'Review the architecture',
                d: 'Inspect and edit the plan, pages and data collections before building.',
              },
              {
                t: 'Build, refine, export',
                d: 'Test a working preview, change the interface, and download the complete source.',
              },
            ].map((s, i) => (
              <div key={s.t}>
                <span>0{i + 1}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </section>
        <section id="system" className="land-section">
          <div className="eyebrow red">THE PLATFORM</div>
          <h2>One environment. Full control.</h2>
          <div className="capability-grid">
            {areas.map((a) => (
              <div key={a.n}>
                <a.I size={22} />
                <small>{a.tag}</small>
                <h3>{a.n}</h3>
                <p>{a.d}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="land-security">
          <ShieldCheck size={35} />
          <div>
            <div className="eyebrow">SECURITY BY DESIGN</div>
            <h2>Your source stays yours.</h2>
            <p>
              Private workspaces, encrypted API credentials and sandboxed browser previews.
              Generated code never runs on the platform’s application server.
            </p>
          </div>
        </section>
        <section id="pricing" className="land-section">
          <div className="eyebrow red">WORKSPACE PLANS</div>
          <h2>A foundation that grows with you.</h2>
          <div className="pricing-grid">
            {Object.values(plans)
              .map((p) => ({
                n: p.name,
                p: p.price,
                l: p.projects,
                r: p.requests.toLocaleString(),
              }))
              .map((t) => (
                <div className="panel price-card" key={t.n}>
                  <h3>{t.n}</h3>
                  <div className="price-number">
                    ${t.p}
                    <small>/month</small>
                  </div>
                  <p>{t.l} private projects</p>
                  <p>{t.r} AI requests / month</p>
                  <p>Source export and local creation</p>
                  <Link href={t.p ? '/settings?tab=usage' : '/'} className="text-link">
                    {t.p ? 'Check availability' : 'Start creating'}
                    <ArrowRight size={13} />
                  </Link>
                </div>
              ))}
          </div>
          <p className="fineprint">
            Prices are in USD. Paid checkout requires a configured payment provider. AI provider
            charges are separate. Workspace plans do not include model credits.
          </p>
        </section>
        <section id="faq" className="land-section">
          <div className="eyebrow red">FIELD NOTES</div>
          <h2>Frequently asked questions.</h2>
          {[
            {
              q: 'Do I need an API key to build?',
              a: 'No. The local engine compiles structured CRM, inventory, analytics and other record-based applications. Configure an AI provider for model-assisted planning, code reviews and broader refinements.',
            },
            {
              q: 'What do I own when I export?',
              a: 'The full HTML, CSS, JavaScript, application configuration, Node.js API, database schema, tests and setup instructions. Your private workspace records and API keys are not bundled with the source.',
            },
            {
              q: 'Is a preview a deployment?',
              a: 'No. A preview is an isolated frame inside your workspace. Publish explicitly to a configured Netlify site for a static version, or run the exported database-backed server on your own infrastructure.',
            },
            {
              q: 'Where does my project data live?',
              a: 'Projects, records, instructions and version history are stored on the ATROX server in a persistent SQLite database. Create an account to preserve access beyond a guest session.',
            },
          ].map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <Plus size={15} />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>
      </main>
      <footer className="land-footer">
        <Brand />
        <span>Describe it. Build it. Own it.</span>
        <Link href="/">
          Open workspace <ArrowUpRight size={13} />
        </Link>
      </footer>
    </div>
  );
}
