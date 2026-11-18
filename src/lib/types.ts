export type Mode = 'Automatic' | 'Fast' | 'Balanced' | 'Advanced';
export interface Field {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date';
}
export interface Block {
  id: string;
  type: string;
  title: string;
  text: string;
  color: string;
  spacing: number;
}
export interface Page {
  id: string;
  title: string;
  fields: Field[];
  components: Block[];
}
export interface Spec {
  name: string;
  summary: string;
  kind: string;
  category: string;
  accent: string;
  theme: 'dark' | 'light';
  layout: 'sidebar' | 'top';
  density: 'compact' | 'comfortable';
  audience: string;
  roles: string[];
  features: string[];
  pages: Page[];
}
export interface Memory {
  instructions: string;
  requirements: string[];
  decisions: string[];
}
export interface Step {
  type: string;
  key: string;
  value: string;
}
export interface Execution {
  id: string;
  status: string;
  created: number;
  log: { type: string; message: string }[];
}
export interface Flow {
  id: string;
  name: string;
  trigger: string;
  enabled: boolean;
  steps: Step[];
  executions: Execution[];
}
export interface Version {
  id: string;
  number: number;
  created: number;
  label: string;
}
export interface BuildStep {
  stage: string;
  state: string;
  detail?: string;
  durationMs?: number;
}
export interface Project {
  build: BuildStep[];
  id: string;
  spec: Spec;
  files: Record<string, string>;
  versions: Version[];
  memory: Memory;
  workflows: Flow[];
  created: number;
  updated: number;
}
export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  kind: string;
  created: number;
  updated: number;
  files: number;
  versions: number;
}
export interface User {
  id: string;
  name: string;
  email: string | null;
  guest: boolean;
  plan: string;
  preferences: { mode?: Mode; instructions?: string };
}
export interface Provider {
  slug: string;
  name: string;
  description: string;
  models: string[];
  capabilities: string[];
  configured: boolean;
  verified: boolean;
  model: string;
  fallback: boolean;
}
export interface Activity {
  id: string;
  project_id: string | null;
  action: string;
  detail: string;
  created: number;
}
export interface Plan {
  name: string;
  projects: number;
  requests: number;
  price: number;
}
export interface State {
  user: User;
  projects: ProjectSummary[];
  providers: Provider[];
  activity: Activity[];
  plans: Record<string, Plan>;
  integrations: { slug: string; host?: string; site?: string }[];
  billing: boolean;
  monthly: { requests: number; tokens: number };
  usage: {
    provider: string;
    model: string;
    task: string;
    input_tokens: number | null;
    output_tokens: number | null;
    status: string;
    created: number;
  }[];
}
export interface Draft {
  spec: Spec;
  source: string;
  notes: string[];
  architecture: string[];
  stages: string[];
}
