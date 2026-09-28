Public Happy Wheels **mod** library.

The launcher reads **catalog.json** from:
https://raw.githubusercontent.com/MathewRegier/happy-wheels-ghost-relay/main/mod-store/catalog.json

Launcher **self-updates** come from jhwml:
https://raw.githubusercontent.com/MathewRegier/jhwml/main/mod-store/launcher.json

How to make a mod: https://mathewregier.github.io/jhwml/

To publish a mod update, bump the version in the mod's mod.json, run `python tools/publish_mod_store.py`, then commit and push this folder.

Existing 0.2.2 launcher EXEs still read `launcher.json` from this same folder. `python tools/publish_launcher.py` copies the new manifest here so those clients can update once; after that they check jhwml.
