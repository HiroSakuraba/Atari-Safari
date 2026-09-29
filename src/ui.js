/* 2600 Chip Explorer: scene, camera, sequencer, panels. */
(function () {
'use strict';
const A = window.Atari, LAY = window.LAYOUT, DEMOS = window.DEMOS, PH = window.PHASES;
const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r) => (r || document).querySelector(s);
const hex2 = A.hex2, hex4 = A.hex4;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function S(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
const setT = (el, s) => { if (el.__t !== s) { el.__t = s; el.textContent = s; } };
const setC = (el, c, on) => { on = !!on; if (el.__c !== on) { el.__c = on; el.classList.toggle(c, on); } };

const svg = $('#stage');
const M = new A.Machine();
const disp = { pc: 0, ar: 0, db: 0, ir: undefined, a: 0, x: 0, y: 0, s: 0, p: 0, ain: undefined, bin: undefined, res: undefined,
  binvtxt: '', logicop: '', shiftop: '', mnem: '', op: null, tcyc: 0, ram: new Uint8Array(128), tia: new Uint8Array(64), romAddr: 0 };
const MODE = { imp: 'implied', acc: 'accumulator', imm: 'immediate', zp: 'zero page', zpx: 'zero page,X', zpy: 'zero page,Y', abs: 'absolute', abx: 'absolute,X', aby: 'absolute,Y', ind: 'indirect', izx: '(indirect,X)', izy: '(indirect),Y', rel: 'relative' };
const INS_DESC = { LDA: 'Load accumulator', LDX: 'Load X', LDY: 'Load Y', STA: 'Store accumulator', STX: 'Store X', STY: 'Store Y', ADC: 'Add with carry', SBC: 'Subtract with carry', AND: 'Logical AND', ORA: 'Logical OR', EOR: 'Exclusive OR', CMP: 'Compare with A', CPX: 'Compare with X', CPY: 'Compare with Y', BIT: 'Test bits', ASL: 'Shift left', LSR: 'Shift right', ROL: 'Rotate left', ROR: 'Rotate right', INC: 'Increment memory', DEC: 'Decrement memory', INX: 'Increment X', INY: 'Increment Y', DEX: 'Decrement X', DEY: 'Decrement Y', TAX: 'Copy A to X', TAY: 'Copy A to Y', TXA: 'Copy X to A', TYA: 'Copy Y to A', TSX: 'Copy S to X', TXS: 'Copy X to S', CLC: 'Clear carry', SEC: 'Set carry', CLD: 'Clear decimal mode', SED: 'Set decimal mode', CLI: 'Clear interrupt disable', SEI: 'Set interrupt disable', CLV: 'Clear overflow', NOP: 'No operation', PHA: 'Push A', PHP: 'Push flags', PLA: 'Pull A', PLP: 'Pull flags', JMP: 'Jump', JSR: 'Jump to subroutine', RTS: 'Return from subroutine', RTI: 'Return from interrupt', BRK: 'Break', BCC: 'Branch if carry clear', BCS: 'Branch if carry set', BEQ: 'Branch if zero', BNE: 'Branch if not zero', BMI: 'Branch if negative', BPL: 'Branch if positive', BVC: 'Branch if overflow clear', BVS: 'Branch if overflow set' };

/* ================= scene ================= */
const REG = {}, updaters = [], INFO = {};
const gWorld = S('g', null, svg);
const gFrames = S('g', null, gWorld), gOv = S('g', null, gWorld), gEdges = S('g', null, gWorld), gNodes = S('g', null, gWorld), gLabels = S('g', null, gWorld);
let romVer = 0;

LAY.L.forEach(f => {
  const g = S('g', { class: 'frame k-' + f.kind, 'data-id': f.id, 'data-view': f.view }, gFrames);
  S('rect', { class: 'fb', x: f.x, y: f.y, width: f.w, height: f.h, rx: 18 }, g);
  const br = f.tpos === 'br';
  const t = S('text', br ? { class: 'ft', x: f.x + f.w - 14, y: f.y + f.h - 10, 'text-anchor': 'end', style: 'font-size:22px' } : { class: 'ft', x: f.x + 22, y: f.y + 40 }, g, f.title);
  S('tspan', { class: 'fs', dx: 12, style: br ? 'font-size:17px' : '' }, t, f.sub);
  REG[f.id] = { el: g };
  INFO[f.id] = { label: f.title + ' ' + f.sub, desc: f.desc, kind: f.kind };
});
LAY.E.forEach(e => {
  const g = S('g', { class: 'edge k-' + e.kind + (e.thick ? ' thick' : '') }, gEdges);
  const d = 'M' + e.pts.map(p => p[0] + ' ' + p[1]).join(' L');
  S('path', { class: 'w', d }, g); S('path', { class: 'g', d }, g); S('path', { class: 'f', d }, g);
  if (e.label) S('text', { class: 'el', x: e.lx, y: e.ly }, gLabels, e.label);
  REG[e.id] = { el: g };
});
LAY.LABELS.forEach(l => S('text', { class: 'el', x: l.x, y: l.y, 'text-anchor': 'end', style: 'font-size:18px;letter-spacing:.08em;text-transform:uppercase;opacity:.8' }, gLabels, l.t));

const BUILD = {
  dec(g, n) {
    const mn = S('text', { class: 'bigmn', x: n.x + 16, y: n.y + 100 }, g, '');
    const md = S('text', { class: 'ns', x: n.x + 16, y: n.y + 136 }, g, '');
    const cy = S('text', { class: 'ns', x: n.x + 16, y: n.y + 166 }, g, '');
    updaters.push(() => { const o = disp.op; setT(mn, o ? o.m : '---'); setT(md, o ? MODE[o.mode] : ''); setT(cy, o ? o.cycles + ' cycles, ' + o.len + (o.len > 1 ? ' bytes' : ' byte') : ''); });
  },
  tim(g, n) {
    const pips = [];
    for (let i = 0; i < 7; i++) {
      pips.push(S('circle', { class: 'pip', cx: n.x + 36 + i * 38, cy: n.y + 66, r: 13 }, g));
      S('text', { class: 'sm d1', x: n.x + 36 + i * 38, y: n.y + 99, 'text-anchor': 'middle' }, g, 'T' + i);
    }
    updaters.push(() => { for (let i = 0; i < 7; i++) { setC(pips[i], 'done', i < disp.tcyc - 1); setC(pips[i], 'now', i === disp.tcyc - 1); } });
  },
  flags(g, n) {
    const L = 'NV-BDIZC', rs = [], ts = [];
    for (let i = 0; i < 8; i++) {
      const x = n.x + 10 + i * 20;
      rs.push(S('rect', { class: 'flg', x, y: n.y + 56, width: 18, height: 32, rx: 4 }, g));
      ts.push(S('text', { class: 'flt', x: x + 9, y: n.y + 79 }, g, L[i]));
    }
    updaters.push(() => { for (let i = 0; i < 8; i++) { const on = (disp.p >> (7 - i)) & 1; setC(rs[i], 'on', on); setC(ts[i], 'on', on); } });
  },
  adder(g, n) {
    S('text', { class: 'ns d1', x: n.x + 110, y: n.y + 30 }, g, 'ripple carry, bit 0 to bit 7');
    const bits = [];
    for (let b = 0; b < 8; b++) {
      const cx = 770 + b * 62;
      const cg = S('g', { class: 'k-alu' }, g);
      S('rect', { class: 'cellb', x: cx, y: 705, width: 52, height: 44, rx: 5 }, cg);
      S('text', { class: 'sm d2', x: cx + 6, y: 720, style: 'font-size:13px' }, cg, 'b' + b);
      bits.push(S('text', { class: 'smv d2', x: cx + 26, y: 743, 'text-anchor': 'middle' }, cg, ''));
      REG['cell' + b] = { el: cg };
    }
    const pg = S('g', { class: 'k-alu' }, g);
    S('rect', { class: 'pill', x: 1170, y: 674, width: 90, height: 26, rx: 13 }, pg);
    S('text', { class: 'sm', x: 1215, y: 693, 'text-anchor': 'middle', style: 'font-size:15px' }, pg, 'BCD fix');
    REG.bcd = { el: pg };
    updaters.push(() => { for (let b = 0; b < 8; b++) setT(bits[b], disp.res === undefined ? '·' : String((disp.res >> b) & 1)); });
  },
  tiaregs(g, n) {
    const names = ['COLUBK', 'COLUPF', 'COLUP0', 'COLUP1', 'PF0', 'PF1', 'PF2', 'CTRLPF', 'GRP0', 'GRP1', 'VSYNC', 'VBLANK'];
    const vals = [], sw = [];
    names.forEach((nm, i) => {
      const cx = 1547 + (i % 3) * 124, cy = 262 + Math.floor(i / 3) * 50;
      const cg = S('g', { class: 'k-chip' }, g);
      S('rect', { class: 'cellb', x: cx, y: cy, width: 118, height: 44, rx: 6 }, cg);
      S('text', { class: 'sm', x: cx + 8, y: cy + 17, style: 'font-size:14px' }, cg, nm);
      vals.push(S('text', { class: 'smv', x: cx + 8, y: cy + 38 }, cg, ''));
      sw.push(/^COL/.test(nm) ? S('rect', { x: cx + 84, y: cy + 22, width: 26, height: 16, rx: 3, fill: '#000', stroke: 'var(--nstroke)', 'stroke-width': 1.5 }, cg) : null);
      REG['tr_' + nm] = { el: cg };
    });
    updaters.push(() => names.forEach((nm, i) => {
      const v = disp.tia[A.TIA_W.indexOf(nm)];
      setT(vals[i], '$' + hex2(v));
      if (sw[i] && sw[i].__v !== v) { sw[i].__v = v; sw[i].setAttribute('fill', A.paletteCss(v)); }
    }));
  },
  tiaclk(g, n) {
    const a = S('text', { class: 'smv', x: n.x + 14, y: n.y + 62 }, g, ''), b = S('text', { class: 'sm', x: n.x + 14, y: n.y + 82, style: 'font-size:14px' }, g, '');
    updaters.push(() => { setT(a, 'clock ' + M.tia.hpos + ' / 228'); setT(b, 'scanline ' + M.tia.line + '   frame ' + M.tia.frame); });
  },
  tiaout(g, n) {
    S('text', { class: 'ns d1', x: n.x + 14, y: n.y + 56 }, g, 'background');
    const r = S('rect', { x: n.x + 210, y: n.y + 14, width: 76, height: 52, rx: 6, fill: '#000', stroke: 'var(--nstroke)', 'stroke-width': 2 }, g);
    updaters.push(() => { const v = disp.tia[9]; if (r.__v !== v) { r.__v = v; r.setAttribute('fill', A.paletteCss(v)); } });
  },
  ram(g, n) {
    S('text', { class: 'ns d1', x: n.x + 90, y: n.y + 30 }, g, '128 bytes, $80 to $FF');
    const tx = [];
    for (let i = 0; i < 128; i++) {
      const cx = 1550 + (i % 16) * 22.5, cy = 1030 + Math.floor(i / 16) * 16;
      const cg = S('g', { class: 'k-chip' }, g);
      S('rect', { class: 'cellb', x: cx, y: cy, width: 21, height: 15, rx: 2 }, cg);
      tx.push(S('text', { class: 'sm d2', x: cx + 10.5, y: cy + 11.5, 'text-anchor': 'middle', style: 'font-size:11px' }, cg, ''));
      REG['ram_' + i] = { el: cg };
    }
    updaters.push(() => { for (let i = 0; i < 128; i++) setT(tx[i], hex2(disp.ram[i])); });
  },
  timer(g, n) {
    const a = S('text', { class: 'smv', x: n.x + 14, y: n.y + 72 }, g, ''), b = S('text', { class: 'sm', x: n.x + 14, y: n.y + 98, style: 'font-size:14px' }, g, '');
    updaters.push(() => { setT(a, 'INTIM $' + hex2(M.riot.t)); setT(b, 'counts every ' + M.riot.iv + (M.riot.under ? ' cycle(s), underflowed' : ' cycle(s)')); });
  },
  io(g, n) {
    const a = S('text', { class: 'smv', x: n.x + 14, y: n.y + 72 }, g, ''), b = S('text', { class: 'smv', x: n.x + 14, y: n.y + 106 }, g, '');
    updaters.push(() => { setT(a, 'SWCHA $' + hex2(M.riot.swcha)); setT(b, 'SWCHB $' + hex2(M.riot.swchb)); });
  },
  rom(g, n) {
    S('text', { class: 'ns d1', x: n.x + 200, y: n.y + 30 }, g, '4 KB at $F000. The window follows the last address read.');
    const cg = S('g', { class: 'k-chip' }, g);
    const cur = S('rect', { class: 'romcur', x: 0, y: 0, width: 54, height: 22, rx: 4 }, cg);
    REG.romcur = { el: cg };
    const lab = [], by = [];
    for (let r = 0; r < 8; r++) {
      lab.push(S('text', { class: 'sm', x: n.x + 16, y: 1256 + r * 20, style: 'font-size:16px' }, g, ''));
      for (let c = 0; c < 16; c++) by.push(S('text', { class: 'smv d1', x: n.x + 138 + c * 62, y: 1256 + r * 20, 'text-anchor': 'middle', style: 'font-size:17px' }, g, ''));
    }
    let key = '';
    updaters.push(() => {
      const a = disp.romAddr & 0xFFF, start = clamp((a >> 4) - 3, 0, 248), k = start + ':' + romVer;
      if (k !== key) {
        key = k;
        for (let r = 0; r < 8; r++) {
          lab[r].textContent = hex4(0xF000 + (start + r) * 16);
          for (let c = 0; c < 16; c++) by[r * 16 + c].textContent = hex2(M.rom[(start + r) * 16 + c]);
        }
      }
      const row = (a >> 4) - start, col = a & 15;
      const nx = n.x + 138 + col * 62 - 27, ny = 1256 + row * 20 - 17;
      if (cur.__x !== nx || cur.__y !== ny) { cur.__x = nx; cur.__y = ny; cur.setAttribute('x', nx); cur.setAttribute('y', ny); }
    });
  }
};
const fmtVal = (v, f) => v === undefined || v === null ? '' : f === 'h2' ? '$' + hex2(v) : f === 'h4' ? '$' + hex4(v) : String(v);
LAY.N.forEach(n => {
  const g = S('g', { class: 'node k-' + n.kind, 'data-id': n.id, 'data-view': n.view }, gNodes);
  S('rect', { class: 'nb', x: n.x, y: n.y, width: n.w, height: n.h, rx: 8 }, g);
  S('text', { class: 'nl', x: n.x + 14, y: n.y + 30 }, g, n.label);
  if (n.sub && !n.custom) {
    const s = S('text', { class: 'ns d1', x: n.x + 14, y: n.y + (n.h >= 80 ? 56 : 52) }, g, n.sub);
    if (n.subKey) updaters.push(() => setT(s, disp[n.subKey] || n.sub));
  } else if (n.subKey) {
    const s = S('text', { class: 'ns d1', x: n.x + 14, y: n.y + 56 }, g, '');
    updaters.push(() => setT(s, disp[n.subKey] || ''));
  }
  if (n.val) {
    const top = n.h < 70 || n.w < 200;
    const v = S('text', { class: 'nv' + (top ? ' top' : ''), x: n.x + n.w - 14, y: top ? n.y + 34 : n.y + n.h / 2 + 14, 'text-anchor': 'end' }, g, '');
    updaters.push(() => setT(v, fmtVal(disp[n.val], n.fmt)));
  }
  if (n.custom) BUILD[n.custom](g, n);
  REG[n.id] = { el: g };
  INFO[n.id] = { label: n.label + (n.sub && !n.custom ? ' (' + n.sub.toLowerCase() + ')' : ''), desc: n.desc, kind: n.kind };
});

/* ================= lighting ================= */
const T = {}, active = new Set();
let FADE = 500;
function schedule(id, start, end, rev) {
  const r = REG[id]; if (!r) return;
  T[id] = { start, end }; active.add(id);
  if (r.rev !== !!rev) { r.rev = !!rev; r.el.classList.toggle('rev', !!rev); }
}
function setHeat(r, h) {
  if (Math.abs((r.h || 0) - h) < 0.01 && h !== 0 && h !== 1) return;
  r.h = h; r.el.style.setProperty('--h', h.toFixed(2));
  const lit = h > 0.05; if (r.lit !== lit) { r.lit = lit; r.el.classList.toggle('lit', lit); }
}
function updateLights(now, dt) {
  for (const id of active) {
    const t = T[id], r = REG[id]; let h;
    if (now < t.start) h = Math.max(0, (r.h || 0) - dt / FADE);
    else if (now <= t.end) h = 1;
    else { h = Math.max(0, 1 - (now - t.end) / FADE); if (h === 0) active.delete(id); }
    setHeat(r, h);
  }
}
function releaseLights(now) { for (const id of active) if (T[id].end > now) T[id].end = now; }
function clearLights() { active.clear(); for (const id in REG) { const r = REG[id]; if (r.h) setHeat(r, 0); } }

/* ================= camera ================= */
let cam = { cx: 1200, cy: 750, w: 2400 }, tw = null, curView = 'sys', viewLocked = true;
const svgSize = () => { const r = svg.getBoundingClientRect(); return { w: r.width || 900, h: r.height || 560 }; };
function lod(s) {
  svg.style.setProperty('--ov', clamp((0.52 - s) / 0.16, 0, 1).toFixed(3));
  svg.style.setProperty('--d1', clamp((s - 0.16) / 0.12, 0, 1).toFixed(3));
  svg.style.setProperty('--d2', clamp((s - 0.34) / 0.2, 0, 1).toFixed(3));
}
function applyCam() {
  const z = svgSize(), h = cam.w * z.h / z.w;
  svg.setAttribute('viewBox', (cam.cx - cam.w / 2).toFixed(1) + ' ' + (cam.cy - h / 2).toFixed(1) + ' ' + cam.w.toFixed(1) + ' ' + h.toFixed(1));
  lod(z.w / cam.w);
}
function fitView(v) { const z = svgSize(), ar = z.h / z.w; return { cx: v.x + v.w / 2, cy: v.y + v.h / 2, w: Math.max(v.w, v.h / ar) * 1.05 }; }
function flyTo(key, instant) {
  curView = key; markCrumb(key); viewLocked = true;
  const t = fitView(LAY.VIEWS[key]);
  if (instant) { cam = t; tw = null; applyCam(); } else tw = { from: Object.assign({}, cam), t, t0: performance.now(), ms: 700 };
}
function stepCam(now) {
  if (!tw) return;
  const p = clamp((now - tw.t0) / tw.ms, 0, 1), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  cam.w = Math.exp(Math.log(tw.from.w) + (Math.log(tw.t.w) - Math.log(tw.from.w)) * e);
  cam.cx = tw.from.cx + (tw.t.cx - tw.from.cx) * e; cam.cy = tw.from.cy + (tw.t.cy - tw.from.cy) * e;
  applyCam(); if (p >= 1) tw = null;
}
function zoomAt(cx, cy, f) {
  const r = svg.getBoundingClientRect(), W = r.width || 900, H = r.height || 560;
  const px = (cx - r.left) / W - .5, py = (cy - r.top) / H - .5;
  const wx = cam.cx + px * cam.w, wy = cam.cy + py * cam.w * H / W;
  const nw = clamp(cam.w * f, 220, 5200);
  cam.w = nw; cam.cx = wx - px * nw; cam.cy = wy - py * nw * H / W; applyCam();
}
const crumbs = $('#crumbs');
['sys', 'cpu', 'addr', 'ctrl', 'regs', 'alu', 'adder', 'tia', 'riot', 'ram', 'rom'].forEach(k => {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = LAY.VIEWS[k].name; b.dataset.view = k;
  b.addEventListener('click', () => { flyTo(k); dismissHint(); });
  crumbs.appendChild(b);
});
function markCrumb(k) { viewLocked = !!k; crumbs.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', b.dataset.view === k ? 'true' : 'false')); }

const ptrs = new Map(); let moved = 0, lastPinch = 0;
function dismissHint() { $('#hint').classList.add('gone'); }
svg.addEventListener('pointerdown', e => {
  try { svg.setPointerCapture(e.pointerId); } catch (_) { }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; tw = null;
  if (ptrs.size === 1) svg.classList.add('drag');
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; lastPinch = Math.hypot(a.x - b.x, a.y - b.y); }
});
svg.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) { hover(e); return; }
  const p = ptrs.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  const z = svgSize();
  if (ptrs.size === 1) {
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 6) { cam.cx -= dx * cam.w / z.w; cam.cy -= dy * cam.w / z.w; applyCam(); markCrumb(''); dismissHint(); }
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (lastPinch > 0 && d > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, lastPinch / d);
    lastPinch = d; moved += 10; markCrumb(''); dismissHint();
  }
});
function endPtr(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId); lastPinch = 0;
  if (!ptrs.size) svg.classList.remove('drag');
  if (e.type === 'pointerup' && moved < 7 && !ptrs.size) clickAt(e.clientX, e.clientY);
}
svg.addEventListener('pointerup', endPtr); svg.addEventListener('pointercancel', endPtr);
svg.addEventListener('wheel', e => { e.preventDefault(); tw = null; zoomAt(e.clientX, e.clientY, Math.exp(clamp(e.deltaY, -200, 200) * 0.0016)); markCrumb(''); dismissHint(); }, { passive: false });
$('#zIn').addEventListener('click', () => { const r = svg.getBoundingClientRect(); tw = null; zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.7); markCrumb(''); });
$('#zOut').addEventListener('click', () => { const r = svg.getBoundingClientRect(); tw = null; zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.4); markCrumb(''); });
$('#zFit').addEventListener('click', () => flyTo('sys'));
function onResize() { if (viewLocked && curView) flyTo(curView, true); else applyCam(); }
window.addEventListener('resize', onResize);
if (window.ResizeObserver) new ResizeObserver(onResize).observe(svg.parentNode);

let selId = null;
function clickAt(x, y) {
  dismissHint();
  const el = document.elementFromPoint(x, y), t = el && el.closest ? el.closest('[data-view]') : null;
  if (!t || !svg.contains(t)) return;
  selectPart(t.getAttribute('data-id'));
  flyTo(t.getAttribute('data-view'));
}
function selectPart(id) {
  if (selId && REG[selId]) REG[selId].el.classList.remove('sel');
  selId = id; if (REG[id]) REG[id].el.classList.add('sel');
  const i = INFO[id], box = $('#part');
  if (!i) return;
  box.innerHTML = '';
  const k = document.createElement('span'); k.className = 'chipk k-' + i.kind; k.style.color = 'var(--kc)';
  k.textContent = { addr: 'Addressing', data: 'Data path', ctl: 'Control', alu: 'ALU', chip: 'Peripheral' }[i.kind];
  const h = document.createElement('h3'); h.textContent = i.label;
  const p = document.createElement('p'); p.textContent = i.desc;
  box.append(k, h, p);
}
function showDefaultPart() {
  const box = $('#part'); box.innerHTML = '';
  const k = document.createElement('span'); k.className = 'chipk'; k.style.color = 'var(--mute)'; k.textContent = 'How to explore';
  const h = document.createElement('h3'); h.textContent = 'Tap any block';
  const p = document.createElement('p'); p.textContent = 'Tap a block to zoom in and read what it does. Amber wires carry addresses, teal wires carry data, pink wires are control and green wires are inside the ALU. Zoom into the adder while running the Carry ripple demo to watch a carry travel from bit to bit.';
  box.append(k, h, p);
}
const tip = $('#tip');
function hover(e) {
  if (e.pointerType && e.pointerType !== 'mouse') return;
  const t = e.target.closest ? e.target.closest('.node,.frame') : null;
  if (!t) { tip.classList.remove('on'); return; }
  const i = INFO[t.getAttribute('data-id')]; if (!i) return;
  tip.innerHTML = ''; const b = document.createElement('b'); b.textContent = i.label; tip.append(b, ' ' + i.desc.split('. ')[0].replace(/\.$/, '') + '.');
  tip.classList.add('on');
}
svg.addEventListener('pointerleave', () => tip.classList.remove('on'));

/* ================= program ================= */
let listingEls = new Map(), hiPC = -1;
function loadRomFromSource(src) {
  const r = A.assemble(src), err = $('#err');
  if (r.errors.length) { err.textContent = r.errors.map(e => 'Line ' + e.ln + ': ' + e.msg).join('\n'); return false; }
  err.textContent = '';
  M.loadRom(r.rom); romVer++;
  const L = $('#listing'); L.innerHTML = ''; listingEls = new Map();
  r.listing.forEach(l => {
    const d = document.createElement('div');
    const a = document.createElement('span'); a.className = 'a'; a.textContent = hex4(l.addr);
    const b = document.createElement('span'); b.className = 'b'; b.textContent = l.bytes.map(hex2).join(' ');
    const t = document.createElement('span'); t.textContent = l.text;
    d.append(a, b, t); L.appendChild(d); if (!listingEls.has(l.addr)) listingEls.set(l.addr, d);
  });
  resetMachine();
  return true;
}
function highlightPC(pc) {
  if (pc === hiPC) return;
  const o = listingEls.get(hiPC); if (o) o.classList.remove('cur');
  hiPC = pc; const n = listingEls.get(pc); if (n) { n.classList.add('cur'); const L = $('#listing'); if (L.scrollHeight > L.clientHeight) L.scrollTop = n.offsetTop - L.clientHeight / 2; }
}

/* ================= panels ================= */
const nowBox = $('#now');
let rtNote = false;
function renderNow() {
  rtNote = false;
  nowBox.innerHTML = '';
  if (!cur) {
    const p = document.createElement('p'); p.className = 'empty';
    p.textContent = 'Press Run to watch the program, or Step to execute one instruction at a time. Micro-step pauses after every bus cycle.';
    nowBox.appendChild(p); return;
  }
  const h = document.createElement('div'); h.className = 'ins';
  const a = document.createElement('span'); a.textContent = '$' + hex4(cur.info.pc) + '  ' + cur.text;
  const s = document.createElement('small'); s.textContent = (INS_DESC[cur.info.m] || 'Unofficial opcode') + ' · ' + cur.info.cycles + ' cycles · ' + cur.info.len + (cur.info.len > 1 ? ' bytes' : ' byte');
  h.append(a, s); nowBox.appendChild(h);
  const ol = document.createElement('ol'); ol.className = 'steps';
  cur.phases.forEach(p => { const li = document.createElement('li'); li.textContent = p.text; ol.appendChild(li); });
  nowBox.appendChild(ol); cur.ol = ol;
}
function markStep(idx) {
  if (!cur || !cur.ol) return;
  [...cur.ol.children].forEach((li, i) => { li.classList.toggle('done', i < idx); li.classList.toggle('cur', i === idx); });
  const li = cur.ol.children[idx]; if (li) cur.ol.scrollTop = li.offsetTop - cur.ol.clientHeight / 2 + li.offsetHeight / 2;
}
const regsEl = $('#regs'), regCells = {};
[['PC', 'pc'], ['A', 'a'], ['X', 'x'], ['Y', 'y'], ['S', 's'], ['P', 'p'], ['Cycles', 'cyc'], ['Scanline', 'line'], ['Frame', 'frm']].forEach(([l, k]) => {
  const d = document.createElement('div'); d.className = 'reg'; const s = document.createElement('span'); s.textContent = l; const b = document.createElement('b');
  d.append(s, b); regsEl.appendChild(d); regCells[k] = b;
});
const flagEls = [...'NV-BDIZC'].map(c => { const i = document.createElement('i'); i.textContent = c; $('#flagrow').appendChild(i); return i; });
const tvCanvas = $('#tv'), tvCtx = tvCanvas.getContext('2d'), beam = $('#beam');
const tvImg = new ImageData(new Uint8ClampedArray(M.tia.fb.buffer), 160, 192);
let tvDirty = true;
function renderPanels() {
  setT(regCells.pc, '$' + hex4(disp.pc)); setT(regCells.a, '$' + hex2(disp.a)); setT(regCells.x, '$' + hex2(disp.x)); setT(regCells.y, '$' + hex2(disp.y));
  setT(regCells.s, '$' + hex2(disp.s)); setT(regCells.p, '$' + hex2(disp.p)); setT(regCells.cyc, String(M.cycles)); setT(regCells.line, String(M.tia.line)); setT(regCells.frm, String(M.tia.frame));
  for (let i = 0; i < 8; i++) setC(flagEls[i], 'on', (disp.p >> (7 - i)) & 1);
  if (tvDirty) { if (tvCtx) tvCtx.putImageData(tvImg, 0, 0); tvDirty = false; }
  const bx = M.tia.hpos - 68, by = M.tia.line - 40;
  if (bx >= 0 && by >= 0 && by < 192) { beam.style.display = ''; beam.style.left = (bx / 160 * 100) + '%'; beam.style.top = (by / 192 * 100) + '%'; } else beam.style.display = 'none';
}

/* ================= sequencer ================= */
const SPEEDS = [['Slow', 1500], ['Medium', 750], ['Quick', 300], ['Blur', 0], ['Real time', 0]];
const FADES = [700, 500, 350, 380, 260];
let level = 1, mode = 'paused', cur = null, phaseEnd = 0, pendSets = [], prevOn = null, lastFocus = '', lastNowT = 0;

function syncDisp() {
  disp.pc = M.pc; disp.a = M.a; disp.x = M.x; disp.y = M.y; disp.s = M.s; disp.p = M.p;
  disp.ram.set(M.ram); disp.tia.set(M.tia.reg);
}
function applySet(o) {
  for (const k in o) {
    if (k === 'ramw') disp.ram[o.ramw[0]] = o.ramw[1];
    else if (k === 'tiaw') disp.tia[o.tiaw[0]] = o.tiaw[1];
    else if (k === 'opinfo') { disp.op = cur.info; disp.mnem = cur.info.m + ' ' + MODE[cur.info.mode]; }
    else disp[k] = o[k];
  }
}
function processSets(now) {
  if (!pendSets.length) return;
  const rest = [];
  pendSets.forEach(s => { if (s.at <= now) applySet(s.o); else rest.push(s); });
  pendSets = rest;
}
function describeIns(info, bytes) {
  const o = A.OPS[info.op];
  if (!o) return '.byte $' + hex2(info.op);
  return o.m + ' ' + A.fmtOperand(o, bytes[1] || 0, bytes[2] || 0, info.pc);
}
function newInstruction(now, quiet) {
  M.tracing = true;
  const info = M.step(), tr = M.tr.slice(), phases = PH.buildPhases(info, tr), bytes = tr.filter(e => e.t === 'fetch').map(e => e.val);
  cur = { info, phases, idx: -1, bytes, text: '' };
  cur.text = describeIns(info, bytes).trim();
  if (!quiet || now - lastNowT > 200) { renderNow(); lastNowT = now; } else cur.ol = null;
  highlightPC(info.pc); tvDirty = true;
}
function finishInstruction(now) {
  pendSets.forEach(s => applySet(s.o)); pendSets = [];
  syncDisp();
  if (prevOn) { prevOn = null; }
  if (cur) highlightPC(M.pc);
}
function startPhase(now) {
  if (prevOn && mode === 'micro') prevOn.forEach(([id]) => { if (T[id] && T[id].end > now) T[id].end = now; });
  pendSets.forEach(s => applySet(s.o)); pendSets = [];
  const ph = cur.phases[++cur.idx], dur = Math.max(60, SPEEDS[level][1] * ph.dur);
  const hold = mode === 'micro';
  ph.on.forEach(([id, t, rev]) => schedule(id, now + t * dur, hold ? Infinity : now + dur, rev));
  prevOn = ph.on;
  pendSets = pendSets.concat(ph.sets.map(([t, o]) => ({ at: now + t * dur, o })));
  disp.tcyc = ph.cyc; phaseEnd = now + dur;
  markStep(cur.idx);
  if ($('#follow').checked && ph.focus !== lastFocus && LAY.VIEWS[ph.focus]) { lastFocus = ph.focus; flyTo(ph.focus); }
}
function advance(now) {
  if (!cur || cur.idx >= cur.phases.length - 1) { if (cur) finishInstruction(now); newInstruction(now); }
  startPhase(now);
}
function instant(now) {
  if (cur) finishInstruction(now);
  newInstruction(now, true);
  cur.phases.forEach(ph => { ph.on.forEach(([id, t, rev]) => schedule(id, now, now, rev)); ph.sets.forEach(([t, o]) => applySet(o)); disp.tcyc = ph.cyc; });
  pendSets = []; syncDisp();
  highlightPC(M.pc);
}
const CHIP_LIGHT = { rom: ['f_rom', 'rom_arr'], tia: ['f_tia', 'tia_regs', 'tia_gen'], ram: ['f_riot', 'riot_ram'], timer: ['f_riot', 'riot_timer'], io: ['f_riot', 'riot_io'] };
function realtime(now, dt) {
  M.tracing = false;
  if (!rtNote) { rtNote = true; nowBox.innerHTML = ''; const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'Running at full speed: about 1.19 million CPU cycles per second, like the real console. Individual instructions go by too fast to follow, so the chips flash whenever they are accessed. Pause, or choose a slower speed, to watch single instructions.'; nowBox.appendChild(p); }
  const target = M.cycles + Math.min(dt, 50) * 1193.18, acc = { rom: 0, tia: 0, ram: 0, timer: 0, io: 0 };
  let guard = 0;
  while (M.cycles < target && guard++ < 80000) { M.step(); for (const k in acc) acc[k] += M.acc[k]; }
  syncDisp(); disp.romAddr = M.pc & 0xFFF; disp.ar = M.pc & 0x1FFF; disp.tcyc = 0; tvDirty = true;
  ['pc', 'ar', 'e_ar_pin', 'e_data_pin'].forEach(id => schedule(id, now, now + 40));
  for (const k in acc) if (acc[k]) CHIP_LIGHT[k].forEach(id => schedule(id, now, now + 40));
  highlightPC(M.pc);
}
function stopAll() { mode = 'paused'; updateButtons(); }
function resetMachine() {
  stopAll(); M.reset(); cur = null; pendSets = []; prevOn = null; phaseEnd = 0;
  clearLights(); syncDisp(); disp.ar = M.pc & 0x1FFF; disp.ir = undefined; disp.op = null; disp.mnem = ''; disp.tcyc = 0; disp.ain = disp.bin = disp.res = undefined;
  disp.binvtxt = ''; disp.logicop = ''; disp.shiftop = ''; disp.romAddr = M.pc & 0xFFF; disp.db = 0;
  M.tia.fb.fill(0xFF000000); tvDirty = true; renderNow(); highlightPC(M.pc);
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(now - last, 100); last = now;
  stepCam(now);
  if (mode === 'run' || mode === 'step') {
    if (level <= 2) {
      if (now >= phaseEnd) {
        if (mode === 'step' && cur && cur.idx >= cur.phases.length - 1 && cur.started) { finishInstruction(now); mode = 'paused'; updateButtons(); }
        else { advance(now); cur.started = true; }
      }
    } else if (level === 3) { instant(now); if (mode === 'step') stopAll(); }
    else { if (mode === 'step') { instant(now); stopAll(); } else realtime(now, dt); }
  }
  processSets(now);
  updateLights(now, dt);
  updaters.forEach(f => f());
  renderPanels();
  requestAnimationFrame(frame);
}

/* ================= controls ================= */
const ICON = {
  play: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z"/></svg>',
  pause: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2h3v10H3zM8 2h3v10H8z"/></svg>',
  step: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2v10l7-5zM10 2h2v10h-2z"/></svg>',
  micro: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2v10l6-5z"/><circle cx="11.5" cy="7" r="1.6"/></svg>',
  reset: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.5a5.5 5.5 0 1 0 5.5 5.5h-2A3.5 3.5 0 1 1 7 3.5V6l3.6-3.2L7 -.4z"/></svg>'
};
const bRun = $('#bRun'), bStep = $('#bStep'), bMicro = $('#bMicro'), bReset = $('#bReset');
function updateButtons() {
  const running = mode === 'run';
  bRun.innerHTML = (running ? ICON.pause : ICON.play) + '<span>' + (running ? 'Pause' : 'Run') + '</span>';
  bStep.innerHTML = ICON.step + '<span>Step</span>'; bMicro.innerHTML = ICON.micro + '<span>Micro-step</span>'; bReset.innerHTML = ICON.reset + '<span>Reset</span>';
}
bRun.addEventListener('click', () => {
  if (mode === 'run') { mode = 'paused'; }
  else { releaseLights(performance.now()); mode = 'run'; }
  updateButtons();
});
bStep.addEventListener('click', () => {
  const now = performance.now();
  if (level >= 3) { releaseLights(now); mode = 'step'; updateButtons(); return; }
  if (cur && cur.idx < cur.phases.length - 1) finishInstruction(now);
  releaseLights(now); cur = null; phaseEnd = 0; mode = 'step'; updateButtons();
});
bMicro.addEventListener('click', () => {
  const now = performance.now();
  if (mode !== 'micro') { mode = 'micro'; updateButtons(); }
  advance(now); cur.started = true;
});
bReset.addEventListener('click', resetMachine);
const speed = $('#speed'), speedOut = $('#speedOut');
function setLevel(v) {
  level = v; FADE = FADES[v]; speedOut.textContent = SPEEDS[v][0];
  if (v >= 4) { M.tracing = false; } else M.tracing = true;
}
speed.addEventListener('input', () => setLevel(+speed.value));

const demoSel = $('#demoSel'), src = $('#src');
DEMOS.forEach((d, i) => { const o = document.createElement('option'); o.value = i; o.textContent = d.name; demoSel.appendChild(o); });
function loadDemo(i) { const d = DEMOS[i]; src.value = d.src; $('#blurb').textContent = d.blurb; loadRomFromSource(d.src); }
demoSel.addEventListener('change', () => loadDemo(+demoSel.value));
$('#bAsm').addEventListener('click', () => loadRomFromSource(src.value));

/* ================= start ================= */
updateButtons(); setLevel(1);
loadDemo(0);
showDefaultPart();
renderNow();
applyCam(); flyTo('sys', true);
requestAnimationFrame(frame);
window.__explorer = { M, disp, get cur() { return cur; }, get mode() { return mode; }, flyTo, REG, T, setLevel };
})();
