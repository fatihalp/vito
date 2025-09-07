<?php

namespace App\Contracts\Actions\Tag;

use App\Models\Tag;

interface DeleteTag
{
    public function delete(Tag $tag): void;
}
