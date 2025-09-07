<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class ActionsServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        $this->cronJobs();
        $this->database();
        $this->firewallRule();
        $this->monitoring();
        $this->notificationChannels();
        $this->php();
        $this->projects();
        $this->redirect();
        $this->script();
        $this->server();
        $this->serverLog();
        $this->serverProvider();
        $this->service();
        $this->site();
        $this->sourceControl();
        $this->sshKey();
        $this->ssl();
        $this->storageProvider();
        $this->tag();
        $this->user();
        $this->worker();
    }

    private function cronJobs(): void
    {
        $this->app->bind(\App\Contracts\Actions\CronJob\CreateCronJob::class, \App\Actions\CronJob\CreateCronJob::class);
        $this->app->bind(\App\Contracts\Actions\CronJob\DeleteCronJob::class, \App\Actions\CronJob\DeleteCronJob::class);
        $this->app->bind(\App\Contracts\Actions\CronJob\DisableCronJob::class, \App\Actions\CronJob\DisableCronJob::class);
        $this->app->bind(\App\Contracts\Actions\CronJob\EditCronJob::class, \App\Actions\CronJob\EditCronJob::class);
        $this->app->bind(\App\Contracts\Actions\CronJob\EnableCronJob::class, \App\Actions\CronJob\EnableCronJob::class);
    }

    private function database(): void
    {
        $this->app->bind(\App\Contracts\Actions\Database\CreateDatabase::class, \App\Actions\Database\CreateDatabase::class);
        $this->app->bind(\App\Contracts\Actions\Database\CreateDatabaseUser::class, \App\Actions\Database\CreateDatabaseUser::class);
        $this->app->bind(\App\Contracts\Actions\Database\DeleteDatabase::class, \App\Actions\Database\DeleteDatabase::class);
        $this->app->bind(\App\Contracts\Actions\Database\DeleteDatabaseUser::class, \App\Actions\Database\DeleteDatabaseUser::class);
        $this->app->bind(\App\Contracts\Actions\Database\LinkUser::class, \App\Actions\Database\LinkUser::class);
        $this->app->bind(\App\Contracts\Actions\Database\ManageBackup::class, \App\Actions\Database\ManageBackup::class);
        $this->app->bind(\App\Contracts\Actions\Database\ManageBackupFile::class, \App\Actions\Database\ManageBackupFile::class);
        $this->app->bind(\App\Contracts\Actions\Database\RestoreBackup::class, \App\Actions\Database\RestoreBackup::class);
        $this->app->bind(\App\Contracts\Actions\Database\RunBackup::class, \App\Actions\Database\RunBackup::class);
        $this->app->bind(\App\Contracts\Actions\Database\SyncDatabases::class, \App\Actions\Database\SyncDatabases::class);
        $this->app->bind(\App\Contracts\Actions\Database\SyncDatabaseUsers::class, \App\Actions\Database\SyncDatabaseUsers::class);
    }

    private function firewallRule(): void
    {
        $this->app->bind(\App\Contracts\Actions\FirewallRule\ManageRule::class, \App\Actions\FirewallRule\ManageRule::class);
    }

    private function monitoring(): void
    {
        $this->app->bind(\App\Contracts\Actions\Monitoring\GetMetrics::class, \App\Actions\Monitoring\GetMetrics::class);
        $this->app->bind(\App\Contracts\Actions\Monitoring\UpdateMetricSettings::class, \App\Actions\Monitoring\UpdateMetricSettings::class);
    }

    private function notificationChannels(): void
    {
        $this->app->bind(\App\Contracts\Actions\NotificationChannels\AddChannel::class, \App\Actions\NotificationChannels\AddChannel::class);
        $this->app->bind(\App\Contracts\Actions\NotificationChannels\EditChannel::class, \App\Actions\NotificationChannels\EditChannel::class);
    }

    private function php(): void
    {
        $this->app->bind(\App\Contracts\Actions\PHP\ChangeDefaultCli::class, \App\Actions\PHP\ChangeDefaultCli::class);
        $this->app->bind(\App\Contracts\Actions\PHP\GetPHPIni::class, \App\Actions\PHP\GetPHPIni::class);
        $this->app->bind(\App\Contracts\Actions\PHP\InstallPHPExtension::class, \App\Actions\PHP\InstallPHPExtension::class);
        $this->app->bind(\App\Contracts\Actions\PHP\UpdatePHPIni::class, \App\Actions\PHP\UpdatePHPIni::class);
    }

    private function projects(): void
    {
        $this->app->bind(\App\Contracts\Actions\Projects\AddUser::class, \App\Actions\Projects\AddUser::class);
        $this->app->bind(\App\Contracts\Actions\Projects\CreateProject::class, \App\Actions\Projects\CreateProject::class);
        $this->app->bind(\App\Contracts\Actions\Projects\DeleteProject::class, \App\Actions\Projects\DeleteProject::class);
        $this->app->bind(\App\Contracts\Actions\Projects\UpdateProject::class, \App\Actions\Projects\UpdateProject::class);
    }

    private function redirect(): void
    {
        $this->app->bind(\App\Contracts\Actions\Redirect\CreateRedirect::class, \App\Actions\Redirect\CreateRedirect::class);
        $this->app->bind(\App\Contracts\Actions\Redirect\DeleteRedirect::class, \App\Actions\Redirect\DeleteRedirect::class);
    }

    private function script(): void
    {
        $this->app->bind(\App\Contracts\Actions\Script\CreateScript::class, \App\Actions\Script\CreateScript::class);
        $this->app->bind(\App\Contracts\Actions\Script\EditScript::class, \App\Actions\Script\EditScript::class);
        $this->app->bind(\App\Contracts\Actions\Script\ExecuteScript::class, \App\Actions\Script\ExecuteScript::class);
    }

    private function server(): void
    {
        $this->app->bind(\App\Contracts\Actions\Server\CheckConnection::class, \App\Actions\Server\CheckConnection::class);
        $this->app->bind(\App\Contracts\Actions\Server\CreateServer::class, \App\Actions\Server\CreateServer::class);
        $this->app->bind(\App\Contracts\Actions\Server\EditServer::class, \App\Actions\Server\EditServer::class);
        $this->app->bind(\App\Contracts\Actions\Server\InstallServer::class, \App\Actions\Server\InstallServer::class);
        $this->app->bind(\App\Contracts\Actions\Server\RebootServer::class, \App\Actions\Server\RebootServer::class);
        $this->app->bind(\App\Contracts\Actions\Server\TransferServer::class, \App\Actions\Server\TransferServer::class);
        $this->app->bind(\App\Contracts\Actions\Server\Update::class, \App\Actions\Server\Update::class);
    }

    private function serverLog(): void
    {
        $this->app->bind(\App\Contracts\Actions\ServerLog\CreateLog::class, \App\Actions\ServerLog\CreateLog::class);
        $this->app->bind(\App\Contracts\Actions\ServerLog\UpdateLog::class, \App\Actions\ServerLog\UpdateLog::class);
    }

    private function serverProvider(): void
    {
        $this->app->bind(\App\Contracts\Actions\ServerProvider\CreateServerProvider::class, \App\Actions\ServerProvider\CreateServerProvider::class);
        $this->app->bind(\App\Contracts\Actions\ServerProvider\DeleteServerProvider::class, \App\Actions\ServerProvider\DeleteServerProvider::class);
        $this->app->bind(\App\Contracts\Actions\ServerProvider\EditServerProvider::class, \App\Actions\ServerProvider\EditServerProvider::class);
    }

    private function service(): void
    {
        $this->app->bind(\App\Contracts\Actions\Service\Install::class, \App\Actions\Service\Install::class);
        $this->app->bind(\App\Contracts\Actions\Service\Manage::class, \App\Actions\Service\Manage::class);
        $this->app->bind(\App\Contracts\Actions\Service\Uninstall::class, \App\Actions\Service\Uninstall::class);
    }

    private function site(): void
    {
        $this->app->bind(\App\Contracts\Actions\Site\CreateCommand::class, \App\Actions\Site\CreateCommand::class);
        $this->app->bind(\App\Contracts\Actions\Site\CreateSite::class, \App\Actions\Site\CreateSite::class);
        $this->app->bind(\App\Contracts\Actions\Site\DeleteSite::class, \App\Actions\Site\DeleteSite::class);
        $this->app->bind(\App\Contracts\Actions\Site\Deploy::class, \App\Actions\Site\Deploy::class);
        $this->app->bind(\App\Contracts\Actions\Site\EditCommand::class, \App\Actions\Site\EditCommand::class);
        $this->app->bind(\App\Contracts\Actions\Site\ExecuteCommand::class, \App\Actions\Site\ExecuteCommand::class);
        $this->app->bind(\App\Contracts\Actions\Site\Rollback::class, \App\Actions\Site\Rollback::class);
        $this->app->bind(\App\Contracts\Actions\Site\UpdateAliases::class, \App\Actions\Site\UpdateAliases::class);
        $this->app->bind(\App\Contracts\Actions\Site\UpdateBranch::class, \App\Actions\Site\UpdateBranch::class);
        $this->app->bind(\App\Contracts\Actions\Site\UpdateDeploymentScript::class, \App\Actions\Site\UpdateDeploymentScript::class);
        $this->app->bind(\App\Contracts\Actions\Site\UpdateEnv::class, \App\Actions\Site\UpdateEnv::class);
        $this->app->bind(\App\Contracts\Actions\Site\UpdateLoadBalancer::class, \App\Actions\Site\UpdateLoadBalancer::class);
        $this->app->bind(\App\Contracts\Actions\Site\UpdatePHPVersion::class, \App\Actions\Site\UpdatePHPVersion::class);
        $this->app->bind(\App\Contracts\Actions\Site\UpdateSourceControl::class, \App\Actions\Site\UpdateSourceControl::class);
    }

    private function sourceControl(): void
    {
        $this->app->bind(\App\Contracts\Actions\SourceControl\ConnectSourceControl::class, \App\Actions\SourceControl\ConnectSourceControl::class);
        $this->app->bind(\App\Contracts\Actions\SourceControl\DeleteSourceControl::class, \App\Actions\SourceControl\DeleteSourceControl::class);
        $this->app->bind(\App\Contracts\Actions\SourceControl\EditSourceControl::class, \App\Actions\SourceControl\EditSourceControl::class);
    }

    private function sshKey(): void
    {
        $this->app->bind(\App\Contracts\Actions\SshKey\CreateSshKey::class, \App\Actions\SshKey\CreateSshKey::class);
        $this->app->bind(\App\Contracts\Actions\SshKey\DeleteKeyFromServer::class, \App\Actions\SshKey\DeleteKeyFromServer::class);
        $this->app->bind(\App\Contracts\Actions\SshKey\DeployKeyToServer::class, \App\Actions\SshKey\DeployKeyToServer::class);
    }

    private function ssl(): void
    {
        $this->app->bind(\App\Contracts\Actions\SSL\ActivateSSL::class, \App\Actions\SSL\ActivateSSL::class);
        $this->app->bind(\App\Contracts\Actions\SSL\CreateSSL::class, \App\Actions\SSL\CreateSSL::class);
        $this->app->bind(\App\Contracts\Actions\SSL\DeactivateSSL::class, \App\Actions\SSL\DeactivateSSL::class);
        $this->app->bind(\App\Contracts\Actions\SSL\DeleteSSL::class, \App\Actions\SSL\DeleteSSL::class);
    }

    private function storageProvider(): void
    {
        $this->app->bind(\App\Contracts\Actions\StorageProvider\CreateStorageProvider::class, \App\Actions\StorageProvider\CreateStorageProvider::class);
        $this->app->bind(\App\Contracts\Actions\StorageProvider\DeleteStorageProvider::class, \App\Actions\StorageProvider\DeleteStorageProvider::class);
        $this->app->bind(\App\Contracts\Actions\StorageProvider\EditStorageProvider::class, \App\Actions\StorageProvider\EditStorageProvider::class);
    }

    private function tag(): void
    {
        $this->app->bind(\App\Contracts\Actions\Tag\CreateTag::class, \App\Actions\Tag\CreateTag::class);
        $this->app->bind(\App\Contracts\Actions\Tag\DeleteTag::class, \App\Actions\Tag\DeleteTag::class);
        $this->app->bind(\App\Contracts\Actions\Tag\EditTag::class, \App\Actions\Tag\EditTag::class);
        $this->app->bind(\App\Contracts\Actions\Tag\SyncTags::class, \App\Actions\Tag\SyncTags::class);
    }

    private function user(): void
    {
        $this->app->bind(\App\Contracts\Actions\User\CreateUser::class, \App\Actions\User\CreateUser::class);
        $this->app->bind(\App\Contracts\Actions\User\ResetUserPassword::class, \App\Actions\User\ResetUserPassword::class);
        $this->app->bind(\App\Contracts\Actions\User\UpdateProjects::class, \App\Actions\User\UpdateProjects::class);
        $this->app->bind(\App\Contracts\Actions\User\UpdateUser::class, \App\Actions\User\UpdateUser::class);
        $this->app->bind(\App\Contracts\Actions\User\UpdateUserPassword::class, \App\Actions\User\UpdateUserPassword::class);
        $this->app->bind(\App\Contracts\Actions\User\UpdateUserProfileInformation::class, \App\Actions\User\UpdateUserProfileInformation::class);
    }

    private function worker(): void
    {
        $this->app->bind(\App\Contracts\Actions\Worker\CreateWorker::class, \App\Actions\Worker\CreateWorker::class);
        $this->app->bind(\App\Contracts\Actions\Worker\DeleteWorker::class, \App\Actions\Worker\DeleteWorker::class);
        $this->app->bind(\App\Contracts\Actions\Worker\EditWorker::class, \App\Actions\Worker\EditWorker::class);
        $this->app->bind(\App\Contracts\Actions\Worker\GetWorkerLogs::class, \App\Actions\Worker\GetWorkerLogs::class);
        $this->app->bind(\App\Contracts\Actions\Worker\ManageWorker::class, \App\Actions\Worker\ManageWorker::class);
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }
}
