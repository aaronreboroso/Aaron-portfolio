-- Retain provider event ordering independently for each subscription.
CREATE TABLE billing_subscriptions(
  subscription_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users ON DELETE CASCADE,
  plan TEXT NOT NULL,
  event_created INTEGER NOT NULL,
  terminal INTEGER NOT NULL DEFAULT 0
);
