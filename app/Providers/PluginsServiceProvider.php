<?php

namespace App\Providers;

use App\Actions\Plugins\BootPlugins;
use App\Actions\Plugins\GetPluginInstance;
use App\Plugins\RegisterCommand;
use App\Plugins\RegisterViews;
use Illuminate\Support\ServiceProvider;

class PluginsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(GetPluginInstance::class, function () {
            return new GetPluginInstance;
        });
    }

    public function boot(): void
    {
        $this->app->booted(function () {
            app(BootPlugins::class)->handle();

            foreach (RegisterViews::get() as $name => $path) {
                $this->loadViewsFrom($path, $name);
            }

            if ($this->app->runningInConsole()) {
                $commands = RegisterCommand::get();
                if (count($commands) > 0) {
                    $this->commands($commands);
                }
            }
        });
    }
}
