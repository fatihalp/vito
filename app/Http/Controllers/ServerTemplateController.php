<?php

namespace App\Http\Controllers;

use App\Actions\ServerTemplate\ManageServerTemplate;
use App\Models\ServerTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Spatie\RouteAttributes\Attributes\Delete;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;
use Spatie\RouteAttributes\Attributes\Put;

#[Prefix('server-templates')]
#[Middleware(['auth'])]
class ServerTemplateController extends Controller
{
    #[Get('/', name: 'server-templates.index')]
    public function index(): JsonResponse
    {
        return response()->json([
            'templates' => user()->serverTemplates,
        ]);
    }

    #[Post('/', name: 'server-templates.store')]
    public function store(Request $request): RedirectResponse
    {
        $this->authorize('create', ServerTemplate::class);

        app(ManageServerTemplate::class)->create(user(), $request->all());

        return back()->with('success', __('Server template created successfully.'));
    }

    #[Put('/{id}', name: 'server-templates.update')]
    public function update(Request $request, int $id): RedirectResponse
    {
        $template = user()->serverTemplates()->findOrFail($id);

        $this->authorize('update', $template);

        app(ManageServerTemplate::class)->update($template, $request->all());

        return back()->with('success', __('Server template updated successfully.'));
    }

    #[Delete('/{id}', name: 'server-templates.destroy')]
    public function destroy(int $id): RedirectResponse
    {
        $template = user()->serverTemplates()->findOrFail($id);

        $this->authorize('delete', $template);

        $template->delete();

        return back()->with('success', __('Server template deleted successfully.'));
    }
}
