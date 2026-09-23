'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ID = /^[a-z0-9][a-z0-9-]{0,62}$/i;

function gameRoot(resourcesPath) {
  const root = resourcesPath || process.resourcesPath;
  if (root) return path.resolve(root, '..');
  return path.resolve(__dirname, '..');
}

function modsDir(root) {
  return path.join(root || gameRoot(), 'mods');
}

function safeRel(rel) {
  return typeof rel === 'string' && rel.length > 0 && rel.length < 180 && !rel.includes('\\') && !rel.includes('..') && !path.isAbsolute(rel);
}

function readMod(entry) {
  const manifest = path.join(entry, 'mod.json');
  if (!fs.existsSync(manifest) || !fs.statSync(manifest).isFile()) return null;
  const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const id = String(data.id || path.basename(entry));
  if (!ID.test(id)) return null;
  const web = Array.isArray(data.web) ? data.web.filter((item) => safeRel(item) && !item.includes('/')) : [];
  const electronMain = safeRel(data.electronMain) ? data.electronMain : null;
  const electronPreload = safeRel(data.electronPreload) ? data.electronPreload : null;
  return {
    id,
    name: String(data.name || id).slice(0, 64),
    author: String(data.author || '').slice(0, 64),
    description: String(data.description || '').slice(0, 240),
    priority: Number.isFinite(data.priority) ? data.priority : 100,
    enabled: data.enabled !== false,
    web,
    electronMain,
    electronPreload,
    dir: entry,
  };
}

function loadCatalog(dir) {
  const folder = dir || modsDir();
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) return [];
  const catalog = [];
  for (const name of fs.readdirSync(folder).sort()) {
    const entry = path.join(folder, name);
    if (!fs.statSync(entry).isDirectory()) continue;
    try {
      const mod = readMod(entry);
      if (mod && mod.enabled) catalog.push(mod);
    } catch {
      // Skip a broken folder so one bad mod cannot block the rest.
    }
  }
  catalog.sort((a, b) => (a.priority - b.priority) || a.id.localeCompare(b.id));
  return catalog;
}

module.exports = {gameRoot, modsDir, loadCatalog, safeRel};
