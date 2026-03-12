<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class FrankenPHPTest extends TestCase
{
    use RefreshDatabase;

    public function test_generate_caddyfile_without_ssl(): void
    {
        config([
            'core.vito_ssl' => false,
            'core.vito_port' => 54331,
            'core.ws_port' => 54332,
        ]);

        $this->artisan('vito:generate-caddyfile')
            ->assertSuccessful()
            ->expectsOutput('Caddyfile generated successfully.');

        $caddyfile = File::get(base_path('Caddyfile'));

        $this->assertStringContainsString('auto_https off', $caddyfile);
        $this->assertStringContainsString(':54331', $caddyfile);
        $this->assertStringContainsString('php_server', $caddyfile);
        $this->assertStringContainsString('reverse_proxy /ws/*', $caddyfile);
    }

    public function test_generate_caddyfile_with_ssl(): void
    {
        config([
            'core.vito_ssl' => true,
            'core.vito_domain' => 'vito.example.com',
            'core.vito_port' => 54331,
            'core.ws_port' => 54332,
        ]);

        $this->artisan('vito:generate-caddyfile')
            ->assertSuccessful();

        $caddyfile = File::get(base_path('Caddyfile'));

        $this->assertStringContainsString('vito.example.com', $caddyfile);
        $this->assertStringNotContainsString('auto_https off', $caddyfile);
        $this->assertStringContainsString('php_server', $caddyfile);
    }

    public function test_vito_mode_helper(): void
    {
        config(['core.vito_mode' => 'local']);
        $this->assertEquals('local', vito_mode());

        config(['core.vito_mode' => 'dev']);
        $this->assertEquals('dev', vito_mode());
    }

    public function test_ssl_settings_page_accessible(): void
    {
        $this->actingAs($this->user);

        $this->get(route('vito-settings'))
            ->assertOk();
    }

    public function test_update_ssl_settings(): void
    {
        $this->actingAs($this->user);

        $this->post(route('vito-settings.ssl'), [
            'ssl' => false,
            'domain' => '',
            'email' => '',
        ])->assertSessionDoesntHaveErrors();
    }

    public function test_update_ssl_requires_domain_when_enabled(): void
    {
        $this->actingAs($this->user);

        $this->post(route('vito-settings.ssl'), [
            'ssl' => true,
            'domain' => '',
            'email' => '',
        ])->assertSessionHasErrors('domain');
    }

    protected function tearDown(): void
    {
        // Clean up generated Caddyfile
        $caddyfilePath = base_path('Caddyfile');
        if (File::exists($caddyfilePath)) {
            File::delete($caddyfilePath);
        }

        parent::tearDown();
    }
}
