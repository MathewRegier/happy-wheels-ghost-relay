'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {session} = require('electron');
const {gameRoot, loadCatalog} = require('./hw-mod-catalog.js');

function copyTree(from, to) {
  fs.mkdirSync(to, {recursive: true});
  for (const item of fs.readdirSync(from, {withFileTypes: true})) {
    const src = path.join(from, item.name);
    const dest = path.join(to, item.name);
    if (item.isDirectory()) copyTree(src, dest);
    else if (item.isFile()) fs.copyFileSync(src, dest);
  }
}

function syncMods() {
  const root = gameRoot();
  const catalog = loadCatalog(path.join(root, 'mods'));
  const webrootJs = path.join(root, 'resources', 'webroot', 'js');
  const runtime = path.join(root, 'resources', 'mod-runtime');
  fs.mkdirSync(webrootJs, {recursive: true});
  fs.mkdirSync(runtime, {recursive: true});

  const scripts = [];
  const preloadBits = [];
  const mains = [];
  const preloads = [];
  for (const mod of catalog) {
    const dest = path.join(webrootJs, mod.id);
    fs.rmSync(dest, {recursive: true, force: true});
    const web = path.join(mod.dir, 'web');
    if (fs.existsSync(web) && fs.statSync(web).isDirectory()) copyTree(web, dest);
    for (const script of mod.web) scripts.push(`js/${mod.id}/${script}`);
    if (mod.electronMain) {
      const file = path.join(mod.dir, mod.electronMain);
      if (fs.existsSync(file)) mains.push(file);
    }
    if (mod.electronPreload) {
      const file = path.join(mod.dir, mod.electronPreload);
      if (fs.existsSync(file)) {
        preloads.push(file);
        preloadBits.push(`try{require(${JSON.stringify(file)});}catch(e){}`);
      }
    }
  }

  fs.writeFileSync(
    path.join(webrootJs, 'hw-mod-boot.js'),
    `(function(){${JSON.stringify(scripts)}.forEach(function(src){document.write('<script src="./'+src+'"><\\/script>');});})();\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(runtime, 'preload.cjs'),
    preloadBits.join('\n') || 'void 0;\n',
    'utf8',
  );
  fs.writeFileSync(path.join(runtime, 'mods.json'), JSON.stringify(catalog.map((mod) => ({id: mod.id, name: mod.name, web: mod.web})), null, 2));

  try {
    session.defaultSession.setPreloads(preloads);
  } catch {
    // Session may not exist yet; the generated preload.cjs is required from asar preload.
  }

  for (const file of mains) {
    try {
      require(file);
    } catch {
      // Keep other mods loading if one Electron hook fails.
    }
  }
  return catalog;
}

syncMods();
module.exports = {syncMods};
