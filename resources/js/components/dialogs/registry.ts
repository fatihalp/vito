import { lazy } from 'react';
import type { ComponentType } from 'react';
import LogViewerDialog from './log-viewer-dialog';
import ConfirmationDialog from './confirmation-dialog';
const StorageProviderEditDialog = lazy(() => import('@/pages/storage-providers/components/edit-dialog'));
const PluginLogsDialog = lazy(() => import('@/pages/plugins/components/logs-dialog'));
const WorkerLogsDialog = lazy(() => import('@/pages/workers/components/logs-dialog'));
const WorkerEnvDialog = lazy(() => import('@/pages/workers/components/env-dialog'));
const CronJobForm = lazy(() => import('@/pages/cronjobs/components/form'));
const WorkerForm = lazy(() => import('@/pages/workers/components/form'));
const ActivateServerSslDialog = lazy(() => import('@/pages/server-ssls/components/activate-dialog'));
const SourceControlEditDialog = lazy(() => import('@/pages/source-controls/components/edit-dialog'));
const DataRetentionDialog = lazy(() => import('@/pages/monitoring/components/data-retention-dialog'));
const EditDatabaseUserDialog = lazy(() => import('@/pages/database-users/components/edit-database-user'));
const LinkDatabaseUserDialog = lazy(() => import('@/pages/database-users/components/link-dialog'));
const PhpExtensionsDialog = lazy(() => import('@/pages/services/components/php-extensions-dialog'));
const PhpIniDialog = lazy(() => import('@/pages/services/components/php-ini-dialog'));
const ServerProviderEditDialog = lazy(() => import('@/pages/server-providers/components/edit-dialog'));
const DnsProviderEditDialog = lazy(() => import('@/pages/dns-providers/components/edit-dialog'));
const NotificationChannelEditDialog = lazy(() => import('@/pages/notification-channels/components/edit-dialog'));
const ServiceConfigFileDialog = lazy(() => import('@/pages/services/components/config-file-dialog'));
const ServiceNetworkingDialog = lazy(() => import('@/pages/services/components/networking-dialog'));
const CreateHostedDomain = lazy(() => import('@/pages/hosted-domains/components/create-hosted-domain'));
const EditHostedDomain = lazy(() => import('@/pages/hosted-domains/components/edit-hosted-domain'));
const FirewallRuleForm = lazy(() => import('@/pages/firewall/components/form'));
const ServerIpForm = lazy(() => import('@/pages/server-network/components/form'));
const RecordForm = lazy(() => import('@/pages/domains/components/record-form'));
const EditCommand = lazy(() => import('@/pages/commands/components/edit-command'));
const CreateCommand = lazy(() => import('@/pages/commands/components/create-command'));
const ExecuteCommand = lazy(() => import('@/pages/commands/components/execute'));
const EditRedirect = lazy(() => import('@/pages/redirects/components/edit-redirect'));
const CreateBackup = lazy(() => import('@/pages/backups/components/create-backup'));
const EditBackup = lazy(() => import('@/pages/backups/components/edit-backup'));
const RestoreBackup = lazy(() => import('@/pages/backups/components/restore-backup'));
const SiteFeatureAction = lazy(() => import('@/pages/site-features/components/feature-action'));
const ServerFeatureAction = lazy(() => import('@/pages/server-features/components/feature-action'));
const Fail2banForm = lazy(() => import('@/pages/security/components/fail2ban-form'));
const PhpSettingsDialog = lazy(() => import('@/pages/site-settings/components/php-settings-dialog'));
const CreateNetwork = lazy(() => import('@/pages/networks/components/create-network'));
const AddNetworkServer = lazy(() => import('@/pages/networks/components/add-server'));
const EditNetworkServer = lazy(() => import('@/pages/networks/components/edit-network-server'));
const NetworkFirewallRuleForm = lazy(() => import('@/pages/networks/components/firewall-rule-form'));
const AddNetworkPeer = lazy(() => import('@/pages/networks/components/add-peer'));
const PeerConfigDialog = lazy(() => import('@/pages/networks/components/peer-config'));
const ImportWorkflow = lazy(() => import('@/pages/workflows/components/import-workflow'));
const WorkflowTemplatesDialog = lazy(() => import('@/pages/workflows/components/templates-dialog'));
const RevealSiteResourceDialog = lazy(() => import('@/pages/site-resources/components/reveal-site-resource-dialog'));
const InviteProjectUser = lazy(() => import('@/pages/projects/components/invite'));
const ProjectUsers = lazy(() => import('@/pages/projects/components/users'));

export type DialogControlProps = { open: boolean; onOpenChange: (open: boolean) => void };


export const dialogs = {
  logViewer: LogViewerDialog,
  confirm: ConfirmationDialog,
  storageProviderEdit: StorageProviderEditDialog,
  pluginLogs: PluginLogsDialog,
  workerLogs: WorkerLogsDialog,
  workerEnv: WorkerEnvDialog,
  cronjobForm: CronJobForm,
  workerForm: WorkerForm,
  activateServerSsl: ActivateServerSslDialog,
  sourceControlEdit: SourceControlEditDialog,
  dataRetention: DataRetentionDialog,
  databaseUserEdit: EditDatabaseUserDialog,
  databaseUserLink: LinkDatabaseUserDialog,
  phpExtensions: PhpExtensionsDialog,
  phpIni: PhpIniDialog,
  serverProviderEdit: ServerProviderEditDialog,
  dnsProviderEdit: DnsProviderEditDialog,
  notificationChannelEdit: NotificationChannelEditDialog,
  serviceConfigFile: ServiceConfigFileDialog,
  serviceNetworking: ServiceNetworkingDialog,
  createHostedDomain: CreateHostedDomain,
  editHostedDomain: EditHostedDomain,
  firewallForm: FirewallRuleForm,
  serverIpForm: ServerIpForm,
  dnsRecordForm: RecordForm,
  commandEdit: EditCommand,
  commandCreate: CreateCommand,
  commandExecute: ExecuteCommand,
  redirectEdit: EditRedirect,
  backupCreate: CreateBackup,
  backupEdit: EditBackup,
  backupRestore: RestoreBackup,
  siteFeatureAction: SiteFeatureAction,
  serverFeatureAction: ServerFeatureAction,
  fail2banForm: Fail2banForm,
  phpSettings: PhpSettingsDialog,
  networkCreate: CreateNetwork,
  networkAddServer: AddNetworkServer,
  networkEditServer: EditNetworkServer,
  networkFirewallForm: NetworkFirewallRuleForm,
  networkAddPeer: AddNetworkPeer,
  networkPeerConfig: PeerConfigDialog,
  workflowImport: ImportWorkflow,
  workflowTemplates: WorkflowTemplatesDialog,
  projectInvite: InviteProjectUser,
  projectUsers: ProjectUsers,
  siteResourceReveal: RevealSiteResourceDialog,
  
} as const satisfies Record<string, ComponentType<any>>;

export type DialogRegistry = typeof dialogs;

export type ConsumerProps<C> = C extends ComponentType<infer P> ? Omit<P, keyof DialogControlProps> : never;
