# Happy Wheels Mod Launcher

Source for the Windows installer that makes Steam Happy Wheels 1.99.1 moddable.

Created by Jimbob · Discord **jimbob1111**

This repo folder is Python source only. It does **not** include Happy Wheels game files, `Happy Wheels.exe`, or `app.asar`.

Nexus Mods quarantines unsigned EXEs. Reviewers can build the same binary from this folder.

## Requirements

- Windows (to build or run the EXE)
- [Python 3](https://www.python.org/downloads/) with **Add python.exe to PATH**
- A legal Steam copy of Happy Wheels 1.99.1
- Close Happy Wheels before installing

## Run from source (no EXE)

```powershell
cd launcher
python installer\app.py
```

Or patch a known Steam folder:

```powershell
python tools\setup.py "C:\Program Files (x86)\Steam\steamapps\common\Happy Wheels"
```

## Build the EXE

From this `launcher` folder:

```powershell
powershell -ExecutionPolicy Bypass -File installer\build.ps1
```

That installs PyInstaller, then writes:

```
dist\Happy Wheels Mod Launcher.exe
```

Build flags: `--onefile --windowed --noupx`. The first launch of the EXE can take a few seconds while it unpacks.

### What the EXE does

1. Finds the Steam Happy Wheels folder
2. Installs the drop-in mods loader
3. Copies selected mods from `mods\` (or the public catalog)
4. Does not ship Happy Wheels itself

A Steam update or **Verify integrity of game files** can remove the loader. Run the launcher again after that.

## Layout

| Path | What it is |
| --- | --- |
| `installer/app.py` | Launcher window |
| `installer/build.ps1` | EXE build script |
| `tools/packager.py` | Patches the Steam game in place |
| `tools/setup.py` | Command-line installer |
| `tools/mod_store.py` | Cloud catalog updates |
| `core/` | Mods loader injected into the game |
| `mods/jimbobs-multiplayer/` | Bundled multiplayer mod |
| `vendor/ws/` | WebSocket library copied into the game |

## Help

Discord: **jimbob1111**
