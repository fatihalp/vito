import { Edge, Node, Position } from '@xyflow/react';

export interface WorkflowTemplateStep {
  title: string;
  category: 'server' | 'database' | 'site' | 'general' | 'service';
  description: string;
  badge?: string;
}

export interface WorkflowTemplateConfig {
  workflowName: string;
  serverProviderId?: number | string;
  plan?: string;
  region?: string;
  domain?: string;
  repository?: string;
  branch?: string;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
  phpVersion?: string;
}

export interface WorkflowTemplate {
  id: 'laravel-all-in-one' | 'laravel-microservices';
  name: string;
  label: string;
  badge: string;
  description: string;
  architecture: string;
  icon: 'server' | 'boxes';
  provider: 'hetzner';
  serverCount: number;
  steps: WorkflowTemplateStep[];
  generateNodesAndEdges: (config: WorkflowTemplateConfig) => {
    name: string;
    nodes: Node[];
    edges: Edge[];
  };
}

const SUCCESS_COLOR = 'oklch(51.1% 0.262 276.966)';

const PASSWORD_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+';

export function generatePassword(length = 18): string {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => PASSWORD_CHARS[value % PASSWORD_CHARS.length]).join('');
}

function makeEdge(sourceId: string, targetId: string): Edge {
  return {
    id: `${sourceId}-${targetId}-${SUCCESS_COLOR}`,
    source: sourceId,
    target: targetId,
    data: { status: 'success' },
    style: { stroke: SUCCESS_COLOR, strokeWidth: 2 },
    markerEnd: { type: 'arrowclosed', color: SUCCESS_COLOR },
  };
}

function chainEdges(nodeIds: string[]): Edge[] {
  return nodeIds.slice(1).map((target, index) => makeEdge(nodeIds[index], target));
}

type ResolvedConfig = Required<Omit<WorkflowTemplateConfig, 'workflowName' | 'serverProviderId'>> & {
  serverProviderId: number | string;
};

function resolveConfig(config: WorkflowTemplateConfig): ResolvedConfig {
  return {
    serverProviderId: config.serverProviderId || '__SERVER_PROVIDER_ID__',
    plan: config.plan || 'cx22',
    region: config.region || 'fsn1',
    domain: config.domain || 'app.example.com',
    repository: config.repository || 'laravel/laravel',
    branch: config.branch || 'main',
    dbName: config.dbName || 'laravel',
    dbUser: config.dbUser || 'laravel',
    dbPassword: config.dbPassword || generatePassword(),
    phpVersion: config.phpVersion || '8.3',
  };
}

interface NodeAction {
  category: 'server' | 'database' | 'site' | 'general';
  handler: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, string>;
}

function makeNode(id: string, index: number, label: string, action: NodeAction): Node {
  return {
    id,
    type: 'custom',
    position: { x: 50 + index * 350, y: 150 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      label,
      action: { id, label, starting: index === 0, ...action },
    },
  };
}

const SERVER_OUTPUTS = {
  server_id: 'The ID of the created server',
  server_name: 'The name of the created server',
  server_ip: 'The IP address of the created server',
  server_public_key: 'The public key of the created server',
  server_provider_id: 'The provider-specific ID of the created server',
  server_provider: 'The provider of the created server',
  server_status: 'The status of the created server',
};

const DATABASE_OUTPUTS = {
  server_id: 'The ID of the server where the database was created',
  database_name: 'The name of the created database',
  database_id: 'The ID of the created database',
  database_user_id: 'The ID of the created database user',
  database_user_username: 'The name of the created database user',
};

const SITE_OUTPUTS = {
  site_id: 'The ID of the created site',
  site_domain: 'The domain of the created site',
  site_path: 'The path of the created site on the server',
  site_status: 'The status of the created site',
};

const DEPLOY_OUTPUTS = {
  site_id: 'The ID of the site',
  deployment_id: 'The ID of the deployment',
  deployment_status: 'The status of the deployment',
};

const BASE_SERVICES = [
  { type: 'firewall', name: 'ufw', version: 'latest' },
  { type: 'fail2ban', name: 'fail2ban', version: 'latest' },
  { type: 'monitoring', name: 'remote-monitor', version: 'latest' },
];

function createServerAction(cfg: ResolvedConfig, name: string, role: string, services: Array<{ type: string; name: string; version: string }>): NodeAction {
  return {
    category: 'server',
    handler: 'App\\WorkflowActions\\Server\\CreateServer',
    inputs: {
      name,
      provider: 'hetzner',
      server_provider: cfg.serverProviderId,
      plan: cfg.plan,
      region: cfg.region,
      os: 'ubuntu_24',
      role,
      stage: 'prod',
      services,
    },
    outputs: SERVER_OUTPUTS,
  };
}

function createDatabaseAction(cfg: ResolvedConfig): NodeAction {
  return {
    category: 'database',
    handler: 'App\\WorkflowActions\\Database\\CreateDatabase',
    inputs: {
      server_id: '{server_id}',
      name: cfg.dbName,
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      username: cfg.dbUser,
      password: cfg.dbPassword,
    },
    outputs: DATABASE_OUTPUTS,
  };
}

function createSiteAction(cfg: ResolvedConfig): NodeAction {
  return {
    category: 'site',
    handler: 'App\\WorkflowActions\\Site\\CreateLaravelSite',
    inputs: {
      server_id: '{server_id}',
      domain: cfg.domain,
      type: 'laravel',
      php_version: cfg.phpVersion,
      repository: cfg.repository,
      branch: cfg.branch,
      web_directory: 'public',
      composer: 'true',
    },
    outputs: SITE_OUTPUTS,
  };
}

function deploySiteAction(): NodeAction {
  return {
    category: 'site',
    handler: 'App\\WorkflowActions\\Site\\DeploySite',
    inputs: {
      site_id: '{site_id}',
    },
    outputs: DEPLOY_OUTPUTS,
  };
}

function migrateAndOptimizeAction(): NodeAction {
  return {
    category: 'general',
    handler: 'App\\WorkflowActions\\General\\RunCommand',
    inputs: {
      server_id: '{server_id}',
      command: 'cd /home/vito/{site_domain} && php artisan migrate --force && php artisan optimize',
      user: 'vito',
    },
    outputs: {},
  };
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'laravel-all-in-one',
    name: 'Laravel All-in-One (Single Server)',
    label: 'Single Server (All-in-One)',
    badge: 'Monolith',
    description: 'Provisions a single Hetzner server equipped with the entire Laravel stack: Nginx, PHP 8.3, MySQL 8.4, Redis, and Supervisor.',
    architecture: 'Single Server: Web, PHP-FPM, MySQL, Redis, Queues & Cron on 1 instance.',
    icon: 'server',
    provider: 'hetzner',
    serverCount: 1,
    steps: [
      {
        title: 'Provision Hetzner Server',
        category: 'server',
        description: 'Creates Ubuntu 24.04 server with Nginx, PHP 8.3, MySQL 8.4, Redis & Supervisor',
        badge: 'cx22 / Hetzner',
      },
      {
        title: 'Create MySQL Database & User',
        category: 'database',
        description: 'Sets up isolated database with UTF8mb4 charset and dedicated user credentials',
        badge: 'MySQL 8.4',
      },
      {
        title: 'Create Laravel Site',
        category: 'site',
        description: 'Configures virtual host, Git repository, PHP version, and composer setup',
        badge: 'Laravel / PHP 8.3',
      },
      {
        title: 'Deploy Site',
        category: 'site',
        description: 'Executes zero-downtime automated deployment pulling the latest release',
        badge: 'Zero-downtime',
      },
      {
        title: 'Artisan Migrations & Optimize',
        category: 'general',
        description: 'Runs database migrations and Laravel configuration / route caching',
        badge: 'Artisan',
      },
    ],
    generateNodesAndEdges: (config) => {
      const cfg = resolveConfig(config);

      const nodes: Node[] = [
        makeNode(
          'node-1',
          0,
          'Create Server (Hetzner)',
          createServerAction(cfg, 'laravel-all-in-one', 'app', [
            { type: 'webserver', name: 'nginx', version: 'latest' },
            { type: 'php', name: 'php', version: cfg.phpVersion },
            { type: 'database', name: 'mysql', version: '8.4' },
            { type: 'memory_database', name: 'redis', version: 'latest' },
            { type: 'process_manager', name: 'supervisor', version: 'latest' },
            ...BASE_SERVICES,
          ]),
        ),
        makeNode('node-2', 1, 'Create Database & User', createDatabaseAction(cfg)),
        makeNode('node-3', 2, 'Create Laravel Site', createSiteAction(cfg)),
        makeNode('node-4', 3, 'Deploy Laravel Site', deploySiteAction()),
        makeNode('node-5', 4, 'Artisan Migrations & Optimize', migrateAndOptimizeAction()),
      ];

      return {
        name: config.workflowName || 'Laravel All-in-One Stack (Hetzner)',
        nodes,
        edges: chainEdges(nodes.map((node) => node.id)),
      };
    },
  },
  {
    id: 'laravel-microservices',
    name: 'Laravel Microservices (Multi-Server)',
    label: 'Multi-Server (Microservices)',
    badge: 'Distributed',
    description: 'Deploys a scalable multi-server architecture on Hetzner with isolated DB, Worker/Redis, and App/Web servers.',
    architecture: 'Multi-Server: Dedicated Database Server + Dedicated Queue/Cache Server + Dedicated Web/App Server.',
    icon: 'boxes',
    provider: 'hetzner',
    serverCount: 3,
    steps: [
      {
        title: 'Provision DB Server',
        category: 'server',
        description: 'Creates dedicated Database Server with MySQL 8.4 on Hetzner',
        badge: 'MySQL Server',
      },
      {
        title: 'Setup Database & User',
        category: 'database',
        description: 'Creates project database and database credentials on DB server',
        badge: 'DB Instance',
      },
      {
        title: 'Provision Queue & Cache Server',
        category: 'server',
        description: 'Creates dedicated server with Redis, PHP 8.3 & Supervisor for workers',
        badge: 'Worker Server',
      },
      {
        title: 'Provision Web / App Server',
        category: 'server',
        description: 'Creates dedicated App server with Nginx & PHP 8.3 for incoming traffic',
        badge: 'App Server',
      },
      {
        title: 'Create Laravel Site',
        category: 'site',
        description: 'Sets up virtual host, Git repository & PHP on the App server',
        badge: 'Laravel Site',
      },
      {
        title: 'Deploy Site',
        category: 'site',
        description: 'Runs automated zero-downtime deployment on the App server',
        badge: 'Deploy',
      },
      {
        title: 'Artisan Migrations & Optimize',
        category: 'general',
        description: 'Executes database migrations and optimizes config & routing',
        badge: 'Artisan',
      },
    ],
    generateNodesAndEdges: (config) => {
      const cfg = resolveConfig(config);

      const nodes: Node[] = [
        makeNode(
          'node-db-server',
          0,
          '1. Create Database Server (Hetzner)',
          createServerAction(cfg, 'laravel-db-server', 'database', [{ type: 'database', name: 'mysql', version: '8.4' }, ...BASE_SERVICES]),
        ),
        makeNode('node-db-setup', 1, '2. Setup MySQL Database & User', createDatabaseAction(cfg)),
        makeNode(
          'node-queue-server',
          2,
          '3. Create Worker & Cache Server (Hetzner)',
          createServerAction(cfg, 'laravel-worker-server', 'queue', [
            { type: 'php', name: 'php', version: cfg.phpVersion },
            { type: 'memory_database', name: 'redis', version: 'latest' },
            { type: 'process_manager', name: 'supervisor', version: 'latest' },
            ...BASE_SERVICES,
          ]),
        ),
        makeNode(
          'node-app-server',
          3,
          '4. Create Web / App Server (Hetzner)',
          createServerAction(cfg, 'laravel-web-server', 'app', [
            { type: 'webserver', name: 'nginx', version: 'latest' },
            { type: 'php', name: 'php', version: cfg.phpVersion },
            ...BASE_SERVICES,
          ]),
        ),
        makeNode('node-site-create', 4, '5. Create Laravel Site', createSiteAction(cfg)),
        makeNode('node-deploy', 5, '6. Deploy Laravel Site', deploySiteAction()),
        makeNode('node-migrations', 6, '7. Run Migrations & Optimize', migrateAndOptimizeAction()),
      ];

      return {
        name: config.workflowName || 'Laravel Microservices Stack (Hetzner)',
        nodes,
        edges: chainEdges(nodes.map((node) => node.id)),
      };
    },
  },
];
