#!/usr/bin/env node
/* Builds index.html: one self-contained page (no bundler, no runtime dependencies).
   src/shell.html supplies the <head> contents (title, fonts, CSS) and the page markup;
   the JavaScript files in src/ are inlined in dependency order. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');

const shell = read('shell.html');
const cut = shell.indexOf('<div id="app">');
if (cut < 0) throw new Error('src/shell.html: could not find <div id="app">');
const head = shell.slice(0, cut);
const body = shell.slice(cut);

/* Games live in games/*.asm. Header comments (; @id, ; @name, ; @blurb) become the picker entry. */
const gameDir = path.join(root, 'games');
const games = fs.existsSync(gameDir) ? fs.readdirSync(gameDir).filter(f => f.endsWith('.asm')).sort().map(f => {
  const src = fs.readFileSync(path.join(gameDir, f), 'utf8');
  const tag = k => { const m = new RegExp('^;\\s*@' + k + '\\s+(.+)$', 'm').exec(src); if (!m) throw new Error(f + ': missing "; @' + k + '" header'); return m[1].trim(); };
  return { id: tag('id'), name: tag('name'), blurb: tag('blurb'), src };
}) : [];
const gamesJs = 'window.GAMES = ' + JSON.stringify(games).replace(/</g, '\\u003c') + ';';
const order = ['cpu.js', 'demos.js', 'games', 'layout.js', 'phases.js', 'ui.js'];
const scripts = order.map(f => {
  const js = f === 'games' ? gamesJs : read(f);
  if (/<\/script/i.test(js)) throw new Error(f + ' contains "</script", which would end the inline script early');
  return '<script>\n' + js.trimEnd() + '\n</script>';
}).join('\n');

const favicon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#101917"/>' +
  '<rect x="9" y="9" width="14" height="14" rx="2" fill="none" stroke="#ffb423" stroke-width="2"/>' +
  '<path d="M13 5v4M19 5v4M13 23v4M19 23v4M5 13h4M5 19h4M23 13h4M23 19h4" stroke="#35e0d2" stroke-width="2" stroke-linecap="round"/></svg>';

const html = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<meta name="color-scheme" content="light dark">',
  '<meta name="description" content="An interactive Atari 2600 chipset simulator. Watch the 6507 CPU, TIA and RIOT light up as instructions run, and zoom into the ALU, registers and adder.">',
  '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(favicon) + '">',
  head.trimEnd(),
  '</head>',
  '<body>',
  body.trimEnd(),
  scripts,
  '</body>',
  '</html>',
  ''
].join('\n');

fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('index.html written (' + (html.length / 1024).toFixed(1) + ' KB)');
