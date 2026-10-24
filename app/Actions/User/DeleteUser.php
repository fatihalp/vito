<?php

namespace App\Actions\User;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class DeleteUser
{
    public function delete(User $user): void
    {
        DB::transaction(function () use ($user): void {
            $user->delete();
        });
    }
}
