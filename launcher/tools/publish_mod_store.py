"""Zip local mods and write mod-store/catalog.json for GitHub raw hosting."""
from __future__ import annotations

import hashlib
import json
import pathlib
import shutil
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
STORE = ROOT / 'mod-store'
RELAY_STORE = ROOT / 'relay' / 'mod-store'
CATALOG_URL = 'https://raw.githubusercontent.com/MathewRegier/happy-wheels-ghost-relay/main/mod-store/catalog.json'


def _stash_launcher(store: pathlib.Path) -> dict[str, bytes]:
    saved: dict[str, bytes] = {}
    launcher = store / 'launcher.json'
    if launcher.is_file():
        saved['launcher.json'] = launcher.read_bytes()
    zips = store / 'zips'
    if zips.is_dir():
        for item in zips.glob('Happy-Wheels-Mod-Launcher-*.zip'):
            saved[item.name] = item.read_bytes()
    return saved


def _restore_launcher(store: pathlib.Path, saved: dict[str, bytes]) -> None:
    if not saved:
        return
    (store / 'zips').mkdir(parents=True, exist_ok=True)
    for name, blob in saved.items():
        target = store / name if name == 'launcher.json' else store / 'zips' / name
        target.write_bytes(blob)


def zip_mod(mod_dir: pathlib.Path, dest: pathlib.Path) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        dest.unlink()
    with zipfile.ZipFile(dest, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(mod_dir.rglob('*')):
            if not file.is_file() or '__pycache__' in file.parts:
                continue
            rel = file.relative_to(mod_dir).as_posix()
            if rel.startswith('custom-characters-template/vanilla/'):
                continue
            archive.write(file, rel)
    digest = hashlib.sha256()
    with dest.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    saved = _stash_launcher(STORE)
    if not saved:
        saved = _stash_launcher(RELAY_STORE)
    if STORE.exists():
        shutil.rmtree(STORE)
    (STORE / 'zips').mkdir(parents=True)
    mods = []
    for entry in sorted((ROOT / 'mods').iterdir()):
        manifest = entry / 'mod.json'
        if not manifest.is_file():
            continue
        data = json.loads(manifest.read_text(encoding='utf-8'))
        version = str(data.get('version') or '0')
        name = f"{data.get('id', entry.name)}-{version}.zip"
        digest = zip_mod(entry, STORE / 'zips' / name)
        mods.append({
            'id': data.get('id', entry.name),
            'name': data.get('name', entry.name),
            'version': version,
            'author': data.get('author', ''),
            'description': data.get('description', ''),
            'file': 'zips/' + name,
            'sha256': digest,
        })
    catalog = {
        'updated': '2026-09-23',
        'host': 'github',
        'mods': mods,
    }
    (STORE / 'catalog.json').write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
    (STORE / 'README.md').write_text(
        'Public Happy Wheels mod library.\n\n'
        'The launcher reads catalog.json from:\n'
        + CATALOG_URL + '\n\n'
        'The launcher also reads launcher.json from the same folder for self-updates.\n\n'
        'To publish an update, bump the version in the mod\'s mod.json, run '
        '`python tools/publish_mod_store.py`, then commit and push relay/mod-store.\n'
        'To publish a launcher EXE, run `python tools/publish_launcher.py` after building.\n',
        encoding='utf-8',
    )
    _restore_launcher(STORE, saved)
    if (ROOT / 'relay' / '.git').is_dir():
        if RELAY_STORE.exists():
            shutil.rmtree(RELAY_STORE)
        shutil.copytree(STORE, RELAY_STORE)
        print('Copied to', RELAY_STORE)
    print('Wrote', STORE / 'catalog.json')
    for mod in mods:
        print(mod['id'], mod['version'], mod['file'])


if __name__ == '__main__':
    main()
