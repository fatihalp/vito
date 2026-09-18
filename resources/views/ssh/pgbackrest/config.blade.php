[global]
repo1-type=s3
repo1-s3-bucket={!! $bucket !!}
repo1-s3-endpoint={!! $endpoint !!}
@if ($port)
repo1-storage-port={!! $port !!}
@endif
repo1-s3-region={!! $region !!}
repo1-s3-key={!! $key !!}
repo1-s3-key-secret={!! $secret !!}
repo1-s3-uri-style=path
repo1-path={!! $repoPath !!}
repo1-retention-full={!! $retentionFull !!}
@if ($retentionDiff)
repo1-retention-diff={!! $retentionDiff !!}
@endif
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass={!! $cipherPass !!}
repo1-bundle=y
repo1-block=y
compress-type=zst
process-max={!! $processMax !!}
archive-async=y
spool-path=/var/spool/pgbackrest
archive-push-queue-max={!! $walQueueMax !!}GiB
log-level-file=info
@if ($tlsServer)
tls-server-address={!! $tlsServer['address'] !!}
tls-server-port={!! $tlsServer['port'] !!}
tls-server-ca-file={!! $tlsDirectory !!}/ca.crt
tls-server-cert-file={!! $tlsDirectory !!}/node.crt
tls-server-key-file={!! $tlsDirectory !!}/node.key
@foreach ($tlsServer['clients'] as $client)
tls-server-auth={!! $client !!}={!! $stanza !!}
@endforeach
@endif

[global:archive-push]
process-max=2

[{!! $stanza !!}]
pg1-path={!! $pgPath !!}
pg1-port={!! $pgPort !!}
@if ($primaryHost)
pg2-host={!! $primaryHost['host'] !!}
pg2-host-type=tls
pg2-host-port={!! $primaryHost['port'] !!}
pg2-host-ca-file={!! $tlsDirectory !!}/ca.crt
pg2-host-cert-file={!! $tlsDirectory !!}/node.crt
pg2-host-key-file={!! $tlsDirectory !!}/node.key
pg2-path={!! $primaryHost['path'] !!}
pg2-port={!! $primaryHost['pgPort'] !!}
@endif
