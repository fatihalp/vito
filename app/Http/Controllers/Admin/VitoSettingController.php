<?php

namespace App\Http\Controllers\Admin;

use App\Actions\VitoSetting\BackupVitoDatabase;
use App\Http\Controllers\Controller;
use App\Models\StorageProvider;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('admin/vito')]
#[Middleware(['auth', 'must-be-admin'])]
class VitoSettingController extends Controller
{
    #[Get('/', name: 'vito-settings')]
    public function index(): Response
    {
        return Inertia::render('vito-settings/index', [
            'storageProviders' => StorageProvider::query()
                ->where('provider', 's3')
                ->where('user_id', user()->id)
                ->get(['id', 'profile']),
        ]);
    }

    #[Post('/backup', name: 'vito-settings.backup')]
    public function backup(Request $request, BackupVitoDatabase $action): RedirectResponse
    {
        $key = $action->backup($request->user(), $request->all());

        return back()->with('success', 'Database backed up to '.$key);
    }
}
