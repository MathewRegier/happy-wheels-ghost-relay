"""Zip the built launcher EXE and write mod-store/launcher.json."""
from __future__ import annotations

import hashlib
import json
import pathlib
import shutil
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from launcher_version import VERSION  # noqa: E402

STORE = ROOT / 'mod-store'
RELAY_STORE = ROOT / 'relay' / 'mod-store'
EXE_NAME = 'Happy Wheels Mod Launcher.exe'


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    exe = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'dist' / EXE_NAME
    if not exe.is_file():
        raise SystemExit('Built launcher EXE not found: ' + str(exe))
    name = f'Happy-Wheels-Mod-Launcher-{VERSION}.zip'
    (STORE / 'zips').mkdir(parents=True, exist_ok=True)
    dest = STORE / 'zips' / name
    if dest.exists():
        dest.unlink()
    with zipfile.ZipFile(dest, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(exe, EXE_NAME)
    digest = sha256_file(dest)
    payload = {
        'id': 'happy-wheels-mod-launcher',
        'name': 'Happy Wheels Mod Launcher',
        'version': VERSION,
        'file': 'zips/' + name,
        'sha256': digest,
        'notes': 'Supports the latest Steam Happy Wheels update and can update itself.',
    }
    (STORE / 'launcher.json').write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
    catalog_path = STORE / 'catalog.json'
    if catalog_path.is_file():
        catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
        catalog['launcher'] = {
            'version': VERSION,
            'file': payload['file'],
            'sha256': digest,
        }
        catalog_path.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
    if (ROOT / 'relay' / '.git').is_dir():
        (RELAY_STORE / 'zips').mkdir(parents=True, exist_ok=True)
        shutil.copy2(dest, RELAY_STORE / 'zips' / name)
        shutil.copy2(STORE / 'launcher.json', RELAY_STORE / 'launcher.json')
        relay_catalog = RELAY_STORE / 'catalog.json'
        if relay_catalog.is_file():
            catalog = json.loads(relay_catalog.read_text(encoding='utf-8'))
            catalog['launcher'] = {
                'version': VERSION,
                'file': payload['file'],
                'sha256': digest,
            }
            relay_catalog.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
        print('Copied to', RELAY_STORE)
    print('Wrote', dest)
    print('sha256', digest)


if __name__ == '__main__':
    main()
