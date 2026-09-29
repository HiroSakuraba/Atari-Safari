const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail && e.detail.stack || e.message)));
vc.on('error', e => errors.push('console.error: ' + e));
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) {
  w.ImageData = class { constructor(d, wd, h) { this.data = d; this.width = wd; this.height = h; } };
  w.HTMLCanvasElement.prototype.getContext = () => ({ putImageData() {} });
  w.Element.prototype.setPointerCapture = () => {};
  w.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });
  w.Element.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600 }; };
} });
const w = dom.window, d = w.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = s => d.querySelector(s);
(async () => {
  await sleep(300);
  const X = w.__explorer;
  console.log('nodes', d.querySelectorAll('.node').length, 'edges', d.querySelectorAll('.edge').length, 'frames', d.querySelectorAll('.frame').length);
  // Step at slow speed
  X.setLevel(2); $('#speed').value = 2;
  $('#bStep').click(); await sleep(50);
  let lit = [...d.querySelectorAll('.edge.lit, .node.lit')].length;
  await sleep(700);
  lit = Math.max(lit, d.querySelectorAll('.edge.lit, .node.lit').length);
  console.log('after step mode', X.mode, 'cur', X.cur && X.cur.text, 'phases', X.cur && X.cur.phases.length, 'peak lit', lit);
  await sleep(3500);
  console.log('after wait: mode', X.mode, 'pc', X.M.pc.toString(16), 'a', X.M.a.toString(16));
  // micro steps
  for (let i = 0; i < 12; i++) { $('#bMicro').click(); await sleep(30); }
  console.log('micro: cur', X.cur.text, 'idx', X.cur.idx, 'litcount', d.querySelectorAll('.edge.lit, .node.lit').length);
  // run at all speeds
  for (const lv of [2, 3, 4]) {
    X.setLevel(lv); $('#speed').value = lv;
    $('#bRun').click(); await sleep(lv === 2 ? 1500 : 600); 
    const nowTxt = $('#now').textContent.slice(0, 60);
    $('#bRun').click(); await sleep(400);
    console.log('level', lv, 'mode', X.mode, 'cycles', X.M.cycles, 'now:', nowTxt);
  }
  // zoom targets
  for (const v of ['cpu', 'alu', 'adder', 'tia', 'riot', 'ram', 'rom', 'sys']) { X.flyTo(v, true); }
  console.log('viewBox', $('#stage').getAttribute('viewBox'));
  // click a node
  const n = d.querySelector('[data-id="adder"]'); 
  // pick demos
  for (let i = 0; i < 6; i++) { const s = $('#demoSel'); s.value = i; s.dispatchEvent(new w.Event('change')); await sleep(30); X.setLevel(3); $('#bRun').click(); await sleep(150); $('#bRun').click(); }
  // bad source
  $('#src').value = 'start: FOO #1\n LDA #$300'; $('#bAsm').click();
  console.log('err shown:', JSON.stringify($('#err').textContent));
  $('#src').value = 'start: LDA #1\n JMP start'; $('#bAsm').click(); console.log('err after good:', JSON.stringify($('#err').textContent), 'listing rows', d.querySelectorAll('#listing div').length);
  $('#bReset').click();
  console.log('ERRORS:', errors.length ? errors : 'none');
  w.close(); process.exit(errors.length ? 1 : 0);
})();
