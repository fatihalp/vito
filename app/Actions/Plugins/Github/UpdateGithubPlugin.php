<?php

namespace App\Actions\Plugins\Github;

use App\Models\Plugin;
use Exception;

final readonly class UpdateGithubPlugin
{
    public function __construct(
        private InstallGithubPlugin $installPlugin,
    ) {}

    
    public function handle(Plugin $plugin): void
    {
        $this->installPlugin->handle($plugin->repo, $plugin);
    }
}
