import { Activity, ArrowRight, Copy, KeyRound, LogOut, Save, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { modes } from '../../shared/catalog.mjs';
import {
  Button,
  Empty,
  ErrorLine,
  Field,
  Link,
  Modal,
  PageTitle,
  SectionHead,
  Status,
} from '../components/UI';
import { api, go, stamp, usePath, useTask } from '../lib/client';
import type { Mode, User } from '../lib/types';
import { useWorkspace, type AuthMode } from '../lib/workspace';
export function Auth() {
  const w = useWorkspace(),
    mode = w.authMode;
  return mode ? <AuthForm key={mode} mode={mode} /> : null;
}
function AuthForm({ mode }: { mode: AuthMode }) {
  const w = useWorkspace(),
    [email, setEmail] = useState(''),
    [pw, setPw] = useState(''),
    [name, setName] = useState(w.data.user.name === 'Guest maker' ? '' : w.data.user.name),
    [key, setKey] = useState(''),
    [recovery, setRecovery] = useState(''),
    [saved, setSaved] = useState(false),
    task = useTask();
  return (
    <Modal
      title={
        recovery
          ? 'Save your recovery key'
          : mode === 'signup'
            ? 'Make this workspace yours'
            : mode === 'reset'
              ? 'Reset your password'
              : 'Welcome back'
      }
      kicker="ATROX ACCOUNT"
      close={() => {
        if (!recovery || saved) w.closeAuth();
        else task.setError('Save your recovery key before closing.');
      }}
    >
      {recovery ? (
        <div className="form-stack">
          <div className="inline-notice">
            <KeyRound size={17} />
            This key is shown once. Keep it offline to reset your password. No recovery email is
            sent.
          </div>
          <Field label="Account recovery key">
            <textarea readOnly value={recovery} rows={2} />
          </Field>
          <Button
            onClick={() =>
              task.run(async () => {
                await navigator.clipboard.writeText(recovery);
                w.notify('Recovery key copied.');
              })
            }
          >
            <Copy size={14} />
            Copy recovery key
          </Button>
          <label className="check-option">
            <input checked={saved} type="checkbox" onChange={(e) => setSaved(e.target.checked)} />I
            have stored my recovery key safely.
          </label>
          <ErrorLine text={task.error} />
          <Button
            variant="primary"
            disabled={!saved}
            onClick={() => {
              w.closeAuth();
              w.notify('Your account is ready.');
              go('/');
            }}
          >
            Continue to workspace <ArrowRight size={14} />
          </Button>
        </div>
      ) : (
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              const r = await api<{ user: User; recovery?: string }>('/auth/' + mode, 'POST', {
                email,
                password: pw,
                name,
                recovery: key,
              });
              await w.refresh();
              w.setDraft(null);
              w.setPrompt('');
              setPw('');
              if (r.recovery) setRecovery(r.recovery);
              else {
                w.closeAuth();
                w.notify('Signed in to your private workspace.');
                go('/');
              }
            });
          }}
        >
          <p>
            {mode === 'signup'
              ? 'Create an account to keep this guest workspace, including all your projects and edits.'
              : mode === 'signin'
                ? 'Sign in to your existing account. Guest projects are not merged into another account.'
                : 'Use the recovery key issued at signup. All previous sessions will be revoked.'}
          </p>
          {mode === 'signup' && (
            <Field label="Display name">
              <input
                autoComplete="name"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          )}
          <Field label="Email address">
            <input
              autoComplete="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          {mode === 'reset' && (
            <Field label="Recovery key">
              <input
                type="password"
                required
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="off"
              />
            </Field>
          )}
          <Field
            label={mode === 'reset' ? 'New password' : 'Password'}
            hint={mode === 'signin' ? undefined : 'Use at least 10 characters.'}
          >
            <input
              type="password"
              required
              minLength={mode === 'signin' ? 1 : 10}
              maxLength={256}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </Field>
          <ErrorLine text={task.error} />
          <Button variant="primary" busy={task.busy}>
            {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in'}
            <ArrowRight size={14} />
          </Button>
          <div className="auth-links">
            {mode !== 'signin' && (
              <button type="button" className="sub-link" onClick={() => w.auth('signin')}>
                Already have an account? Sign in
              </button>
            )}
            {mode === 'signin' && (
              <>
                <button type="button" className="sub-link" onClick={() => w.auth('signup')}>
                  Create account
                </button>
                <button type="button" className="sub-link" onClick={() => w.auth('reset')}>
                  Forgot password?
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
export function Settings() {
  const w = useWorkspace(),
    d = w.data,
    u = d.user,
    path = usePath(),
    tab = new URLSearchParams(path.split('?')[1]).get('tab') || 'profile',
    [name, setName] = useState(u.name),
    [mode, setMode] = useState<Mode>(u.preferences.mode || 'Automatic'),
    [instructions, setInst] = useState(u.preferences.instructions || ''),
    task = useTask(),
    plan = d.plans[u.plan];
  return (
    <div className="page-enter">
      <PageTitle
        kicker="WORKSPACE CONTROL"
        title="Settings"
        subtitle="Manage your identity, generation preferences, security, and usage."
      />
      <div className="tabs">
        {[
          { k: 'profile', n: 'Profile & preferences' },
          { k: 'usage', n: 'Usage & billing' },
          { k: 'security', n: 'Account security' },
        ].map((t) => (
          <button
            className={tab === t.k ? 'active' : ''}
            key={t.k}
            onClick={() => go('/settings?tab=' + t.k)}
          >
            {t.n}
          </button>
        ))}
      </div>
      {tab === 'usage' ? (
        <div className="stack">
          <section className="panel">
            <div className="row-between">
              <div>
                <div className="eyebrow red">CURRENT PLAN</div>
                <h2 className="subheading">ATROX {plan.name}</h2>
              </div>
              <span className="plan-price">
                ${plan.price}
                <small>/ month</small>
              </span>
            </div>
            <div className="usage-grid">
              {[
                { n: 'Projects', v: d.projects.length, max: plan.projects },
                { n: 'Monthly AI requests', v: d.monthly.requests, max: plan.requests },
              ].map((m) => (
                <div key={m.n}>
                  <div className="row-between">
                    <span>{m.n}</span>
                    <strong>
                      {m.v} / {m.max}
                    </strong>
                  </div>
                  <div className="usage-track">
                    <span style={{ width: Math.min(100, (m.v / m.max) * 100) + '%' }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="fineprint">
              Plan prices are in USD. AI quotas reset monthly (UTC). Local builds do not consume AI
              requests. Provider-reported tokens this month: {d.monthly.tokens.toLocaleString()}.
              API charges are billed separately by your provider; ATROX does not estimate them.
            </p>
          </section>
          <div className="pricing-grid">
            {Object.entries(d.plans).map(([k, p]) => (
              <div key={k} className={'panel price-card ' + (k === u.plan ? 'current' : '')}>
                <div className="row-between">
                  <h3>{p.name}</h3>
                  {k === u.plan && <Status>Current</Status>}
                </div>
                <div className="price-number">
                  ${p.price}
                  <small>/mo</small>
                </div>
                <p>{p.projects} private projects</p>
                <p>{p.requests.toLocaleString()} AI requests / month</p>
                {u.plan === 'free' && k !== 'free' && d.billing ? (
                  <Button
                    busy={task.busy}
                    onClick={() =>
                      task.run(async () => {
                        if (u.guest) {
                          w.auth('signup');
                          return;
                        }
                        const r = await api<{ url: string }>('/billing/checkout', 'POST', {
                          plan: k,
                        });
                        location.assign(r.url);
                      })
                    }
                  >
                    Open Stripe Checkout
                  </Button>
                ) : (
                  <small>
                    {k === u.plan
                      ? 'Active workspace plan'
                      : !d.billing
                        ? 'Checkout not configured'
                        : 'Contact your administrator'}
                  </small>
                )}
              </div>
            ))}
          </div>
          <ErrorLine text={task.error} />
          <section className="panel">
            <SectionHead title="AI request history" count={d.usage.length} />
            {d.usage.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {[
                        'Task',
                        'Provider / model',
                        'Input tokens',
                        'Output tokens',
                        'Status',
                        'Time',
                      ].map((s) => (
                        <th key={s}>{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.usage.map((a, i) => (
                      <tr key={a.created + '-' + i}>
                        <td>{a.task}</td>
                        <td>
                          {a.provider} / {a.model}
                        </td>
                        <td>{a.input_tokens ?? '—'}</td>
                        <td>{a.output_tokens ?? '—'}</td>
                        <td>{a.status}</td>
                        <td>{stamp(a.created)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon={Activity} title="No external AI requests">
                <p>
                  Real provider requests and token counts appear here after you connect a provider
                  and run a task.
                </p>
                <Link className="text-link" href="/integrations">
                  Manage providers <ArrowRight size={13} />
                </Link>
              </Empty>
            )}
          </section>
        </div>
      ) : tab === 'security' ? (
        <div className="two-col">
          <section className="panel form-stack">
            <div className="eyebrow">
              <ShieldCheck size={14} />
              PRIVATE SESSION
            </div>
            <h2>Account security</h2>
            <p>
              {u.guest
                ? 'You are using a private guest session. Sign up to keep access across devices.'
                : 'Your account uses a hashed password and an HTTP-only session cookie.'}
            </p>
            <div className="subtle-row">
              <span>Session type</span>
              <b>{u.guest ? 'Guest' : 'Authenticated'}</b>
            </div>
            {u.guest ? (
              <Button variant="primary" onClick={() => w.auth('signup')}>
                Save workspace to an account
              </Button>
            ) : (
              <Button onClick={() => w.auth('reset')}>
                <KeyRound size={14} />
                Reset with recovery key
              </Button>
            )}
            {!u.guest && (
              <Button
                busy={task.busy}
                onClick={() =>
                  task.run(async () => {
                    await api('/auth/signout', 'POST');
                    location.assign('/welcome');
                  })
                }
              >
                <LogOut size={14} />
                Sign out
              </Button>
            )}
            <ErrorLine text={task.error} />
          </section>
          <section className="panel form-stack">
            <h3>Credential storage</h3>
            <p className="fineprint">
              Provider tokens are encrypted at rest with AES-256-GCM. Keys are never included in
              exported projects or exposed to generated applications.
            </p>
            <Link className="text-link" href="/integrations">
              Manage credentials <ArrowRight size={13} />
            </Link>
            <h3>Recovery</h3>
            <p className="fineprint">
              Account recovery uses the one-time backup key issued at signup, not email. Keep it
              separate from your password.
            </p>
          </section>
        </div>
      ) : (
        <div className="two-col">
          <form
            className="panel form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                await api('/profile', 'PUT', { name, preferences: { mode, instructions } });
                await w.refresh();
                w.setMode(mode);
                w.notify('Workspace preferences saved.');
              });
            }}
          >
            <div className="eyebrow red">IDENTITY & DEFAULTS</div>
            <h2>Workspace preferences</h2>
            <Field label="Display name">
              <input
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Default routing mode">
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                {modes.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Default project instructions"
              hint="Copied into project memory when you create a new application."
            >
              <textarea
                rows={4}
                maxLength={2500}
                value={instructions}
                onChange={(e) => setInst(e.target.value)}
                placeholder="Prefer a compact layout and clear field labels…"
              />
            </Field>
            <ErrorLine text={task.error} />
            <Button busy={task.busy} type="submit" variant="primary">
              <Save size={14} />
              Save preferences
            </Button>
          </form>
          <div className="panel account-card">
            <span className="avatar large">{u.name.slice(0, 1).toUpperCase()}</span>
            <h2>{u.name}</h2>
            <p>{u.email || 'Private guest workspace'}</p>
            <Status tone={u.guest ? 'neutral' : 'green'}>
              {u.guest ? 'Guest session' : 'Authenticated'}
            </Status>
            <div className="divided">
              {u.guest ? (
                <>
                  <p className="fineprint">
                    Your starter projects are real and editable. Create an account to keep this
                    workspace when your session expires.
                  </p>
                  <Button onClick={() => w.auth('signup')}>
                    Create account <ArrowRight size={13} />
                  </Button>
                  <button className="sub-link" onClick={() => w.auth('signin')}>
                    Sign in instead
                  </button>
                </>
              ) : (
                <Link href="/settings?tab=security" className="text-link">
                  Account security <ArrowRight size={13} />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
