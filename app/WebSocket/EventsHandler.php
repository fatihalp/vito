<?php

namespace App\WebSocket;

use App\Actions\WebSockets\GenerateWebSocketToken;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Psr\Http\Message\RequestInterface;

class EventsHandler implements WebSocketHandler
{
    protected const MAX_CONNECTIONS_PER_USER = 10;

    protected const SUBSCRIBE_RATE_LIMIT = 20;

    protected const SUBSCRIBE_RATE_WINDOW = 60;

    
    protected array $connections = [];

    
    protected array $userSubscribeTimestamps = [];

    
    protected array $pendingAuth = [];

    
    protected array $projectSubscriptions = [];

    public function authenticate(RequestInterface $psrRequest): ?string
    {
        $queryString = $psrRequest->getUri()->getQuery();
        parse_str($queryString, $queryParams);
        $token = $queryParams['token'] ?? '';

        if (empty($token)) {
            return 'Missing authentication token';
        }

        $tokenData = (new GenerateWebSocketToken)->validate('events_token', $token);
        if ($tokenData === null) {
            return 'Invalid or expired token';
        }

        $user = User::find($tokenData['user_id']);
        if (! $user) {
            return 'User not found';
        }

        if ($this->userConnectionCount($tokenData['user_id']) >= self::MAX_CONNECTIONS_PER_USER) {
            return 'Too many connections';
        }

        $projectId = $tokenData['project_id'];
        if (! $projectId) {
            return 'No active project';
        }

        
        $this->pendingAuth[$token] = [
            'user_id' => $tokenData['user_id'],
            'project_id' => $projectId,
        ];

        return null;
    }

    public function onOpen(string $connId, WebSocketConnection $connection, RequestInterface $psrRequest): void
    {
        $queryString = $psrRequest->getUri()->getQuery();
        parse_str($queryString, $queryParams);
        $token = $queryParams['token'] ?? '';

        $authData = $this->pendingAuth[$token] ?? null;
        unset($this->pendingAuth[$token]);

        if (! $authData) {
            $connection->send(['type' => 'error', 'message' => 'Authentication failed']);
            $connection->close();

            return;
        }

        $this->connections[$connId] = [
            'connection' => $connection,
            'user_id' => $authData['user_id'],
            'project_id' => $authData['project_id'],
        ];

        $projectId = $authData['project_id'];
        $this->projectSubscriptions[$projectId][$connId] = true;

        $connection->send([
            'type' => 'connected',
            'project_id' => $projectId,
        ]);
    }

    public function onMessage(string $connId, string $payload): void
    {
        $entry = $this->connections[$connId] ?? null;
        if (! $entry) {
            return;
        }

        try {
            $data = json_decode($payload, true);
            if (! is_array($data) || ! isset($data['type'])) {
                return;
            }

            match ($data['type']) {
                'subscribe' => $this->handleSubscribe($connId, $data),
                default => null,
            };
        } catch (\Throwable $e) {
            Log::error('Events handler message error', ['error' => $e->getMessage()]);
        }
    }

    public function onClose(string $connId): void
    {
        $entry = $this->connections[$connId] ?? null;
        if ($entry) {
            $projectId = $entry['project_id'];
            $userId = $entry['user_id'];
            unset($this->projectSubscriptions[$projectId][$connId]);
            if (empty($this->projectSubscriptions[$projectId])) {
                unset($this->projectSubscriptions[$projectId]);
            }
            unset($this->connections[$connId]);

            if ($this->userConnectionCount($userId) === 0) {
                unset($this->userSubscribeTimestamps[$userId]);
            }
        }
    }

    public function ping(string $connId): void
    {
        $entry = $this->connections[$connId] ?? null;
        if ($entry) {
            $entry['connection']->ping();
        }
    }

    public function getConnectionCount(): int
    {
        return count($this->connections);
    }

    
    public function broadcastToProject(int $projectId, array $eventData): void
    {
        $subscribers = $this->projectSubscriptions[$projectId] ?? [];
        foreach ($subscribers as $connId => $_) {
            $entry = $this->connections[$connId] ?? null;
            if ($entry) {
                $entry['connection']->send([
                    'type' => 'event',
                    'data' => $eventData,
                ]);
            }
        }
    }

    
    public function broadcastToAll(array $eventData): void
    {
        foreach ($this->connections as $entry) {
            $entry['connection']->send([
                'type' => 'event',
                'data' => $eventData,
            ]);
        }
    }

    
    public function getSubscribedProjectIds(): array
    {
        return array_keys($this->projectSubscriptions);
    }

    protected function isSubscribeRateLimited(int $userId): bool
    {
        $now = microtime(true);
        $timestamps = $this->userSubscribeTimestamps[$userId] ?? [];

        $timestamps = array_filter($timestamps, fn (float $ts) => ($now - $ts) < self::SUBSCRIBE_RATE_WINDOW);
        $this->userSubscribeTimestamps[$userId] = array_values($timestamps);

        if (count($timestamps) >= self::SUBSCRIBE_RATE_LIMIT) {
            return true;
        }

        $this->userSubscribeTimestamps[$userId][] = $now;

        return false;
    }

    protected function handleSubscribe(string $connId, array $data): void
    {
        $entry = $this->connections[$connId] ?? null;
        if (! $entry) {
            return;
        }

        if ($this->isSubscribeRateLimited($entry['user_id'])) {
            $entry['connection']->send([
                'type' => 'error',
                'message' => 'Subscribe rate limit exceeded',
            ]);

            return;
        }

        $newProjectId = (int) ($data['project_id'] ?? 0);
        if ($newProjectId <= 0) {
            return;
        }

        $user = User::find($entry['user_id']);
        if (! $user) {
            return;
        }

        $hasAccess = $user->allProjects()->where('projects.id', $newProjectId)->exists();
        if (! $hasAccess) {
            $entry['connection']->send([
                'type' => 'error',
                'message' => 'Unauthorized for project',
            ]);

            return;
        }

        
        $oldProjectId = $entry['project_id'];
        unset($this->projectSubscriptions[$oldProjectId][$connId]);
        if (empty($this->projectSubscriptions[$oldProjectId])) {
            unset($this->projectSubscriptions[$oldProjectId]);
        }

        
        $this->connections[$connId]['project_id'] = $newProjectId;
        $this->projectSubscriptions[$newProjectId][$connId] = true;

        $entry['connection']->send([
            'type' => 'subscribed',
            'project_id' => $newProjectId,
        ]);
    }

    protected function userConnectionCount(int $userId): int
    {
        return count(array_filter(
            $this->connections,
            fn (array $entry) => $entry['user_id'] === $userId,
        ));
    }
}
