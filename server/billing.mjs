import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { fail, now, audit, transaction } from './db.mjs';
export const billingReady = () =>
  !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_PRO_PRICE &&
    process.env.STRIPE_TEAM_PRICE &&
    process.env.APP_ORIGIN?.startsWith('https://')
  );
export function billingWebhook(db) {
  return async (req, res) => {
    if (!billingReady()) fail(503, 'Billing is not configured.');
    const entries = (req.headers['stripe-signature'] || '').split(',').map((s) => s.split('='));
    const ts = entries.find((x) => x[0] === 't')?.[1];
    if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300)
      fail(400, 'Invalid webhook timestamp.');
    const sig = createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
      .update(ts + '.')
      .update(req.body)
      .digest();
    if (
      !entries.some(
        ([k, v]) =>
          k === 'v1' && /^[a-f\d]{64}$/i.test(v) && timingSafeEqual(sig, Buffer.from(v, 'hex')),
      )
    )
      fail(400, 'Invalid webhook signature.');
    const e = JSON.parse(req.body);
    if (db.prepare('SELECT id FROM billing_events WHERE id=?').get(e.id))
      return res.json({ received: true });
    if (
      ![
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
      ].includes(e.type)
    )
      return res.json({ received: true });
    const sub = e.data.object,
      uid = sub.metadata?.atrox_user;
    if (!uid || !db.prepare('SELECT id FROM users WHERE id=?').get(uid))
      return res.json({ received: true });
    const active = ['active', 'trialing'].includes(sub.status),
      price = sub.items?.data?.[0]?.price?.id;
    const plan =
      active && price === process.env.STRIPE_TEAM_PRICE
        ? 'team'
        : active && price === process.env.STRIPE_PRO_PRICE
          ? 'pro'
          : 'free';
    transaction(db, () => {
      db.prepare('INSERT INTO billing_events VALUES(?,?)').run(e.id, now());
      const previous = db
        .prepare('SELECT event_created,terminal FROM billing_subscriptions WHERE subscription_id=?')
        .get(sub.id);
      const terminal = Number(
        e.type === 'customer.subscription.deleted' || sub.status === 'canceled',
      );
      if (previous && (previous.event_created > e.created || previous.terminal)) return;
      db.prepare(
        'INSERT INTO billing_subscriptions VALUES(?,?,?,?,?) ON CONFLICT(subscription_id) DO UPDATE SET plan=excluded.plan,event_created=excluded.event_created,terminal=excluded.terminal',
      ).run(sub.id, uid, plan, e.created, terminal);
      const activePlans = db
        .prepare('SELECT plan FROM billing_subscriptions WHERE user_id=?')
        .all(uid)
        .map((r) => r.plan);
      const access = activePlans.includes('team')
        ? 'team'
        : activePlans.includes('pro')
          ? 'pro'
          : 'free';
      db.prepare('UPDATE users SET plan=? WHERE id=?').run(access, uid);
      audit(db, uid, null, 'Billing plan updated', access);
    });
    res.json({ received: true });
  };
}
export function billingRoutes(api) {
  api.post('/billing/checkout', async (req, res) => {
    if (!billingReady()) fail(503, 'Checkout has not been configured. No payment has been taken.');
    if (req.user.guest) fail(403, 'Create an account before starting checkout.');
    if (req.user.plan !== 'free')
      fail(409, 'An existing subscription must be changed through your billing administrator.');
    const plan = z.enum(['pro', 'team']).parse(req.body.plan),
      params = new URLSearchParams({
        mode: 'subscription',
        success_url: process.env.APP_ORIGIN + '/settings?tab=usage',
        cancel_url: process.env.APP_ORIGIN + '/settings?tab=usage',
        customer_email: req.user.email,
        'line_items[0][price]':
          plan === 'pro' ? process.env.STRIPE_PRO_PRICE : process.env.STRIPE_TEAM_PRICE,
        'line_items[0][quantity]': '1',
        'subscription_data[metadata][atrox_user]': req.user.id,
      });
    let r;
    try {
      r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key':
            'atrox-' + req.user.id + '-' + plan + '-' + Math.floor(Date.now() / 3600000),
        },
        body: params,
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      fail(502, 'Payment provider is unreachable.');
    }
    if (!r.ok) fail(502, 'Stripe could not create a checkout session.');
    const j = await r.json();
    res.json({ url: j.url });
  });
}
