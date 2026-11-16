sudo -n python3 - <<'VITO_BACKUP_REPORT'
import base64,json,os,stat
path=base64.b64decode('{{ base64_encode($path) }}').decode('utf8')
parts=path.split('/')[1:]
if not path.startswith('/') or len(parts)>20 or any(p in ['', '.', '..'] for p in parts):
    raise SystemExit('Invalid report path')
fd=os.open('/',os.O_RDONLY|os.O_DIRECTORY)
try:
    for part in parts[:-1]:
        child=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
        os.close(fd)
        fd=child
    report=os.open(parts[-1],os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
    try:
        info=os.fstat(report)
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=0 or info.st_mode&0o022 or not 0<info.st_size<65536:
            raise SystemExit('Unsafe report file')
        data=os.read(report,65536)
        value=json.loads(data)
        if not isinstance(value,dict):
            raise SystemExit('Invalid report data')
        print(json.dumps(value))
    finally:
        os.close(report)
finally:
    os.close(fd)
VITO_BACKUP_REPORT
