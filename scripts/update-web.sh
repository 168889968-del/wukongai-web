#!/usr/bin/env bash
# Download a GitHub-built release and update the Caddy-mounted static directory.
set -euo pipefail

repo=168889968-del/wukongai-web
web=/opt/new-api/web
tag=${1:-latest}
if [[ "$tag" != latest && ! "$tag" =~ ^web-[a-f0-9]{12}$ ]]; then
  echo 'Use latest or an explicit web-<12 character commit> release tag.' >&2
  exit 1
fi
test -f "$web/dist/index.html"
exec 9>/run/lock/wukongai-web-deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
scratch=$(mktemp -d /tmp/wukongai-release.XXXXXX)
trap 'rm -rf -- "$scratch"' EXIT
url="https://github.com/$repo/releases/download/$tag"
if [[ "$tag" == latest ]]; then
  url="https://github.com/$repo/releases/latest/download"
fi
curl --fail --location --retry 3 --max-time 180 "$url/wukongai-web.tgz" -o "$scratch/wukongai-web.tgz"
curl --fail --location --retry 3 --max-time 60 "$url/wukongai-web.tgz.sha256" -o "$scratch/wukongai-web.tgz.sha256"
(cd "$scratch" && sha256sum --check wukongai-web.tgz.sha256)
python3 - "$scratch" <<'PY'
import pathlib
import sys
import tarfile

root = pathlib.Path(sys.argv[1])
with tarfile.open(root / 'wukongai-web.tgz', 'r:gz') as archive:
    members = archive.getmembers()
    if len(members) > 20000 or sum(member.size for member in members) > 512 * 1024 * 1024:
        raise SystemExit('Release archive exceeds size limit')
    for member in members:
        path = pathlib.PurePosixPath(member.name)
        if path.is_absolute() or '..' in path.parts or not path.parts or path.parts[0] != 'dist':
            raise SystemExit('Unexpected archive path')
        if not member.isfile() and not member.isdir():
            raise SystemExit('Only regular files and directories are allowed')
    archive.extractall(root, members=members)
if not (root / 'dist' / 'index.html').is_file():
    raise SystemExit('Release has no index.html')
PY
stamp=$(date -u +%Y%m%d-%H%M%S)
backup="/opt/new-api/backups/frontend-$stamp"
mkdir -p "$backup"
tar czf "$backup/dist.tgz" -C "$web" dist
# Keep old hashed assets for open browser sessions; replace the HTML last.
cp "$scratch/dist/index.html" "$scratch/index.next.html"
rm "$scratch/dist/index.html"
cp -a "$scratch/dist/." "$web/dist/"
cp "$scratch/index.next.html" "$web/dist/.index.next.html"
mv "$web/dist/.index.next.html" "$web/dist/index.html"
if ! curl --fail --silent --show-error --max-time 20 https://wukongai.work/ >/dev/null; then
  tar xzf "$backup/dist.tgz" -C "$web"
  echo "Website check failed; restored $backup/dist.tgz" >&2
  exit 1
fi
echo "DEPLOY_OK backup=$backup"
cat "$web/dist/build-commit.txt"
