# Isolated CI runners

A site's **CI** tab connects an existing isolated runner over the server's registered SSH connection. It supports branches, `pr:N`, full commit SHAs, stage selection, history, duration/memory measurements, bounded log previews and cancellation. Planned applications can run CI before deployment. CI does not deploy, change application environment files or publish images.

A global administrator selects an existing server, a dedicated unprivileged Linux user and a root-owned client under `/usr/local/bin` or `/usr/local/libexec`. The Vito control-plane server cannot be selected. The server SSH identity must be permitted to run that client as the isolated user without a password. Do not grant the CI user sudo or a root Docker socket. The configured client and all its parent directories must be root-owned and not writable by CI jobs.

The runner remains responsible for sandboxing untrusted code, credential isolation/redaction, egress restrictions, concurrency, resource/disk limits, timeouts, cleanup, retention and reboot recovery. Connecting it does not install or validate those protections. Run installation and recovery checks before enabling a new backend.

## Protocol version 1

Vito pipes a JSON request, bounded to8192bytes, to `<client> api`. The client must respond with one JSON object and terminate promptly; starting a job must return immediately. Success is `{"ok":true,"data":...}`. A rejected request is `{"ok":false,"error":"..."}`; valid protocol responses use process exit0. Vito maps errors to safe messages and bounds incoming SSH output to1MiB while reading it.

| Action | Request fields | Data |
|---|---|---|
| `info` | action | protocol:1, repository, source_origin, stages[] |
| `list` | action | Up to50 most recent run records |
| `run` | action, ref, stages[] | Created run record |
| `status` | action, run_id | Run record |
| `log` | action, run_id, cursor, stage:null or name | text, next cursor |
| `cancel` | action, run_id | cancel_requested:boolean |

`repository` is the canonical namespace/name, without credentials or a `.git` suffix. `source_origin` is the HTTPS origin/base URL, such as `https://github.com`. The current integration supports GitHub/GitHub App and GitLab using the default SSH port. It binds the source-control record/provider/URL and repository when configured; changing that identity requires an administrator to reconnect. The backend must verify the actual source origin and commit; never derive repository identity from untrusted job output.

Run records include repository, source_origin, run_id (16 lowercase hexadecimal characters), ref, sha (null until resolved; then40 lowercase hexadecimal characters), status, exit_code, stages[], created_at and finished_at (Unix seconds or null). States are queued/running with null exit code, passed with0, checks failed with1, and infrastructure_error/cancelled with2. Success requires a resolved SHA and passing stages; inconsistent success data is rejected. Each stage has name, result, seconds, peak_mem_mb and optionally measurement. Stage results also allow skipped. A measurement containing `sampled` is labelled explicitly. Optional local_stack_mode=fake is disclosed as wiring-only validation.

The log cursor is a byte offset within the selected log, monotonically advancing even for UTF-8 text. Chunks should contain at most32KiB. A browser preview is limited to256KiB; stage selection provides smaller previews. Logs must already be redacted on the runner. Vito renders plain text, never HTML, and sends private/no-store result responses. Root filesystem paths, internal worker data and credentials are omitted from page responses.

Only site/project readers can view results. Project owners with server write access may submit/cancel checks. Only global administrators with write access can change the connection. Pausing blocks new submissions while preserving read and cancellation access; it never kills existing work.

Automatic provisioning, artifact downloads, GitHub status publication and exact-SHA deployment gates are separate features and are not implied by a successful selected CI run.
