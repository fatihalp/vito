<?php

namespace App\Actions\Tag;

use App\Contracts\Actions\Tag\DeleteTag as DeleteTagContract;
use App\Models\Tag;
use Illuminate\Support\Facades\DB;

class DeleteTag implements DeleteTagContract
{
    public function delete(Tag $tag): void
    {
        DB::table('taggables')->where('tag_id', $tag->id)->delete();
        $tag->delete();
    }
}
