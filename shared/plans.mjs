// Deployment-owned plan definitions. Keep Stripe recurring prices in sync.
export const plans = {
  free: { name: 'Free', projects: 10, requests: 100, price: 0 },
  pro: { name: 'Pro', projects: 50, requests: 1500, price: 19 },
  team: { name: 'Team', projects: 200, requests: 5000, price: 49 },
};
