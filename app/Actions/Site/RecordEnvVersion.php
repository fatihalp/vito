<?php

namespace App\Actions\Site;

use App\Enums\EnvVersionSource;
use App\Models\EnvVersion;
use App\Models\Site;
use App\Models\User;

class RecordEnvVersion
{
    private const int KEEP = 100;

    /**
     * Records the new content of an env file. If the file was changed outside Vito since the last
     * recorded version, the live content is captured first so it can still be restored.
     */
    public function record(
        Site $site,
        string $path,
        string $previous,
        string $content,
        EnvVersionSource $source,
        ?User $user = null,
        ?EnvVersion $restoredFrom = null,
    ): void {
        $previous = trim($previous);
        $content = trim($content);
        $latest = $site->envVersions()->where('path', $path)->latest('id')->first();

        if ($previous !== '' && $latest?->content !== $previous) {
            $this->create($site, $path, $previous, EnvVersionSource::SERVER);
        }

        if ($content === $previous) {
            return;
        }

        $this->create($site, $path, $content, $source, $user, $restoredFrom);

        $keep = $site->envVersions()->where('path', $path)->latest('id')->take(self::KEEP)->pluck('id');
        $site->envVersions()->where('path', $path)->whereNotIn('id', $keep)->delete();
    }

    private function create(
        Site $site,
        string $path,
        string $content,
        EnvVersionSource $source,
        ?User $user = null,
        ?EnvVersion $restoredFrom = null,
    ): void {
        $site->envVersions()->create([
            'user_id' => $user?->id,
            'restored_from_id' => $restoredFrom?->id,
            'path' => $path,
            'content' => $content,
            'source' => $source,
        ]);
    }
}
