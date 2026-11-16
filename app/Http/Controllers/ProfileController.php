<?php

namespace App\Http\Controllers;

use App\Actions\User\UpdateUserPassword;
use App\Actions\User\UpdateUserProfileInformation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Actions\DisableTwoFactorAuthentication;
use Laravel\Fortify\Actions\EnableTwoFactorAuthentication;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Patch;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;
use Spatie\RouteAttributes\Attributes\Put;

#[Prefix('settings/profile')]
#[Middleware(['auth'])]
class ProfileController extends Controller
{

    #[Get('/', name: 'profile')]
    public function edit(Request $request): Response
    {
        $user = user();

        return Inertia::render('profile/index', [
            'two_factor_enabled' => (bool) $user->two_factor_secret,
            'two_factor_recovery_codes' => $user->two_factor_secret ? $user->recoveryCodes() : null,
            'two_factor_confirmed_at' => $user->two_factor_confirmed_at,
            'two_factor_must_confirm' => (bool) config('fortify-options.two-factor-authentication.confirm'),
            'status' => $request->session()->get('status'),
        ]);
    }

    #[Patch('/', name: 'profile.update')]
    public function update(Request $request): RedirectResponse
    {
        app(UpdateUserProfileInformation::class)->update($request->user(), $request->only('name', 'email'));

        return to_route('profile');
    }

    #[Put('/', name: 'profile.password')]
    public function password(Request $request): RedirectResponse
    {
        app(UpdateUserPassword::class)->update($request->user(), $request->only('current_password', 'password', 'password_confirmation'));

        return to_route('profile');
    }

    #[Post('/enable-two-factor', name: 'profile.enable-two-factor')]
    public function enableTwoFactor(): RedirectResponse
    {
        $user = user();

        app(EnableTwoFactorAuthentication::class)($user);

        return back()
            ->with('success', 'Two factor authentication enabled.')
            ->with('data', [
                'qr_code' => $user->twoFactorQrCodeSvg(),
                'qr_code_url' => $user->twoFactorQrCodeUrl(),
                'recovery_codes' => $user->recoveryCodes(),
            ]);
    }

    #[Post('/disable-two-factor', name: 'profile.disable-two-factor')]
    public function disableTwoFactor(): RedirectResponse
    {
        $user = user();

        app(DisableTwoFactorAuthentication::class)($user);

        return back()->with('success', 'Two factor authentication disabled.');
    }
}
