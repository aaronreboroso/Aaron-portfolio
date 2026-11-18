import {
  Asterisk,
  Check,
  CloudUpload,
  Cpu,
  Database,
  HardDrive,
  Orbit,
  Settings2,
  ShieldCheck,
  Sparkle,
  Unplug,
  Webhook,
} from 'lucide-react';
import { useState } from 'react';
import { Button, ErrorLine, Field, Modal, PageTitle, SectionHead, Status } from '../components/UI';
import { api, useTask } from '../lib/client';
import type { Provider } from '../lib/types';
import { useWorkspace } from '../lib/workspace';
const providerIcon = { openai: Orbit, anthropic: Asterisk, gemini: Sparkle },
  color = {
    openai: '#81bcab',
    anthropic: '#d4a487',
    gemini: '#999ee2',
    netlify: '#65b8c3',
    webhook: '#bd92c6',
  };
function ProviderForm({ p, close }: { p: Provider; close: () => void }) {
  const w = useWorkspace(),
    [key, setKey] = useState(''),
    [model, setModel] = useState(p.model),
    [fallback, setFallback] = useState(p.fallback),
    [tested, setTested] = useState(false),
    task = useTask();
  return (
    <Modal title={'Configure ' + p.name} kicker="AI PROVIDER" close={close}>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await api('/providers/' + p.slug, 'PUT', { secret: key || undefined, model, fallback });
            setKey('');
            await w.refresh();
            w.notify(p.name + ' configuration saved.');
            close();
          });
        }}
      >
        <p>{p.description}</p>
        <Field
          label="API key"
          hint={
            p.configured
              ? 'Leave blank to retain the encrypted key. Saved keys are never returned to the browser.'
              : 'Use an API key you are authorized to use. It is encrypted on the server.'
          }
        >
          <input
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            value={key}
            required={!p.configured}
            minLength={8}
            placeholder={p.configured ? 'Existing key stored securely' : 'Paste provider API key'}
            onChange={(e) => setKey(e.target.value)}
          />
        </Field>
        <Field label="Model ID" hint="Use a model enabled on your provider account.">
          <input
            list="model-list"
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <datalist id="model-list">
            {p.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <label className="check-option">
          <input
            type="checkbox"
            checked={fallback}
            onChange={(e) => setFallback(e.target.checked)}
          />
          Allow fallback routing for this provider
        </label>
        <div className="inline-notice">
          <ShieldCheck size={16} />
          <span>
            Permission: send project context for planning, code assistance, and workflow AI steps.
            Provider usage charges may apply.
          </span>
        </div>
        <ErrorLine text={task.error} />
        {tested && (
          <div className="saved">
            <Check size={14} />
            Credentials accepted by the official model registry.
          </div>
        )}
        <div className="modal-actions">
          {p.configured && (
            <Button
              type="button"
              busy={task.busy}
              onClick={() =>
                task.run(async () => {
                  await api('/providers/' + p.slug + '/test', 'POST');
                  setTested(true);
                  await w.refresh();
                })
              }
            >
              Test saved key
            </Button>
          )}
          <Button variant="primary" type="submit" busy={task.busy}>
            Save configuration
          </Button>
        </div>
        {p.configured && (
          <Button
            type="button"
            variant="ghost"
            busy={task.busy}
            onClick={() =>
              task.run(async () => {
                await api('/providers/' + p.slug, 'DELETE');
                await w.refresh();
                close();
                w.notify('Provider credentials removed.');
              })
            }
          >
            <Unplug size={13} />
            Disconnect provider
          </Button>
        )}
      </form>
    </Modal>
  );
}
export function Integrations() {
  const w = useWorkspace(),
    [selected, setSelected] = useState(''),
    [filter, setFilter] = useState('All integrations'),
    [token, setToken] = useState(''),
    [site, setSite] = useState(''),
    [url, setUrl] = useState(''),
    task = useTask();
  const providers = w.data.providers,
    p = providers.find((p) => p.slug === selected),
    conn = w.data.integrations.find((i) => i.slug === selected);
  const open = (slug: string) => {
    setSelected(slug);
    task.setError('');
    setToken('');
    setSite(w.data.integrations.find((i) => i.slug === slug)?.site || '');
    setUrl('');
  };
  return (
    <div className="page-enter">
      <PageTitle
        kicker="CONNECTION CENTER"
        title="Integrations"
        subtitle="Connect authorized AI models, deployment targets, and external services."
      />
      <div className="router-banner">
        <span className="router-icon">
          <Cpu size={25} />
        </span>
        <div>
          <div className="eyebrow red">INTELLIGENT MODEL ROUTER</div>
          <h3>{providers.filter((p) => p.configured).length} external providers configured</h3>
          <p>
            The local engine is available without credentials. Routing uses only the providers you
            configure.
          </p>
        </div>
        <Status>Local engine online</Status>
      </div>
      <div className="pills spaced">
        {['All integrations', 'AI providers', 'Services', 'Built-in'].map((c) => (
          <button key={c} className={filter === c ? 'active' : ''} onClick={() => setFilter(c)}>
            {c}
          </button>
        ))}
      </div>
      {['All integrations', 'AI providers'].includes(filter) && (
        <section className="integration-section">
          <SectionHead title="AI providers" />
          <div className="integration-grid">
            {providers.map((p) => {
              const I = providerIcon[p.slug as keyof typeof providerIcon];
              return (
                <div className="integration-card" key={p.slug}>
                  <div className="row-between">
                    <span
                      className="service-icon"
                      style={{ color: color[p.slug as keyof typeof color] }}
                    >
                      <I size={23} />
                    </span>
                    <Status tone={p.verified ? 'green' : p.configured ? 'amber' : 'neutral'}>
                      {p.verified ? 'Verified' : p.configured ? 'Configured' : 'Not configured'}
                    </Status>
                  </div>
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>
                  <div className="integration-foot">
                    <span>{p.configured ? p.model : 'Official API'}</span>
                    <Button onClick={() => open(p.slug)}>
                      <Settings2 size={12} />
                      {p.configured ? 'Manage' : 'Configure'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {['All integrations', 'Services'].includes(filter) && (
        <section className="integration-section">
          <SectionHead title="External services" />
          <div className="integration-grid">
            {[
              {
                slug: 'netlify',
                name: 'Netlify',
                I: CloudUpload,
                d: 'Publish a static frontend to a site you control. Browser-local records, no private preview data.',
              },
              {
                slug: 'webhook',
                name: 'HTTP webhook',
                I: Webhook,
                d: 'Send workflow messages to an administrator-allowlisted HTTPS endpoint.',
              },
            ].map((s) => (
              <div key={s.slug} className="integration-card">
                <div className="row-between">
                  <span
                    className="service-icon"
                    style={{ color: color[s.slug as keyof typeof color] }}
                  >
                    <s.I size={23} />
                  </span>
                  <Status
                    tone={w.data.integrations.some((i) => i.slug === s.slug) ? 'amber' : 'neutral'}
                  >
                    {w.data.integrations.some((i) => i.slug === s.slug)
                      ? 'Configured'
                      : 'Not configured'}
                  </Status>
                </div>
                <h3>{s.name}</h3>
                <p>{s.d}</p>
                <div className="integration-foot">
                  <span>{s.slug === 'netlify' ? 'Deployment' : 'External API'}</span>
                  <Button onClick={() => open(s.slug)}>
                    <Settings2 size={12} />
                    Configure
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {['All integrations', 'Built-in'].includes(filter) && (
        <section>
          <SectionHead title="Managed runtime" />
          <div className="integration-grid">
            {[
              {
                I: Database,
                n: 'SQLite database',
                d: 'Persistent, owner-scoped application and record storage.',
              },
              {
                I: ShieldCheck,
                n: 'Session authentication',
                d: 'Scrypt password hashes and HTTP-only private sessions.',
              },
              {
                I: HardDrive,
                n: 'Project filesystem',
                d: 'Isolated source files and immutable version snapshots.',
              },
            ].map((s) => (
              <div className="integration-card compact" key={s.n}>
                <div className="row-between">
                  <s.I size={18} />
                  <Status>Built-in</Status>
                </div>
                <h3>{s.n}</h3>
                <p>{s.d}</p>
                <small>Managed by this installation</small>
              </div>
            ))}
          </div>
        </section>
      )}
      {p && <ProviderForm p={p} close={() => setSelected('')} />}{' '}
      {['webhook', 'netlify'].includes(selected) && (
        <Modal
          title={selected === 'netlify' ? 'Configure Netlify' : 'Configure webhook'}
          kicker="EXTERNAL SERVICE"
          close={() => setSelected('')}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                await api(
                  '/integrations/' + selected,
                  'PUT',
                  selected === 'netlify' ? { token, site } : { url },
                );
                await w.refresh();
                setSelected('');
                w.notify('Service configuration saved. No external action has been run.');
              });
            }}
          >
            {selected === 'netlify' ? (
              <>
                <Field
                  label="Netlify access token"
                  hint="Use a token with permission to deploy to the selected site."
                >
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                </Field>
                <Field label="Site ID (UUID)">
                  <input
                    required
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    placeholder="Site ID from Netlify configuration"
                  />
                </Field>
                <p className="fineprint">
                  This enables explicit source publishing from the project’s Deploy dialog. Saving
                  credentials does not publish anything.
                </p>
              </>
            ) : (
              <Field
                label="Destination URL"
                hint="Ask your administrator to add the destination hostname to ATROX_WEBHOOK_HOSTS. URLs and embedded tokens are encrypted at rest."
              >
                <input
                  required
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-service.example/events"
                />
              </Field>
            )}
            <ErrorLine text={task.error} />
            <Button variant="primary" type="submit" busy={task.busy}>
              Save configuration
            </Button>
            {conn && (
              <Button
                type="button"
                busy={task.busy}
                onClick={() =>
                  task.run(async () => {
                    await api('/integrations/' + selected, 'DELETE');
                    await w.refresh();
                    setSelected('');
                    w.notify('Service disconnected.');
                  })
                }
              >
                <Unplug size={13} />
                Disconnect
              </Button>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
