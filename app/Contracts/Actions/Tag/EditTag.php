<?php

namespace App\Contracts\Actions\Tag;

use App\Models\Tag;

interface EditTag
{
    public function edit(Tag $tag, array $input): void;
}
