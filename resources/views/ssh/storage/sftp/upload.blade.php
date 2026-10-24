curl -k --ftp-create-dirs -T {!! escapeshellarg($src) !!} -u {!! escapeshellarg($username.':'.$password) !!} {!! escapeshellarg('sftp://'.$host.':'.$port.'/'.$dest) !!}
