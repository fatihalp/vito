<?php

namespace App\Http\Controllers\Admin;

use App\Actions\VitoSetting\ExportVitoSettings;
use App\Actions\VitoSetting\ImportVitoSettings;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

#[Prefix('admin/vito')]
#[Middleware(['auth', 'must-be-admin'])]
class VitoSettingController extends Controller
{
    #[Get('/', name: 'vito-settings')]
    public function index(): Response
    {
        return Inertia::render('vito-settings/index');
    }

    #[Get('/export', name: 'vito-settings.export')]
    public function downloadExport(): BinaryFileResponse
    {
        $exportName = 'vito-backup-'.date('Y-m-d').'.zip';

        return response()->download(app(ExportVitoSettings::class)->export($exportName), $exportName)->deleteFileAfterSend();
    }

    #[Post('/import', name: 'vito-settings.import')]
    public function import(Request $request): RedirectResponse
    {
        config(['session.driver' => 'file']);

        app(ImportVitoSettings::class)->import($request->all());

        return redirect()->route('vito-settings')
            ->with('success', 'Settings imported successfully.');
    }
}
