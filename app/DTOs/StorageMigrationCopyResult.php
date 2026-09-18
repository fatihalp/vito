<?php

namespace App\DTOs;

final class StorageMigrationCopyResult
{
    public function __construct(
        public int $bytes,
        public string $checksum,
    ) {}
}
