// The local engine compiles a bounded, editable application specification, not free-form code.
export const catalog = [
  {
    kind: 'crm',
    name: 'Orbit CRM',
    category: 'CRM',
    description: 'A connected workspace for customers and relationships.',
    prompt:
      'Build a customer management system with a searchable contact directory and deal tracking.',
    accent: '#A18AFA',
    pages: [
      ['Contacts', 'Name', 'Email', 'Company', 'Status'],
      ['Deals', 'Name', 'Company', 'Value', 'Stage'],
    ],
    samples: [
      ['Alex Chen', 'alex@example.test', 'North Studio', 'Active'],
      ['Maya Santos', 'maya@example.test', 'Mesa Labs', 'Lead'],
      ['Sam Rivera', 'sam@example.test', 'Studio Form', 'Active'],
    ],
  },
  {
    kind: 'inventory',
    name: 'Stockroom',
    category: 'Inventory',
    description: 'Inventory tracking and stock management.',
    prompt: 'Design an inventory management application with products, stock levels and suppliers.',
    accent: '#55B9CE',
    pages: [
      ['Products', 'Product', 'SKU', 'Quantity', 'Category'],
      ['Suppliers', 'Name', 'Email', 'Location', 'Status'],
    ],
    samples: [
      ['Studio Keyboard', 'KB-104', '24', 'Accessories'],
      ['Monitor Arm', 'MA-206', '12', 'Equipment'],
      ['Desk Lamp', 'DL-105', '36', 'Lighting'],
    ],
  },
  {
    kind: 'analytics',
    name: 'Signal Analytics',
    category: 'Analytics',
    description: 'An interactive dashboard for business metrics.',
    prompt: 'Build an interactive data dashboard to track business metrics and monthly reports.',
    accent: '#EBA45C',
    pages: [
      ['Metrics', 'Metric', 'Value', 'Period', 'Category'],
      ['Reports', 'Title', 'Owner', 'Status', 'Date'],
    ],
    samples: [
      ['New signups', '128', 'November', 'Growth'],
      ['Active users', '342', 'November', 'Engagement'],
      ['Subscriptions', '86', 'November', 'Revenue'],
    ],
  },
  {
    kind: 'learning',
    name: 'Campus Studio',
    category: 'Education',
    description: 'Organize courses, learners and enrollment.',
    prompt: 'Create an online learning platform to manage courses and student enrollment.',
    accent: '#739FE3',
    pages: [
      ['Courses', 'Title', 'Instructor', 'Duration', 'Status'],
      ['Students', 'Name', 'Email', 'Course', 'Progress'],
    ],
    samples: [],
  },
  {
    kind: 'workflow',
    name: 'Relay Operations',
    category: 'Automation',
    description: 'Coordinate tasks and automate repeatable work.',
    prompt: 'Create an automated workflow for onboarding tasks and team requests.',
    accent: '#78B98C',
    pages: [
      ['Tasks', 'Task', 'Owner', 'Priority', 'Status'],
      ['Requests', 'Title', 'Requester', 'Date', 'Status'],
    ],
    samples: [],
  },
  {
    kind: 'commerce',
    name: 'Counter Commerce',
    category: 'Commerce',
    description: 'Manage orders, products and customer information.',
    prompt: 'I need a platform to manage my online business, customers, inventory and orders.',
    accent: '#D583A5',
    pages: [
      ['Orders', 'Order', 'Customer', 'Amount', 'Status'],
      ['Products', 'Name', 'Price', 'Quantity', 'Category'],
      ['Customers', 'Name', 'Email', 'Location', 'Status'],
    ],
    samples: [],
  },
];
export const componentTypes = [
  'header',
  'cards',
  'table',
  'chart',
  'form',
  'button',
  'input',
  'navigation',
  'modal',
  'sidebar',
  'footer',
];
export const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/^(?=\d)/, 'item-')
    .slice(0, 40) || 'records';
export const pretty = (s) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export function pageFrom(title, labels = ['Name', 'Description', 'Status']) {
  return {
    id: slug(title),
    title,
    fields: labels.map((label) => ({
      key: slug(label),
      label,
      type: /email/i.test(label)
        ? 'email'
        : /^(value|price|quantity|amount|stock|revenue|cost|count|total)$/i.test(label)
          ? 'number'
          : label === 'Date'
            ? 'date'
            : 'text',
    })),
    components: ['header', 'cards', 'table'].map((type, i) => ({
      id: `${type}-${i}`,
      type,
      title: type === 'header' ? title : type === 'cards' ? 'Overview' : 'Records',
      text: '',
      color: '',
      spacing: 16,
    })),
  };
}
export const modes = ['Automatic', 'Fast', 'Balanced', 'Advanced'];
export function classify(text) {
  const q = text.toLowerCase();
  if (/online business|commerce|storefront|\borders?\b/.test(q)) return 'commerce';
  if (/inventor|stock|supplier|products?/.test(q)) return 'inventory';
  if (/analytic|dashboard|metric|reporting/.test(q)) return 'analytics';
  if (/crm|customers?|contacts?|deals?/.test(q)) return 'crm';
  if (/learn|course|student|school/.test(q)) return 'learning';
  if (/workflow|tasks?|automat|onboard|kanban/.test(q)) return 'workflow';
  return 'custom';
}
// Explicit field and collection lists let the local compiler go beyond the starter catalog.
function namesInList(expression) {
  return [
    ...new Set(
      expression
        .split(/,|\s+and\s+/i)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12),
    ),
  ]
    .filter((s) => /^[a-zA-Z][a-zA-Z\d -]{0,35}$/.test(s))
    .map(pretty);
}
export function localSpec(prompt, template) {
  const kind = template || classify(prompt),
    t = catalog.find((x) => x.kind === kind);
  const words = prompt
    .replace(
      /^(?:please\s+)?(?:build|create|design|generate|make|i (?:want|need))\s+(?:me\s+)?(?:an?\s+)?/i,
      '',
    )
    .split(/\s+(?:with|for|that|to manage|and include|called|named)\b|[.?!;\n]/i)[0]
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(' ');
  const named =
    prompt.match(/(?:called|named)\s+["“]([^"”]{1,70})["”]/i)?.[1] ||
    prompt
      .match(/(?:called|named)\s+([a-zA-Z\w -]{1,65})/i)?.[1]
      ?.split(/\s+(?:with|for|that|including)\b/i)[0]
      ?.trim();
  const name = named || t?.name || pretty(words || 'Custom workspace');
  const pages = (
    t?.pages || [[pretty(words || 'Records').slice(0, 36), 'Name', 'Description', 'Status']]
  ).map(([n, ...f]) => pageFrom(n, f));
  const explicit = prompt.match(
    /(?:fields?|columns?)\s*(?::|are\b|including\b|include\b)\s*([^.;!\n]{2,220})/i,
  )?.[1];
  if (explicit) {
    const names = namesInList(explicit);
    if (names.length) pages[0].fields = pageFrom(pages[0].title, names).fields;
  }
  const more = prompt.match(/(?:pages|collections)\s*:\s*([^.;!\n]{2,160})/i)?.[1];
  if (more)
    for (const title of namesInList(more)) {
      if (!pages.some((p) => p.id === slug(title)) && pages.length < 12)
        pages.push(pageFrom(title));
    }
  if (
    (kind === 'analytics' || /include (?:a )?(?:chart|graph)/i.test(prompt)) &&
    !pages[0].components.some((c) => c.type === 'chart')
  )
    pages[0].components.splice(2, 0, {
      id: 'chart-1',
      type: 'chart',
      title: 'Data breakdown',
      text: '',
      color: '',
      spacing: 16,
    });
  const audience =
    prompt.match(/(?:audience|intended users?)\s*:\s*([^.;!\n]{2,90})/i)?.[1]?.trim() ||
    'Workspace members';
  return {
    name,
    summary: prompt.slice(0, 1800),
    kind: t?.kind || 'custom',
    category: t?.category || 'Application',
    accent: prompt.match(/#[a-f0-9]{6}\b/i)?.[0] || t?.accent || '#E32636',
    theme: /dark (?:mode|theme)/i.test(prompt) ? 'dark' : 'light',
    layout: /top (?:bar|navigation|menu)/i.test(prompt) ? 'top' : 'sidebar',
    density: /compact|minimal/i.test(prompt) ? 'compact' : 'comfortable',
    audience,
    roles: ['Workspace owner'],
    features: [
      'Searchable records',
      'Create, edit and delete entries',
      'Responsive navigation',
      ...(pages.some((p) => p.components.some((c) => c.type === 'chart'))
        ? ['Data visualization']
        : []),
    ],
    pages,
  };
}
