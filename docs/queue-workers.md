# Queue workers on a two-core Vito host

The default profile reserves two workers for `ssh` operations and one worker for
`ssh-checks`. Replica health checks, APP_DEBUG checks, PHP version scans and service
refreshes use `ssh-checks`, so a scan backlog does not occupy the operation workers.
Default jobs have one worker. Certbot and the two storage-migration queues retain
one worker each. The total configured maximum is seven workers, including idle
workers; this is a concurrency limit, not a CPU or memory quota.

Set these values in the deployment environment if older overrides are present:

```dotenv
HORIZON_DEFAULT_MAX_PROCESSES=1
HORIZON_SSH_MAX_PROCESSES=2
HORIZON_SSH_CHECKS_MAX_PROCESSES=1
```

SSH pools use fixed `simple` balancing so the operation workers are available
without waiting for autoscaling. Check workers have a lower process priority and
recycle after 100 jobs. Remote commands can still compete for resources when the
target is the Vito host itself; monitor CPU, swap and available RAM before raising
limits. The existing worker memory limit is a recycling threshold, not a hard
limit on an individual running job.

Server-specific execution locks remain in place: jobs on different servers can
run concurrently while jobs sharing a server lock are deferred. Two long running
operations can still occupy both operation slots. Replica and APP_DEBUG checks
also acquire Laravel unique-job locks when dispatched, preventing repeated copies
of the same check from accumulating while it is pending or running.

The default execution-lock lifetime now exceeds the SSH worker timeout and any
job-specific timeout. Queue reservation timeouts also exceed the SSH/backup
execution timeouts, including when jobs use the default connection with
`onQueue('ssh')`. This prevents an unfinished job becoming eligible for duplicate
execution before its worker times out.

## Deployment

After updating the code and environment, rebuild config and restart Horizon:

```sh
php artisan config:cache
php artisan horizon:terminate
```

The process manager must automatically restart Horizon. Wait for long running
jobs to finish before a planned restart. The Horizon dashboard should show the
new `ssh-checks` supervisor alongside `ssh` with the limits above. Old queued jobs
retain their original queue and will drain there; do not clear the queues. Unique
locks prevent newly dispatched duplicate checks, but do not remove duplicates
already queued before deployment. Existing job payloads use the updated class
code when workers restart. No migrations are needed.
