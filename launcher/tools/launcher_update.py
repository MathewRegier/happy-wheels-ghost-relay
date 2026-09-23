"""Download and apply Happy Wheels Mod Launcher self-updates."""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import urllib.error
import zipfile

from launcher_version import EXE_NAME, LEGACY_EXE_NAME, NAME, VERSION
from mod_store import DEFAULT_CATALOG_URL, _read_url, _safe_extract, cache_dir, catalog_base, is_newer


def launcher_manifest_url(catalog_url: str | None = None) -> str:
    return catalog_base(catalog_url or DEFAULT_CATALOG_URL) + 'launcher.json'


def fetch_launcher_manifest(url: str | None = None) -> dict:
    data = json.loads(_read_url(url or launcher_manifest_url()).decode('utf-8'))
    if not isinstance(data, dict):
        raise ValueError('Launcher update catalog is invalid.')
    version = str(data.get('version') or '')
    file_name = str(data.get('file') or data.get('url') or '')
    if not version or not file_name:
        raise ValueError('Launcher update catalog is missing a version or file.')
    return {
        'version': version,
        'name': str(data.get('name') or NAME),
        'file': file_name,
        'sha256': str(data.get('sha256') or '').lower(),
        'notes': str(data.get('notes') or ''),
    }


def check_for_update(current_version: str = VERSION, catalog_url: str | None = None) -> dict | None:
    if os.environ.get('HW_LAUNCHER_SKIP_UPDATE'):
        return None
    try:
        info = fetch_launcher_manifest(launcher_manifest_url(catalog_url))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError, json.JSONDecodeError):
        return None
    if is_newer(info['version'], current_version):
        return info
    return None


def extract_launcher_exe(blob: bytes, dest: pathlib.Path) -> pathlib.Path:
    dest.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        zip_path = pathlib.Path(temp) / 'update.zip'
        zip_path.write_bytes(blob)
        unpacked = pathlib.Path(temp) / 'unpacked'
        with zipfile.ZipFile(zip_path) as archive:
            _safe_extract(archive, unpacked)
        candidates = [path for path in unpacked.rglob('*.exe') if path.is_file()]
        if not candidates:
            raise ValueError('The launcher update zip did not contain an EXE.')
        by_name = {path.name.lower(): path for path in candidates}
        chosen = by_name.get(EXE_NAME.lower()) or by_name.get(LEGACY_EXE_NAME.lower()) or candidates[0]
        target = dest / chosen.name
        target.write_bytes(chosen.read_bytes())
        return target


def download_update(info: dict, catalog_url: str | None = None, dest: pathlib.Path | None = None) -> pathlib.Path:
    file_name = info['file']
    url = file_name if file_name.startswith('https://') else catalog_base(catalog_url or DEFAULT_CATALOG_URL) + file_name.lstrip('/')
    blob = _read_url(url)
    digest = hashlib.sha256(blob).hexdigest()
    if info.get('sha256') and digest != info['sha256']:
        raise ValueError('Downloaded launcher failed the checksum check.')
    folder = dest or (cache_dir() / 'updates' / str(info['version']))
    if folder.exists():
        for stale in folder.glob('*.exe'):
            stale.unlink()
    return extract_launcher_exe(blob, folder)


def write_replace_script(current_exe: pathlib.Path, new_exe: pathlib.Path, pid: int | None = None) -> pathlib.Path:
    script = cache_dir() / 'updates' / 'apply-update.bat'
    script.parent.mkdir(parents=True, exist_ok=True)
    script.write_text(
        '@echo off\r\n'
        'set TARGET=%~1\r\n'
        'set SOURCE=%~2\r\n'
        'set PID=%~3\r\n'
        ':wait\r\n'
        'timeout /t 1 /nobreak >nul\r\n'
        'tasklist /FI "PID eq %PID%" | find "%PID%" >nul\r\n'
        'if not errorlevel 1 goto wait\r\n'
        'copy /Y "%SOURCE%" "%TARGET%" >nul\r\n'
        'if errorlevel 1 (\r\n'
        '  ping -n 3 127.0.0.1 >nul\r\n'
        '  copy /Y "%SOURCE%" "%TARGET%" >nul\r\n'
        ')\r\n'
        'start "" "%TARGET%"\r\n'
        'del "%~f0"\r\n',
        encoding='utf-8',
    )
    return script


def apply_and_restart(new_exe: pathlib.Path, current_exe: pathlib.Path | None = None) -> pathlib.Path:
    current = pathlib.Path(current_exe or sys.executable)
    new_exe = pathlib.Path(new_exe)
    if not new_exe.is_file():
        raise ValueError('The downloaded launcher EXE is missing.')
    script = write_replace_script(current, new_exe)
    if os.environ.get('HW_LAUNCHER_DRY_RUN'):
        return script
    creationflags = 0
    if os.name == 'nt':
        creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP | 0x08000000
    subprocess.Popen(
        [str(script), str(current), str(new_exe), str(os.getpid())],
        cwd=str(script.parent),
        close_fds=True,
        creationflags=creationflags,
    )
    raise SystemExit(0)
