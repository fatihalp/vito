<?php

namespace App\Console\Commands;

use App\Actions\User\CreateUser;
use App\Models\User;
use Illuminate\Console\Command;

class CreateUserCommand extends Command
{
    protected $signature = 'user:create {name} {email} {password} {--role=admin}';

    protected $description = 'Create a new user';

    public function handle(): void
    {
        $user = User::query()->where('email', $this->argument('email'))->first();

        if ($user) {
            $this->warn('User already exists. Skipping...');

            return;
        }

        $user = app(CreateUser::class)->create([
            'name' => $this->argument('name'),
            'email' => $this->argument('email'),
            'password' => $this->argument('password'),
            'role' => $this->option('role'),
            'must_change_password' => false,
        ]);

        $user->ensureHasDefaultProject();

        app(\App\Actions\Server\EnsureSelfServerExists::class)->ensure($user);

        $this->info('User created!');
    }
}
