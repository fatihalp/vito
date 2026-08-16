<?php

namespace App\Providers;

use App\DNSProviders\Cloudflare;
use App\DTOs\DynamicField;
use App\DTOs\DynamicForm;
use App\Plugins\RegisterDNSProvider;
use Illuminate\Support\ServiceProvider;

class DNSProviderServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        $this->cloudflare();
    }

    private function cloudflare(): void
    {
        RegisterDNSProvider::make(Cloudflare::id())
            ->label('Cloudflare')
            ->handler(Cloudflare::class)
            ->form(
                DynamicForm::make([
                    DynamicField::make('info')
                        ->alert()
                        ->label('How to create your Cloudflare API Token')
                        ->description("1. Open Cloudflare Dashboard → My Profile → API Tokens.\n2. Click \"Create Token\" → \"Create Custom Token\" (Get started).\n3. Under Permissions, configure:\n   • Zone — Zone — Read\n   • Zone — DNS — Edit\n4. Under Zone Resources, select \"Include — All zones\" (or specific zones).\n5. Click \"Continue to summary\" → \"Create Token\" and copy your token.")
                        ->link('Open Cloudflare API Tokens', 'https://dash.cloudflare.com/profile/api-tokens'),
                    DynamicField::make('token')
                        ->text()
                        ->label('API Token')
                        ->placeholder('Paste your Cloudflare API token')
                        ->description('API Token with Zone:Read and DNS:Edit permissions'),
                ])
            )
            ->editForm(
                DynamicForm::make([
                    DynamicField::make('token')
                        ->passwordWithToggle()
                        ->label('API Token')
                        ->description('Leave empty to keep the current token'),
                ])
            )
            ->proxyTypes(['A', 'AAAA', 'CNAME'])
            ->supportsCreatedAt(true)
            ->register();
    }
}
