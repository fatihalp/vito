# User services and rootless containers

The server's Runtime processes page, and each application's Workers, Schedulers and Services pages, can connect existing user-scoped processes. Choose **Systemd (user)** or **Docker (rootless)**, then select an isolated Linux user registered on this server. Enter the exact unit or container name and link the relevant applications.

Registration observes the existing configuration; it does not create the Linux user, install Docker, enable lingering, change service files or start a process. The user manager and rootless Docker must already work independently. Rootless Docker uses that user's standard `/run/user/<uid>/docker.sock`; it never falls back to the system Docker daemon. Status and explicit commands verify the user registry and actual non-system UID. Docker security options must identify a rootless daemon before any container operation.

User-scoped connections have independent identities. Two users can register the same unit or container name without overwriting each other. Legacy system-level connections remain unchanged. A masked unit cannot be started, and queued operations recheck the requesting user's server permissions. Unlink removes only the panel connection.

Only project owners with server write permission can register, refresh or control processes. Readers can view the states and user context. Commands run as the selected Linux user using the server's existing SSH connection; no Docker API TCP port or user credential is added. Never grant the application user sudo or access to the root Docker socket to make a connection work.

Rootless Docker containers are observed through their own daemon; the server-level root Docker inventory does not contain them. User service status refers to the actual named user unit, rather than assuming that a running user manager means Docker is healthy. An unreachable user bus, missing user or unverified daemon yields an unknown status with a safe explanation.

Removing the context schema requires unlinking user-scoped panel connections first. The downgrade refuses to discard their user identities. Normal code rollback can retain the additive schema and existing connections for review.
