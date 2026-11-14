<?php

namespace App\Providers;

use App\DTOs\DynamicField;
use App\DTOs\DynamicForm;
use App\Registries\RegisterSourceControl;
use App\SourceControlProviders\Github;
use App\SourceControlProviders\GithubApp;
use App\SourceControlProviders\Gitlab;
use Illuminate\Support\ServiceProvider;

class SourceControlServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        $this->github();
        $this->githubApp();
        $this->gitlab();
    }

    private function githubApp(): void
    {
        RegisterSourceControl::make(GithubApp::id())
            ->label('GitHub App')
            ->handler(GithubApp::class)
            ->connectable(false)
            ->register();
    }

    private function github(): void
    {
        RegisterSourceControl::make(Github::id())
            ->label('Github')
            ->handler(Github::class)
            ->form(
                DynamicForm::make([
                    DynamicField::make('token')
                        ->text()
                        ->label('Token'),
                ])
            )
            ->register();
    }

    private function gitlab(): void
    {
        RegisterSourceControl::make(Gitlab::id())
            ->label('Gitlab')
            ->handler(Gitlab::class)
            ->form(
                DynamicForm::make([
                    DynamicField::make('token')
                        ->text()
                        ->label('Token'),
                    DynamicField::make('url')
                        ->text()
                        ->label('Self hosted URL'),
                    DynamicField::make('ssh_port')
                        ->text()
                        ->label('SSH Port')
                        ->default(22)
                        ->placeholder('22')
                        ->description('Numeric SSH port used when cloning repositories (default: 22).'),
                ])
            )
            ->register();
    }
}
