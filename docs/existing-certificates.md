# Existing server certificates

The server SSL page includes a read-only inventory from the active Nginx configuration. Dockerized Mailcow Nginx is supported when exactly one running container has the `com.docker.compose.service=nginx-mailcow` label. No application configuration, service or renewal schedule changes during inspection.

Only public certificate metadata is returned: domains, expiry, remaining days, SHA256 fingerprint and whether the certificate is registered in Vito. Native certificate installation, renewal and removal remain separate. Certificates managed outside Vito continue using their existing renewal service; this inventory does not adopt or renew them.

The scan is limited to fifty certificate paths, a short overall execution budget and bounded SSH output. Variable-based/unreadable/invalid certificates and partial discovery are reported as incomplete. Unsupported configurations and SSH failures show an error, never a healthy empty list. Results are cached for ten minutes; refresh may return the cached observation. Private keys and configuration paths are not sent to the browser.

Access uses the server's existing SSL read policy. Certificate endpoints are rate-limited and return private/no-store responses. Expired, expiring within thirty days and not-yet-valid certificates are distinct states. A valid local certificate alone does not prove public DNS, routing, browser trust or successful automatic renewal.
