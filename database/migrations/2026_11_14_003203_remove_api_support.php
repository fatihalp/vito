<?php

use App\Models\Deployment;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('personal_access_tokens');

        Deployment::query()->where('trigger', 'api')->update(['trigger' => 'manual']);
    }
};
