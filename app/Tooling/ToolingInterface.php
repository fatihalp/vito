<?php

namespace App\Tooling;

use App\Exceptions\SSHError;
use App\Models\Site;

interface ToolingInterface
{
    public static function id(): string;

    public static function label(): string;

    public static function description(): string;

    
    public static function supportedVersions(): array;

    
    public static function supportedVersionsWithNone(): array;

    public static function typeDataKey(): string;

    
    public function install(Site $site, string $version): void;

    
    public function uninstall(Site $site): void;

    public function installedVersion(Site $site): ?string;

    
    public function pathContributions(Site $site): array;

    
    public static function commands(): array;
}
