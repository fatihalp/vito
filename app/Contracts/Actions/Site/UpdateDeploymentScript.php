<?php

namespace App\Contracts\Actions\Site;

use App\Models\DeploymentScript;

interface UpdateDeploymentScript
{
    public function update(DeploymentScript $deploymentScript, array $input): void;
}
