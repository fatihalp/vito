<?php

namespace App\Contracts\Actions\Tag;

interface SyncTags
{
    public function sync(int $projectId, array $input): void;
}
