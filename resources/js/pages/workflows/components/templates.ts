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
      const serverProviderId = config.serverProviderId || '__SERVER_PROVIDER_ID__';
      const plan = config.plan || 'cx22';
      const region = config.region || 'fsn1';
      const domain = config.domain || 'app.example.com';
      const repository = config.repository || 'laravel/laravel';
      const branch = config.branch || 'main';
      const dbName = config.dbName || 'laravel';
      const dbUser = config.dbUser || 'laravel';
      const dbPassword = config.dbPassword || 'secret_db_pass_' + Math.random().toString(36).substring(2, 10);
      const phpVersion = config.phpVersion || '8.3';

      const nodes: Node[] = [
        {
          id: 'node-1',
          type: 'custom',
          position: { x: 50, y: 150 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: {
            label: 'Create Server (Hetzner)',
            action: {
              id: 'node-1',
              label: 'Create Server (Hetzner)',
              starting: true,
              category: 'server',
              handler: 'App\\WorkflowActions\\Server\\CreateServer',
              inputs: {
                name: 'laravel-all-in-one',
                provider: 'hetzner',
                server_provider: serverProviderId,
                plan: plan,
                region: region,
                os: 'ubuntu_24',
                role: 'app',
                stage: 'prod',
                services: [
                  { type: 'webserver', name: 'nginx', version: 'latest' },
                  { type: 'php', name: 'php', version: phpVersion },
                  { type: 'database', name: 'mysql', version: '8.4' },
                  { type: 'memory_database', name: 'redis', version: 'latest' },
                  { type: 'process_manager', name: 'supervisor', version: 'latest' },
                  { type: 'firewall', name: 'ufw', version: 'latest' },
                  { type: 'fail2ban', name: 'fail2ban', version: 'latest' },
                  { type: 'monitoring', name: 'remote-monitor', version: 'latest' },
                ],
              },
              outputs: {
                server_id: 'The ID of the created server',
                server_name: 'The name of the created server',
                server_ip: 'The IP address of the created server',
                server_public_key: 'The public key of the created server',
                server_provider_id: 'The provider-specific ID of the created server',
                server_provider: 'The provider of the created server',
                server_status: 'The status of the created server',
              },
            },
          },
        },
        {
          id: 'node-2',
          type: 'custom',
          position: { x: 400, y: 150 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: {
            label: 'Create Database & User',
            action: {
              id: 'node-2',
              label: 'Create Database & User',
              starting: false,
              category: 'database',
              handler: 'App\\WorkflowActions\\Database\\CreateDatabase',
              inputs: {
                server_id: '{server_id}',
                name: dbName,
                charset: 'utf8mb4',
                collation: 'utf8mb4_unicode_ci',
                username: dbUser,
                password: dbPassword,
              },
              outputs: {
                server_id: 'The ID of the server where the database was created',
                database_name: 'The name of the created database',
                database_id: 'The ID of the created database',
                database_user_id: 'The ID of the created database user',
                database_user_username: 'The name of the created database user',
              },
            },
          },
        },
        {
          id: 'node-3',
          type: 'custom',
          position: { x: 750, y: 150 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: {
            label: 'Create Laravel Site',
            action: {
              id: 'node-3',
              label: 'Create Laravel Site',
              starting: false,
              category: 'site',
              handler: 'App\\WorkflowActions\\Site\\CreateLaravelSite',
              inputs: {
                server_id: '{server_id}',
                domain: domain,
                type: 'laravel',
                php_version: phpVersion,
                repository: repository,
                branch: branch,
                web_directory: 'public',
                composer: 'true',
              },
              outputs: {
                site_id: 'The ID of the created site',
                site_domain: 'The domain of the created site',
                site_path: 'The path of the created site on the server',
                site_status: 'The status of the created site',
              },
            },
          },
        },
        {
          id: 'node-4',
          type: 'custom',
          position: { x: 1100, y: 150 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: {
            label: 'Deploy Laravel Site',
            action: {
              id: 'node-4',
              label: 'Deploy Laravel Site',
              starting: false,
              category: 'site',
              handler: 'App\\WorkflowActions\\Site\\DeploySite',
              inputs: {
                site_id: '{site_id}',
              },
              outputs: {
                site_id: 'The ID of the site',
                deployment_id: 'The ID of the deployment',
                deployment_status: 'The status of the deployment',
              },
            },
          },
        },
        {
          id: 'node-5',
          type: 'custom',
          position: { x: 1450, y: 150 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: {
            label: 'Artisan Migrations & Optimize',
            action: {
              id: 'node-5',
              label: 'Artisan Migrations & Optimize',
              starting: false,
              category: 'general',
              handler: 'App\\WorkflowActions\\General\\RunCommand',
              inputs: {
                server_id: '{server_id}',
                command: 'cd /home/vito/{site_domain} && php artisan migrate --force && php artisan optimize',
                user: 'vito',
              },
              outputs: {},
            },
          },
        },
      ];

      const edges: Edge[] = [makeEdge('node-1', 'node-2'), makeEdge('node-2', 'node-3'), makeEdge('node-3', 'node-4'), makeEdge('node-4', 'node-5')];

      return {
        name: config.workflowName || 'Laravel All-in-One Stack (Hetzner)',
        nodes,
        edges,
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
      const serverProviderId = config.serverProviderId || '__SERVER_PROVIDER_ID__';
      const plan = config.plan || 'cx22';
      const region = config.region || 'fsn1';
      const domain = config.domain || 'app.example.com';
      const repository = config.repository || 'laravel/laravel';
      const branch = config.branch || 'main';
      const dbName = config.dbName || 'laravel';
      const dbUser = config.dbUser || 'laravel';
      const dbPassword = config.dbPassword || 'secret_db_pass_' + Math.random().toString(36).substring(2, 10);
      const phpVersion = config.phpVersion || '8.3';

      const nodes: Node[] = [
        {
          id: 'node-db-server',
          type: 'custom',
          position: { x: 50, y: 150 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: {
            label: '1. Create Database Server (Hetzner)',
            action: {
              id: 'node-db-server',
              label: '1. Create Database Server (Hetzner)',
              starting: true,
              category: 'server',
              handler: 'App\\WorkflowActions\\Server\\CreateServer',
              inputs: {
                name: 'laravel-db-server',
                provider: 'hetzner',
                server_provider: serverProviderId,
                plan: plan,
                region: region,
                os: 'ubuntu_24',
                role: 'database',
                stage: 'prod',
                services: [
                  { type: 'database', name: 'mysql', version: '8.4' },
                  { type: 'firewall', name: 'ufw', version: 'latest' },
                  { type: 'fail2ban', name: 'fail2ban', version: 'latest' },
                  { type: 'monitoring', name: 'remote-monitor', version: 'latest' },
                ],
              },
              outputs: {
                server_id: 'The ID of the created server',
                server_name: 'The name of the created server',
                server_ip: 'The IP address of the created server',
                server_public_key: 'The public key of the created server',
                server_provider_id: 'The provider-specific ID of the created server',
                server_provider: 'The provider of the created server',
                server_status: 'The status of the created server',
              },
            },
          },
        },
        {
          id: 'node-db-setup',
          type: 'custom',
          position: { x: 400, y: 150 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: {
            label: '2. Setup MySQL Database & User',
            action: {
              id: 'node-db-setup',
              label: '2. Setup MySQL Database & User',
              starting: false,
              category: 'database',
              handler: 'App\\WorkflowActions\\Database\\CreateDatabase',
              inputs: {
                server_id: '{server_id}',
                name: dbName,
                charset: 'utf8mb4',
                collation: 'utf8mb4_unicode_ci',
                username: dbUser,
                password: dbPassword,
              },
              outputs: {
                server_id: 'The ID of the server where the database was created',
                database_name: 'The name of the created database',
                database_id: 'The ID of the created database',
                database_user_id: 'The ID of the created database user',
                database_user_username: 'The name of the created database user',
              },
            },
          },
        },
        {
          id: 'node-queue-server',
          type: 'custom',
          position: { x: 750, y: 150 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: {
            label: '3. Create Worker & Cache Server (Hetzner)',
            action: {
              id: 'node-queue-server',
              label: '3. Create Worker & Cache Server (Hetzner)',
              starting: false,
              category: 'server',
              handler: 'App\\WorkflowActions\\Server\\CreateServer',
              inputs: {
                name: 'laravel-worker-server',
                provider: 'hetzner',
                server_provider: serverProviderId,
                plan: plan,
                region: region,
                os: 'ubuntu_24',
                role: 'queue',
                stage: 'prod',
                services: [
                  { type: 'php', name: 'php', version: phpVersion },
                  { type: 'memory_database', name: 'redis', version: 'latest' },
                  { type: 'process_manager', name: 'supervisor', version: 'latest' },
                  { type: 'firewall', name: 'ufw', version: 'latest' },
                  { type: 'fail2ban', name: 'fail2ban', version: 'latest' },
                  { type: 'monitoring', name: 'remote-monitor', version: 'latest' },
                ],
              },
              outputs: {
                server_id: 'The ID of the created server',
                server_name: 'The name of the created server',
                server_ip: 'The IP address of the created server',
                server_public_key: 'The public key of the created server',
                server_provider_id: 'The provider-specific ID of the created server',
                server_provider: 'The provider of the created server',
                server_status: 'The status of the created server',
              },
            },
          },
        },
        {
          id: 'node-app-server',
          type: 'custom',
          position: { x: 1100, y: 150 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: {
            label: '4. Create Web / App Server (Hetzner)',
            action: {
              id: 'node-app-server',
              label: '4. Create Web / App Server (Hetzner)',
              starting: false,
              category: 'server',
              handler: 'App\\WorkflowActions\\Server\\CreateServer',
              inputs: {
                name: 'laravel-web-server',
                provider: 'hetzner',
                server_provider: serverProviderId,
                plan: plan,
                region: region,
                os: 'ubuntu_24',
                role: 'app',
                stage: 'prod',
                services: [
                  { type: 'webserver', name: 'nginx', version: 'latest' },
                  { type: 'php', name: 'php', version: phpVersion },
                  { type: 'firewall', name: 'ufw', version: 'latest' },
                  { type: 'fail2ban', name: 'fail2ban', version: 'latest' },
                  { type: 'monitoring', name: 'remote-monitor', version: 'latest' },
                ],
              },
              outputs: {
                server_id: 'The ID of the created server',
                server_name: 'The name of the created server',
                server_ip: 'The IP address of the created server',
                server_public_key: 'The public key of the created server',
                server_provider_id: 'The provider-specific ID of the created server',
                server_provider: 'The provider of the created server',
                server_status: 'The status of the created server',
              },
            },
          },
        },
        {
          id: 'node-site-create',
          type: 'custom',
          position: { x: 1450, y: 150 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: {
            label: '5. Create Laravel Site',
            action: {
              id: 'node-site-create',
              label: '5. Create Laravel Site',
              starting: false,
              category: 'site',
              handler: 'App\\WorkflowActions\\Site\\CreateLaravelSite',
              inputs: {
                server_id: '{server_id}',
                domain: domain,
                type: 'laravel',
                php_version: phpVersion,
                repository: repository,
                branch: branch,
                web_directory: 'public',
                composer: 'true',
              },
              outputs: {
                site_id: 'The ID of the created site',
                site_domain: 'The domain of the created site',
                site_path: 'The path of the created site on the server',
                site_status: 'The status of the created site',
              },
            },
          },
        },
        {
          id: 'node-deploy',
          type: 'custom',
          position: { x: 1800, y: 150 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: {
            label: '6. Deploy Laravel Site',
            action: {
              id: 'node-deploy',
              label: '6. Deploy Laravel Site',
              starting: false,
              category: 'site',
              handler: 'App\\WorkflowActions\\Site\\DeploySite',
              inputs: {
                site_id: '{site_id}',
              },
              outputs: {
                site_id: 'The ID of the site',
                deployment_id: 'The ID of the deployment',
                deployment_status: 'The status of the deployment',
              },
            },
          },
        },
        {
          id: 'node-migrations',
          type: 'custom',
          position: { x: 2150, y: 150 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: {
            label: '7. Run Migrations & Optimize',
            action: {
              id: 'node-migrations',
              label: '7. Run Migrations & Optimize',
              starting: false,
              category: 'general',
              handler: 'App\\WorkflowActions\\General\\RunCommand',
              inputs: {
                server_id: '{server_id}',
                command: 'cd /home/vito/{site_domain} && php artisan migrate --force && php artisan optimize',
                user: 'vito',
              },
              outputs: {},
            },
          },
        },
      ];

      const edges: Edge[] = [
        makeEdge('node-db-server', 'node-db-setup'),
        makeEdge('node-db-setup', 'node-queue-server'),
        makeEdge('node-queue-server', 'node-app-server'),
        makeEdge('node-app-server', 'node-site-create'),
        makeEdge('node-site-create', 'node-deploy'),
        makeEdge('node-deploy', 'node-migrations'),
      ];

      return {
        name: config.workflowName || 'Laravel Microservices Stack (Hetzner)',
        nodes,
        edges,
      };
    },
  },
];
