<?php

namespace App\Actions\Site;

enum WorkerStartCommandUpdateResult
{
    case PreFirstDeploy;
    case PendingRestart;
    case Restarting;
}
