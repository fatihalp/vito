<?php

namespace App\Http\Controllers\Admin;

use App\Actions\User\CreateUser;
use App\Actions\User\DeleteUser;
use App\Actions\User\GetUsers;
use App\Actions\User\SearchUsers;
use App\Actions\User\UpdateUser;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Delete;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Patch;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('admin/users')]
#[Middleware(['auth', 'must-be-admin'])]
class UserController extends Controller
{

    #[Get('/', name: 'users')]
    public function index(GetUsers $getUsers): Response
    {
        $this->authorize('viewAny', User::class);

        return Inertia::render('users/index', [
            'users' => UserResource::collection($getUsers->get(user())),
            'projects' => Project::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    #[Get('/json', name: 'users.json')]
    public function json(Request $request): ResourceCollection
    {
        $this->authorize('viewAny', User::class);

        return UserResource::collection(app(SearchUsers::class)->search($request->all()));
    }

    #[Post('/', name: 'users.store')]
    public function store(Request $request): RedirectResponse
    {
        $this->authorize('create', User::class);

        app(CreateUser::class)->create($request->all());

        return to_route('users')->with('success', 'User created successfully.');
    }

    #[Patch('/{user}', name: 'users.update')]
    public function update(Request $request, User $user): RedirectResponse
    {
        $this->authorize('update', $user);

        app(UpdateUser::class)->update($user, $request->all());

        return to_route('users')->with('success', 'User updated successfully.');
    }

    #[Delete('/{user}', 'users.destroy')]
    public function destroy(User $user, DeleteUser $deleteUser): RedirectResponse
    {
        $this->authorize('delete', $user);

        $deleteUser->delete($user);

        return to_route('users')->with('success', 'User was successfully deleted.');
    }
}
