<?php

namespace App\Actions\Worker;

enum WorkerEnvironmentUpdateResult
{
    case PreFirstDeploy;
    case PendingRestart;
    case Restarting;
}
