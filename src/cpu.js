/* Atari 2600 core: 6507 CPU + TIA (video) + RIOT (6532) + 4K cartridge.
   The CPU records a datapath trace (this.tr) for the visualiser. */
(function (root) {
'use strict';

const FC = 1, FZ = 2, FI = 4, FD = 8, FB = 16, FU = 32, FV = 64, FN = 128;

const MODE_LEN = { imp: 1, acc: 1, imm: 2, zp: 2, zpx: 2, zpy: 2, izx: 2, izy: 2, rel: 2, abs: 3, abx: 3, aby: 3, ind: 3 };
const DEF = {
  ADC: { imm: 0x69, zp: 0x65, zpx: 0x75, abs: 0x6D, abx: 0x7D, aby: 0x79, izx: 0x61, izy: 0x71 },
  AND: { imm: 0x29, zp: 0x25, zpx: 0x35, abs: 0x2D, abx: 0x3D, aby: 0x39, izx: 0x21, izy: 0x31 },
  ASL: { acc: 0x0A, zp: 0x06, zpx: 0x16, abs: 0x0E, abx: 0x1E },
  BCC: { rel: 0x90 }, BCS: { rel: 0xB0 }, BEQ: { rel: 0xF0 }, BMI: { rel: 0x30 },
  BNE: { rel: 0xD0 }, BPL: { rel: 0x10 }, BVC: { rel: 0x50 }, BVS: { rel: 0x70 },
  BIT: { zp: 0x24, abs: 0x2C },
  BRK: { imp: 0x00 },
  CLC: { imp: 0x18 }, CLD: { imp: 0xD8 }, CLI: { imp: 0x58 }, CLV: { imp: 0xB8 },
  CMP: { imm: 0xC9, zp: 0xC5, zpx: 0xD5, abs: 0xCD, abx: 0xDD, aby: 0xD9, izx: 0xC1, izy: 0xD1 },
  CPX: { imm: 0xE0, zp: 0xE4, abs: 0xEC },
  CPY: { imm: 0xC0, zp: 0xC4, abs: 0xCC },
  DEC: { zp: 0xC6, zpx: 0xD6, abs: 0xCE, abx: 0xDE },
  DEX: { imp: 0xCA }, DEY: { imp: 0x88 },
  EOR: { imm: 0x49, zp: 0x45, zpx: 0x55, abs: 0x4D, abx: 0x5D, aby: 0x59, izx: 0x41, izy: 0x51 },
  INC: { zp: 0xE6, zpx: 0xF6, abs: 0xEE, abx: 0xFE },
  INX: { imp: 0xE8 }, INY: { imp: 0xC8 },
  JMP: { abs: 0x4C, ind: 0x6C },
  JSR: { abs: 0x20 },
  LDA: { imm: 0xA9, zp: 0xA5, zpx: 0xB5, abs: 0xAD, abx: 0xBD, aby: 0xB9, izx: 0xA1, izy: 0xB1 },
  LDX: { imm: 0xA2, zp: 0xA6, zpy: 0xB6, abs: 0xAE, aby: 0xBE },
  LDY: { imm: 0xA0, zp: 0xA4, zpx: 0xB4, abs: 0xAC, abx: 0xBC },
  LSR: { acc: 0x4A, zp: 0x46, zpx: 0x56, abs: 0x4E, abx: 0x5E },
  NOP: { imp: 0xEA },
  ORA: { imm: 0x09, zp: 0x05, zpx: 0x15, abs: 0x0D, abx: 0x1D, aby: 0x19, izx: 0x01, izy: 0x11 },
  PHA: { imp: 0x48 }, PHP: { imp: 0x08 }, PLA: { imp: 0x68 }, PLP: { imp: 0x28 },
  ROL: { acc: 0x2A, zp: 0x26, zpx: 0x36, abs: 0x2E, abx: 0x3E },
  ROR: { acc: 0x6A, zp: 0x66, zpx: 0x76, abs: 0x6E, abx: 0x7E },
  RTI: { imp: 0x40 }, RTS: { imp: 0x60 },
  SBC: { imm: 0xE9, zp: 0xE5, zpx: 0xF5, abs: 0xED, abx: 0xFD, aby: 0xF9, izx: 0xE1, izy: 0xF1 },
  SEC: { imp: 0x38 }, SED: { imp: 0xF8 }, SEI: { imp: 0x78 },
  STA: { zp: 0x85, zpx: 0x95, abs: 0x8D, abx: 0x9D, aby: 0x99, izx: 0x81, izy: 0x91 },
  STX: { zp: 0x86, zpy: 0x96, abs: 0x8E },
  STY: { zp: 0x84, zpx: 0x94, abs: 0x8C },
  TAX: { imp: 0xAA }, TAY: { imp: 0xA8 }, TSX: { imp: 0xBA }, TXA: { imp: 0x8A }, TXS: { imp: 0x9A }, TYA: { imp: 0x98 }
};
const OPS = new Array(256).fill(null);
for (const m in DEF) for (const md in DEF[m]) OPS[DEF[m][md]] = { m, mode: md, len: MODE_LEN[md], op: DEF[m][md] };

/* ---------------- assembler ---------------- */
const BRANCH = new Set(['BCC', 'BCS', 'BEQ', 'BMI', 'BNE', 'BPL', 'BVC', 'BVS']);
const hex2 = v => (v & 255).toString(16).toUpperCase().padStart(2, '0');
const hex4 = v => (v & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');

function assemble(src) {
  const lines = src.split(/\r?\n/);
  const errors = [];
  const syms = {};
  let listing = [];
  let rom = new Uint8Array(4096).fill(0xEA);
  const decisions = [];

  function num(t) {
    t = t.trim();
    if (/^\$[0-9a-fA-F]+$/.test(t)) return parseInt(t.slice(1), 16);
    if (/^%[01]+$/.test(t)) return parseInt(t.slice(1), 2);
    if (/^[0-9]+$/.test(t)) return parseInt(t, 10);
    return null;
  }
  function evalExpr(s, pass) {
    s = s.trim();
    let sel = null;
    if (s[0] === '<' || s[0] === '>') { sel = s[0]; s = s.slice(1).trim(); }
    const parts = s.replace(/\s+/g, '').match(/[+-]?[^+-]+/g);
    if (!parts) throw new Error('Empty expression');
    let v = 0, known = true;
    for (const p of parts) {
      let sign = 1, t = p;
      if (t[0] === '+') t = t.slice(1); else if (t[0] === '-') { sign = -1; t = t.slice(1); }
      let n = num(t);
      if (n === null) {
        if (Object.prototype.hasOwnProperty.call(syms, t)) n = syms[t];
        else if (pass === 1) { n = 0; known = false; }
        else throw new Error('Unknown symbol "' + t + '"');
      }
      v += sign * n;
    }
    if (sel === '<') v &= 255; else if (sel === '>') v = (v >> 8) & 255;
    return { v, known };
  }

  for (let pass = 1; pass <= 2; pass++) {
    let pc = 0xF000, di = 0;
    if (pass === 2) listing = [];
    lines.forEach((raw, ln) => {
      let line = raw.replace(/;.*$/, '').trim();
      if (!line) return;
      try {
        let m;
        while ((m = /^([A-Za-z_]\w*):\s*(.*)$/.exec(line))) {
          if (pass === 1) {
            if (Object.prototype.hasOwnProperty.call(syms, m[1])) throw new Error('Label "' + m[1] + '" defined twice');
            syms[m[1]] = pc;
          }
          line = m[2];
        }
        if (!line) return;
        if ((m = /^([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(line))) {
          if (pass === 1) syms[m[1]] = evalExpr(m[2], 1).v;
          return;
        }
        if ((m = /^\.?(org)\s+(.+)$/i.exec(line))) { pc = evalExpr(m[2], pass).v; return; }
        if ((m = /^\.?(byte|word)\s+(.+)$/i.exec(line))) {
          const isW = m[1].toLowerCase() === 'word';
          const bytes = [];
          m[2].split(',').forEach(e => {
            const r = evalExpr(e, pass).v;
            bytes.push(r & 255); if (isW) bytes.push((r >> 8) & 255);
          });
          if (pass === 2) { emit(pc, bytes); listing.push({ addr: pc, bytes, text: raw.trim(), ln }); }
          pc += bytes.length;
          return;
        }
        m = /^([A-Za-z]{3})\b\s*(.*)$/.exec(line);
        if (!m) throw new Error('Cannot read "' + line + '"');
        const mn = m[1].toUpperCase(); let opnd = m[2].trim();
        const def = DEF[mn];
        if (!def) throw new Error('Unknown instruction "' + mn + '"');
        let mode, expr = null;
        if (opnd === '' || /^a$/i.test(opnd)) mode = (def.acc !== undefined && (opnd !== '' || def.imp === undefined)) ? 'acc' : 'imp';
        else if (opnd[0] === '#') { mode = 'imm'; expr = opnd.slice(1); }
        else if ((m = /^\((.+),\s*x\)$/i.exec(opnd))) { mode = 'izx'; expr = m[1]; }
        else if ((m = /^\((.+)\)\s*,\s*y$/i.exec(opnd))) { mode = 'izy'; expr = m[1]; }
        else if ((m = /^\((.+)\)$/.exec(opnd))) { mode = 'ind'; expr = m[1]; }
        else if ((m = /^(.+),\s*x$/i.exec(opnd))) { mode = 'zpx?'; expr = m[1]; }
        else if ((m = /^(.+),\s*y$/i.exec(opnd))) { mode = 'zpy?'; expr = m[1]; }
        else { mode = BRANCH.has(mn) ? 'rel' : 'zp?'; expr = opnd; }
        let val = 0;
        if (expr !== null) {
          const r = evalExpr(expr, pass); val = r.v;
          if (mode.endsWith('?')) {
            let d;
            if (pass === 1) {
              const base = mode.slice(0, -1);
              const zpm = base === 'zp' ? 'zp' : base;
              d = (r.known && val >= 0 && val < 256 && def[zpm] !== undefined) ? zpm : (base === 'zp' ? 'abs' : base === 'zpx' ? 'abx' : 'aby');
              if (def[d] === undefined) d = zpm;
              decisions.push(d);
            } else d = decisions[di++];
            mode = d;
          }
        }
        const op = def[mode];
        if (op === undefined) throw new Error(mn + ' does not support that addressing mode');
        const bytes = [op];
        const len = MODE_LEN[mode];
        if (mode === 'rel') {
          let off = val - (pc + 2);
          if (pass === 2 && (off < -128 || off > 127)) throw new Error('Branch target is too far (' + off + ' bytes)');
          bytes.push(off & 255);
        } else if (len === 2) {
          if (pass === 2 && (val < -128 || val > 255)) throw new Error('Value ' + val + ' does not fit in one byte');
          bytes.push(val & 255);
        } else if (len === 3) { bytes.push(val & 255, (val >> 8) & 255); }
        if (pass === 2) { emit(pc, bytes); listing.push({ addr: pc, bytes, text: raw.trim(), ln }); }
        pc += len;
      } catch (e) { if (pass === 2 || !/Unknown symbol/.test(e.message)) errors.push({ ln: ln + 1, msg: e.message }); }
    });
  }
  function emit(addr, bytes) { bytes.forEach((b, i) => { const o = (addr + i) & 0xFFF; rom[o] = b; }); }
  const start = Object.prototype.hasOwnProperty.call(syms, 'start') ? syms.start : 0xF000;
  rom[0xFFC] = start & 255; rom[0xFFD] = (start >> 8) & 255;
  rom[0xFFE] = start & 255; rom[0xFFF] = (start >> 8) & 255;
  const seen = new Set(); const uniq = errors.filter(e => { const k = e.ln + e.msg; if (seen.has(k)) return false; seen.add(k); return true; });
  return { rom, listing, errors: uniq, syms };
}

/* ---------------- disassembler (for listing) ---------------- */
function fmtOperand(o, b1, b2, addr) {
  const w = b1 | (b2 << 8);
  switch (o.mode) {
    case 'imp': return '';
    case 'acc': return 'A';
    case 'imm': return '#$' + hex2(b1);
    case 'zp': return '$' + hex2(b1);
    case 'zpx': return '$' + hex2(b1) + ',X';
    case 'zpy': return '$' + hex2(b1) + ',Y';
    case 'abs': return '$' + hex4(w);
    case 'abx': return '$' + hex4(w) + ',X';
    case 'aby': return '$' + hex4(w) + ',Y';
    case 'ind': return '($' + hex4(w) + ')';
    case 'izx': return '($' + hex2(b1) + ',X)';
    case 'izy': return '($' + hex2(b1) + '),Y';
    case 'rel': return '$' + hex4(addr + 2 + ((b1 << 24) >> 24));
  }
  return '';
}

/* ---------------- TIA ---------------- */
const TIA_W = ['VSYNC', 'VBLANK', 'WSYNC', 'RSYNC', 'NUSIZ0', 'NUSIZ1', 'COLUP0', 'COLUP1', 'COLUPF', 'COLUBK', 'CTRLPF', 'REFP0', 'REFP1', 'PF0', 'PF1', 'PF2', 'RESP0', 'RESP1', 'RESM0', 'RESM1', 'RESBL', 'AUDC0', 'AUDC1', 'AUDF0', 'AUDF1', 'AUDV0', 'AUDV1', 'GRP0', 'GRP1', 'ENAM0', 'ENAM1', 'ENABL', 'HMP0', 'HMP1', 'HMM0', 'HMM1', 'HMBL', 'VDELP0', 'VDELP1', 'VDELBL', 'RESMP0', 'RESMP1', 'HMOVE', 'HMCLR', 'CXCLR'];
const HUES = [0, 48, 30, 12, 350, 320, 290, 255, 230, 210, 190, 165, 130, 100, 70, 45];
function hsl2rgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
const PALETTE = [];
for (let c = 0; c < 256; c++) {
  const hue = c >> 4, lum = (c >> 1) & 7;
  const [r, g, b] = hsl2rgb(HUES[hue], hue === 0 ? 0 : 62, 6 + lum * 12);
  PALETTE.push((255 << 24) | (b << 16) | (g << 8) | r);
}
const paletteCss = c => { const v = PALETTE[c & 0xFE]; return 'rgb(' + (v & 255) + ',' + ((v >> 8) & 255) + ',' + ((v >> 16) & 255) + ')'; };

const NUSIZ = { 0: { c: [0], s: 1 }, 1: { c: [0, 16], s: 1 }, 2: { c: [0, 32], s: 1 }, 3: { c: [0, 16, 32], s: 1 }, 4: { c: [0, 64], s: 1 }, 5: { c: [0], s: 2 }, 6: { c: [0, 32, 64], s: 1 }, 7: { c: [0], s: 4 } };

class TIA {
  constructor() { this.fb = new Uint32Array(160 * 192); this.reset(); }
  reset() {
    this.reg = new Uint8Array(64); this.hpos = 0; this.line = 0; this.frame = 0; this.wsync = false;
    this.p0x = 0; this.p1x = 0; this.m0x = 0; this.m1x = 0; this.blx = 0;
    this.gp0n = 0; this.gp1n = 0; this.gp0o = 0; this.gp1o = 0; this.blo = 0;
    this.cx = new Uint8Array(8); this.hmb = false;
    this.vs = false; this.sawSync = false; this.dirty = true; this.fire = false; this.fire1 = false; this.fb.fill(0xFF000000);
  }
  write(a, v) {
    if (a > 0x2C) return;
    this.reg[a] = v;
    switch (a) {
      case 0: { const on = !!(v & 2); if (on && !this.vs) { this.frame++; this.line = 0; this.sawSync = true; } this.vs = on; break; }
      case 2: this.wsync = true; break;
      case 0x10: this.p0x = this.pos(5); break;
      case 0x11: this.p1x = this.pos(5); break;
      case 0x12: this.m0x = this.pos(4); break;
      case 0x13: this.m1x = this.pos(4); break;
      case 0x14: this.blx = this.pos(4); break;
      case 0x1B: this.gp0n = v; this.gp1o = this.gp1n; break;
      case 0x1C: this.gp1n = v; this.gp0o = this.gp0n; this.blo = this.reg[0x1F] & 2; break;
      case 0x2A: {
        const mv = h => ((h >> 4) ^ 8) - 8;
        this.p0x = (this.p0x - mv(this.reg[0x20]) + 160) % 160;
        this.p1x = (this.p1x - mv(this.reg[0x21]) + 160) % 160;
        this.m0x = (this.m0x - mv(this.reg[0x22]) + 160) % 160;
        this.m1x = (this.m1x - mv(this.reg[0x23]) + 160) % 160;
        this.blx = (this.blx - mv(this.reg[0x24]) + 160) % 160;
        if (this.hpos < 76) this.hmb = true;   /* HMOVE during horizontal blank blanks the first 8 pixels */
        break;
      }
      case 0x2B: for (let i = 0x20; i <= 0x24; i++) this.reg[i] = 0; break;
      case 0x2C: this.cx.fill(0); break;
    }
  }
  /* Horizontal position that a RESxx strobe at the current colour clock produces. `d` is the object's latency. */
  pos(d) { const h = this.hpos; return h < 68 ? d - 2 : (h - 68 + d) % 160; }
  read(a) {
    a &= 0x0F;
    if (a < 8) { const c = this.cx[a]; return c; }
    if (a === 0x0C) return this.fire ? 0x00 : 0x80;
    if (a === 0x0D) return this.fire1 ? 0x00 : 0x80;
    if (a >= 8 && a <= 0x0B) return 0x80;
    return 0;
  }
  tick3() { for (let i = 0; i < 3; i++) this.clock(); }
  clock() {
    const h = this.hpos;
    if (h >= 68) {
      const x = h - 68, y = this.line - 40;
      const c = this.pixel(x);
      if (y >= 0 && y < 192) this.fb[y * 160 + x] = ((this.reg[1] & 2) || (this.hmb && x < 8)) ? 0xFF000000 : PALETTE[c];
    }
    if (++this.hpos >= 228) {
      this.hpos = 0; this.line++; this.hmb = false;
      if (this.line >= 262) { this.line = 0; if (!this.sawSync) this.frame++; this.sawSync = false; }
      if (this.line === 232) this.dirty = true;
    }
  }
  playerHit(x, px, grp, nusiz, refl) {
    if (!grp) return false;
    const n = NUSIZ[nusiz & 7];
    for (const off of n.c) {
      const dx = (x - px - off + 160) % 160;
      const w = 8 * n.s;
      if (dx < w) {
        const bit = (dx / n.s) | 0;
        if (refl ? (grp >> bit) & 1 : (grp >> (7 - bit)) & 1) return true;
      }
    }
    return false;
  }
  pfBit(idx) {
    const r = this.reg;
    if (idx < 4) return (r[0x0D] >> (4 + idx)) & 1;
    if (idx < 12) return (r[0x0E] >> (7 - (idx - 4))) & 1;
    return (r[0x0F] >> (idx - 12)) & 1;
  }
  pixel(x) {
    const r = this.reg;
    let idx = x >> 2, pf;
    if (idx < 20) pf = this.pfBit(idx);
    else pf = (r[0x0A] & 1) ? this.pfBit(39 - idx) : this.pfBit(idx - 20);
    const g0 = (r[0x25] & 1) ? this.gp0o : this.gp0n, g1 = (r[0x26] & 1) ? this.gp1o : this.gp1n;
    const p0 = this.playerHit(x, this.p0x, g0, r[4], r[0x0B] & 8);
    const p1 = this.playerHit(x, this.p1x, g1, r[5], r[0x0C] & 8);
    let m0 = false, m1 = false, bl = false;
    if (r[0x1D] & 2 && !(r[0x28] & 2)) m0 = ((x - this.m0x + 160) % 160) < (1 << ((r[4] >> 4) & 3));
    if (r[0x1E] & 2 && !(r[0x29] & 2)) m1 = ((x - this.m1x + 160) % 160) < (1 << ((r[5] >> 4) & 3));
    if ((r[0x27] & 1) ? this.blo : (r[0x1F] & 2)) bl = ((x - this.blx + 160) % 160) < (1 << ((r[0x0A] >> 4) & 3));
    /* collision latches, set whenever two objects overlap on a visible clock */
    const cx = this.cx;
    if (m0 || m1 || p0 || p1 || bl) {
      if (m0 && p1) cx[0] |= 0x80; if (m0 && p0) cx[0] |= 0x40;
      if (m1 && p0) cx[1] |= 0x80; if (m1 && p1) cx[1] |= 0x40;
      if (p0 && pf) cx[2] |= 0x80; if (p0 && bl) cx[2] |= 0x40;
      if (p1 && pf) cx[3] |= 0x80; if (p1 && bl) cx[3] |= 0x40;
      if (m0 && pf) cx[4] |= 0x80; if (m0 && bl) cx[4] |= 0x40;
      if (m1 && pf) cx[5] |= 0x80; if (m1 && bl) cx[5] |= 0x40;
      if (bl && pf) cx[6] |= 0x80;
      if (p0 && p1) cx[7] |= 0x80; if (m0 && m1) cx[7] |= 0x40;
    }
    const pfc = (r[0x0A] & 2) ? (x < 80 ? r[6] : r[7]) : r[8];
    const top = pf || bl;
    if ((r[0x0A] & 4) && top) return pfc;
    if (p0 || m0) return r[6];
    if (p1 || m1) return r[7];
    if (top) return pfc;
    return r[9];
  }
}

/* ---------------- RIOT ---------------- */
class RIOT {
  constructor() { this.reset(); }
  reset() { this.t = 0xFF; this.iv = 1024; this.cur = 1024; this.sub = 0; this.under = false; this.swcha = 0xFF; this.swchb = 0x0B; this.ddra = 0; this.ddrb = 0; }
  read(a) {
    if (a & 4) {
      if (a & 1) { const v = this.under ? 0x80 : 0; return v; }
      this.under = false; return this.t;
    }
    switch (a & 3) { case 0: return this.swcha; case 1: return this.ddra; case 2: return this.swchb; default: return this.ddrb; }
  }
  write(a, v) {
    if (a & 4) {
      if (a & 0x10) { this.iv = [1, 8, 64, 1024][a & 3]; this.cur = this.iv; this.t = v; this.sub = 0; this.under = false; }
      return;
    }
    switch (a & 3) { case 1: this.ddra = v; break; case 3: this.ddrb = v; break; }
  }
  tick() {
    if (++this.sub >= this.cur) {
      this.sub = 0;
      this.t = (this.t - 1) & 255;
      if (this.t === 255 && !this.under) { this.under = true; this.cur = 1; }
    }
  }
}

/* ---------------- machine ---------------- */
class Machine {
  constructor() {
    this.rom = new Uint8Array(4096); this.ram = new Uint8Array(128);
    this.tia = new TIA(); this.riot = new RIOT();
    this.tracing = true; this.tr = [];
    this.acc = { rom: 0, tia: 0, ram: 0, timer: 0, io: 0 };
    this.reset();
  }
  loadRom(r) { this.rom.set(r); this.reset(); }
  reset() {
    this.a = 0; this.x = 0; this.y = 0; this.s = 0xFD; this.p = 0x24; this.cycles = 0; this.tr.length = 0;
    this.ram.fill(0); this.tia.reset(); this.riot.reset();
    this.pc = this.rom[0xFFC] | (this.rom[0xFFD] << 8);
    this.halted = 0;
  }
  chipOf(addr) {
    addr &= 0x1FFF;
    if (addr & 0x1000) return 'rom';
    if (!(addr & 0x80)) return 'tia';
    if (!(addr & 0x200)) return 'ram';
    return (addr & 4) ? 'timer' : 'io';
  }
  read(addr) {
    addr &= 0x1FFF;
    if (addr & 0x1000) return this.rom[addr & 0xFFF];
    if (!(addr & 0x80)) return this.tia.read(addr);
    if (!(addr & 0x200)) return this.ram[addr & 0x7F];
    return this.riot.read(addr);
  }
  write(addr, v) {
    addr &= 0x1FFF;
    if (addr & 0x1000) return;
    if (!(addr & 0x80)) { this.tia.write(addr & 0x3F, v); return; }
    if (!(addr & 0x200)) { this.ram[addr & 0x7F] = v; return; }
    this.riot.write(addr, v);
  }
  cyc() { this.cycles++; this.tia.tick3(); this.riot.tick(); }
  ev(o) { if (this.tracing) this.tr.push(o); }
  idle(n, text, set) { for (let i = 0; i < n; i++) this.cyc(); this.ev({ t: 'idle', n, text: text || 'Internal cycle', set }); }

  fetch(kind) {
    const addr = this.pc & 0xFFFF;
    this.cyc();
    const v = this.read(addr);
    this.pc = (this.pc + 1) & 0xFFFF;
    const chip = this.chipOf(addr); this.acc[chip]++;
    this.ev({ t: 'fetch', kind, addr: addr & 0x1FFF, val: v, chip, set: kind === 'op' ? { pc: this.pc, ar: addr & 0x1FFF, db: v, ir: v } : { pc: this.pc, ar: addr & 0x1FFF, db: v } });
    return v;
  }
  rd(addr, tag) {
    addr &= 0x1FFF; this.cyc();
    const v = this.read(addr);
    const chip = this.chipOf(addr); this.acc[chip]++;
    this.ev({ t: 'read', addr, val: v, chip, tag, set: { ar: addr, db: v } });
    return v;
  }
  wr(addr, v, tag) {
    addr &= 0x1FFF; this.cyc();
    this.write(addr, v);
    const chip = this.chipOf(addr); this.acc[chip]++;
    this.ev({ t: 'write', addr, val: v, chip, tag, reg: chip === 'tia' ? TIA_W[addr & 0x3F] : null, set: { ar: addr, db: v } });
  }
  setNZ(v) { this.p = (this.p & ~(FN | FZ)) | (v & 0x80) | (v === 0 ? FZ : 0); }

  /* addressing: returns effective address, tracing address arithmetic */
  ea(mode, write) {
    switch (mode) {
      case 'zp': { const lo = this.fetch('operand'); return lo; }
      case 'zpx': case 'zpy': {
        const lo = this.fetch('operand'); const idx = mode === 'zpx' ? this.x : this.y; const a = (lo + idx) & 255;
        this.idle(1, 'Add ' + (mode === 'zpx' ? 'X' : 'Y') + ' to the zero-page address', null);
        this.ev({ t: 'ea', idx: mode === 'zpx' ? 'X' : 'Y', base: lo, idxv: idx, addr: a, cross: false, set: { ar: a } });
        return a;
      }
      case 'abs': { const lo = this.fetch('operand'); const hi = this.fetch('operand'); return lo | (hi << 8); }
      case 'abx': case 'aby': {
        const lo = this.fetch('operand'); const hi = this.fetch('operand'); const idx = mode === 'abx' ? this.x : this.y;
        const base = lo | (hi << 8), a = (base + idx) & 0xFFFF; const cross = (base & 0xFF00) !== (a & 0xFF00);
        this.ev({ t: 'ea', idx: mode === 'abx' ? 'X' : 'Y', base, idxv: idx, addr: a, cross, set: { ar: a & 0x1FFF } });
        if (cross || write) this.idle(1, cross ? 'Page crossed: extra cycle to fix the high byte' : 'Store: extra cycle', null);
        return a;
      }
      case 'izx': {
        const zp = this.fetch('operand'); const p = (zp + this.x) & 255;
        this.idle(1, 'Add X to the pointer address', null);
        this.ev({ t: 'ea', idx: 'X', base: zp, idxv: this.x, addr: p, cross: false, set: { ar: p } });
        const lo = this.rd(p, 'ptr'); const hi = this.rd((p + 1) & 255, 'ptr');
        return lo | (hi << 8);
      }
      case 'izy': {
        const zp = this.fetch('operand');
        const lo = this.rd(zp, 'ptr'); const hi = this.rd((zp + 1) & 255, 'ptr');
        const base = lo | (hi << 8), a = (base + this.y) & 0xFFFF; const cross = (base & 0xFF00) !== (a & 0xFF00);
        this.ev({ t: 'ea', idx: 'Y', base, idxv: this.y, addr: a, cross, set: { ar: a & 0x1FFF } });
        if (cross || write) this.idle(1, cross ? 'Page crossed: extra cycle to fix the high byte' : 'Store: extra cycle', null);
        return a;
      }
    }
    throw new Error('bad mode ' + mode);
  }
  operand(mode) {
    if (mode === 'imm') { const v = this.fetch('operand'); return { v, addr: null }; }
    const addr = this.ea(mode, false);
    return { v: this.rd(addr, 'data'), addr };
  }

  /* ---- ALU primitives (all traced) ---- */
  addCore(a, b, cin) {
    const cs = []; let c = cin, res = 0;
    for (let i = 0; i < 8; i++) {
      const ai = (a >> i) & 1, bi = (b >> i) & 1;
      const s = ai ^ bi ^ c, co = (ai & bi) | (ai & c) | (bi & c);
      res |= s << i; c = co; cs.push(co);
    }
    return { res, cs, cout: c };
  }
  aluAdd(op, a, b, src, dst, opts) {
    opts = opts || {};
    const sub = op === 'SBC' || op === 'CMP' || op === 'CPX' || op === 'CPY';
    const bb = sub ? (~b) & 255 : b;
    const cin = (op === 'ADC' || op === 'SBC') ? (this.p & FC) : (sub ? 1 : 0);
    const r = this.addCore(a, bb, cin);
    let res = r.res, cout = r.cout;
    let v = ((~(a ^ bb)) & (a ^ res) & 0x80) ? 1 : 0;
    let fl = '', dec = false;
    if ((op === 'ADC' || op === 'SBC') && (this.p & FD)) {
      dec = true;
      if (op === 'ADC') {
        let lo = (a & 15) + (b & 15) + cin; if (lo > 9) lo += 6;
        let hi = (a >> 4) + (b >> 4) + (lo > 15 ? 1 : 0);
        const tmp = ((hi << 4) | (lo & 15)) & 255;
        v = ((~(a ^ b)) & (a ^ tmp) & 0x80) ? 1 : 0;
        if (hi > 9) hi += 6;
        cout = hi > 15 ? 1 : 0;
        res = ((hi << 4) | (lo & 15)) & 255;
        this.zbin = r.res; this.ntmp = tmp;
      } else {
        let lo = (a & 15) - (b & 15) - (1 - cin), hi = (a >> 4) - (b >> 4);
        if (lo < 0) { lo -= 6; hi--; }
        if (hi < 0) hi -= 6;
        this.zbin = r.res; this.ntmp = r.res;
        res = ((hi << 4) | (lo & 15)) & 255;
      }
    }
    const zval = dec ? this.zbin : res, nval = dec ? this.ntmp : res;
    if (op === 'INC' || op === 'DEC' || op === 'INX' || op === 'INY' || op === 'DEX' || op === 'DEY') {
      this.setNZ(res); fl = 'NZ';
    } else if (op === 'CMP' || op === 'CPX' || op === 'CPY') {
      this.p = (this.p & ~(FN | FZ | FC)) | (nval & 0x80) | (zval === 0 ? FZ : 0) | (cout ? FC : 0); fl = 'NZC';
    } else {
      this.p = (this.p & ~(FN | FZ | FC | FV)) | (nval & 0x80) | (zval === 0 ? FZ : 0) | (cout ? FC : 0) | (v ? FV : 0); fl = 'NZCV';
    }
    this.ev({ t: 'alu', unit: 'add', op, src, a, b: bb, bRaw: b, res, cin, cout, cs: r.cs, dst, fl, dec, inv: sub, useCin: op === 'ADC' || op === 'SBC', set: { ain: a, bin: bb, res, p: this.p } });
    return res;
  }
  aluLogic(op, a, b, src, dst) {
    const res = op === 'AND' ? a & b : op === 'ORA' ? a | b : a ^ b;
    this.setNZ(res);
    this.ev({ t: 'alu', unit: 'logic', op, src, a, b, res, dst, fl: 'NZ', set: { ain: a, bin: b, res, p: this.p } });
    return res;
  }
  aluBit(a, b) {
    const res = a & b;
    this.p = (this.p & ~(FN | FV | FZ)) | (b & 0xC0) | (res === 0 ? FZ : 0);
    this.ev({ t: 'alu', unit: 'logic', op: 'BIT', src: 'A', a, b, res, dst: 'none', fl: 'NVZ', set: { ain: a, bin: b, res, p: this.p } });
  }
  aluShift(op, v, src, dst) {
    let res, c;
    const cin = this.p & FC;
    switch (op) {
      case 'ASL': c = (v >> 7) & 1; res = (v << 1) & 255; break;
      case 'LSR': c = v & 1; res = v >> 1; break;
      case 'ROL': c = (v >> 7) & 1; res = ((v << 1) | cin) & 255; break;
      default: c = v & 1; res = (v >> 1) | (cin << 7);
    }
    this.p = (this.p & ~(FN | FZ | FC)) | (res & 0x80) | (res === 0 ? FZ : 0) | (c ? FC : 0);
    this.ev({ t: 'alu', unit: 'shift', op, src, a: v, b: v, res, cin, cout: c, dst, fl: 'NZC', useCin: op === 'ROL' || op === 'ROR', set: { ain: v, bin: v, res, p: this.p } });
    return res;
  }
  load(reg, v, src) {
    this[reg] = v; this.setNZ(v);
    this.ev({ t: 'load', reg, val: v, src, set: { [reg]: v, p: this.p, db: v } });
  }
  push(v) {
    this.wr(0x100 | this.s, v, 'stack');
    this.s = (this.s - 1) & 255;
    this.ev({ t: 'sreg', s: this.s, dir: -1, set: { s: this.s } });
  }
  pull() {
    this.s = (this.s + 1) & 255;
    this.ev({ t: 'sreg', s: this.s, dir: 1, set: { s: this.s } });
    return this.rd(0x100 | this.s, 'stack');
  }
  branch(cond, name) {
    const off = this.fetch('operand'); const sOff = (off << 24) >> 24;
    const target = (this.pc + sOff) & 0xFFFF;
    if (cond) {
      const cross = (this.pc & 0xFF00) !== (target & 0xFF00);
      this.ev({ t: 'branch', taken: true, name, target, cross, set: {} });
      this.idle(1, 'Branch taken: add the offset to PC', null);
      if (cross) this.idle(1, 'Page crossed: extra cycle', null);
      this.pc = target;
      this.ev({ t: 'jump', target, viaAdder: true, set: { pc: target } });
    } else this.ev({ t: 'branch', taken: false, name, target, set: {} });
  }

  step() {
    this.tr.length = 0; const c0 = this.cycles, pc0 = this.pc;
    for (const k in this.acc) this.acc[k] = 0;
    const opc = this.fetch('op'); const o = OPS[opc];
    let info;
    if (!o) {
      this.idle(1, 'Unofficial opcode $' + hex2(opc) + ': treated as a NOP');
      info = { pc: pc0, op: opc, m: '???', mode: 'imp', len: 1, cycles: this.cycles - c0 };
    } else {
      this.exec(o);
      info = { pc: pc0, op: opc, m: o.m, mode: o.mode, len: o.len, cycles: this.cycles - c0 };
    }
    if (this.tia.wsync) {
      this.tia.wsync = false;
      let n = 0; while (this.tia.hpos !== 0) { this.cyc(); n++; }
      if (n) this.ev({ t: 'halt', n, set: {} });
      info.cycles = this.cycles - c0; info.halted = n;
    }
    return info;
  }

  exec(o) {
    const m = o.m, mode = o.mode;
    switch (m) {
      case 'LDA': { const r = this.operand(mode); this.load('a', r.v, 'db'); break; }
      case 'LDX': { const r = this.operand(mode); this.load('x', r.v, 'db'); break; }
      case 'LDY': { const r = this.operand(mode); this.load('y', r.v, 'db'); break; }
      case 'STA': { const a = this.ea(mode, true); this.ev({ t: 'regout', reg: 'a', val: this.a, set: { db: this.a } }); this.wr(a, this.a, 'data'); break; }
      case 'STX': { const a = this.ea(mode, true); this.ev({ t: 'regout', reg: 'x', val: this.x, set: { db: this.x } }); this.wr(a, this.x, 'data'); break; }
      case 'STY': { const a = this.ea(mode, true); this.ev({ t: 'regout', reg: 'y', val: this.y, set: { db: this.y } }); this.wr(a, this.y, 'data'); break; }
      case 'ADC': case 'SBC': { const r = this.operand(mode); this.a = this.aluAdd(m, this.a, r.v, 'A', 'a'); this.ev({ t: 'wb', reg: 'a', val: this.a, set: { a: this.a } }); break; }
      case 'CMP': { const r = this.operand(mode); this.aluAdd(m, this.a, r.v, 'A', 'none'); break; }
      case 'CPX': { const r = this.operand(mode); this.aluAdd(m, this.x, r.v, 'X', 'none'); break; }
      case 'CPY': { const r = this.operand(mode); this.aluAdd(m, this.y, r.v, 'Y', 'none'); break; }
      case 'AND': case 'ORA': case 'EOR': { const r = this.operand(mode); this.a = this.aluLogic(m, this.a, r.v, 'A', 'a'); this.ev({ t: 'wb', reg: 'a', val: this.a, set: { a: this.a } }); break; }
      case 'BIT': { const r = this.operand(mode); this.aluBit(this.a, r.v); break; }
      case 'ASL': case 'LSR': case 'ROL': case 'ROR': {
        if (mode === 'acc') { this.idle(1, 'Accumulator operand: no memory access'); this.a = this.aluShift(m, this.a, 'A', 'a'); this.ev({ t: 'wb', reg: 'a', val: this.a, set: { a: this.a } }); }
        else this.rmw(m, mode);
        break;
      }
      case 'INC': case 'DEC': this.rmw(m, mode); break;
      case 'INX': case 'INY': case 'DEX': case 'DEY': {
        const reg = (m[2] === 'X') ? 'x' : 'y'; const d = m[0] === 'I' ? 1 : 255;
        this.idle(1, 'Implied operand: internal cycle');
        this[reg] = this.aluAdd(m, this[reg], d, reg.toUpperCase(), reg);
        this.ev({ t: 'wb', reg, val: this[reg], set: { [reg]: this[reg] } });
        break;
      }
      case 'TAX': this.idle(1, 'Implied operand'); this.ev({ t: 'xfer', from: 'a', to: 'x', set: {} }); this.load('x', this.a, 'a'); break;
      case 'TAY': this.idle(1, 'Implied operand'); this.ev({ t: 'xfer', from: 'a', to: 'y', set: {} }); this.load('y', this.a, 'a'); break;
      case 'TXA': this.idle(1, 'Implied operand'); this.ev({ t: 'xfer', from: 'x', to: 'a', set: {} }); this.load('a', this.x, 'x'); break;
      case 'TYA': this.idle(1, 'Implied operand'); this.ev({ t: 'xfer', from: 'y', to: 'a', set: {} }); this.load('a', this.y, 'y'); break;
      case 'TSX': this.idle(1, 'Implied operand'); this.ev({ t: 'xfer', from: 's', to: 'x', set: {} }); this.load('x', this.s, 's'); break;
      case 'TXS': this.idle(1, 'Implied operand'); this.ev({ t: 'xfer', from: 'x', to: 's', set: {} }); this.s = this.x; this.ev({ t: 'load', reg: 's', val: this.s, src: 'x', noflags: true, set: { s: this.s, db: this.s } }); break;
      case 'CLC': this.idle(1, 'Clear carry flag', null); this.p &= ~FC; this.ev({ t: 'flag', text: 'C cleared', set: { p: this.p } }); break;
      case 'SEC': this.idle(1, 'Set carry flag', null); this.p |= FC; this.ev({ t: 'flag', text: 'C set', set: { p: this.p } }); break;
      case 'CLD': this.idle(1, 'Clear decimal flag', null); this.p &= ~FD; this.ev({ t: 'flag', text: 'D cleared', set: { p: this.p } }); break;
      case 'SED': this.idle(1, 'Set decimal flag', null); this.p |= FD; this.ev({ t: 'flag', text: 'D set', set: { p: this.p } }); break;
      case 'CLI': this.idle(1, 'Clear interrupt flag', null); this.p &= ~FI; this.ev({ t: 'flag', text: 'I cleared', set: { p: this.p } }); break;
      case 'SEI': this.idle(1, 'Set interrupt flag', null); this.p |= FI; this.ev({ t: 'flag', text: 'I set', set: { p: this.p } }); break;
      case 'CLV': this.idle(1, 'Clear overflow flag', null); this.p &= ~FV; this.ev({ t: 'flag', text: 'V cleared', set: { p: this.p } }); break;
      case 'NOP': this.idle(1, 'No operation'); break;
      case 'PHA': this.idle(1, 'Internal cycle'); this.ev({ t: 'regout', reg: 'a', val: this.a, set: { db: this.a } }); this.push(this.a); break;
      case 'PHP': this.idle(1, 'Internal cycle'); this.ev({ t: 'regout', reg: 'p', val: this.p | 0x30, set: { db: this.p | 0x30 } }); this.push(this.p | 0x30); break;
      case 'PLA': { this.idle(1, 'Internal cycle'); const v = this.pull(); this.load('a', v, 'db'); break; }
      case 'PLP': { this.idle(1, 'Internal cycle'); const v = this.pull(); this.p = (v & ~FB) | FU; this.ev({ t: 'load', reg: 'p', val: this.p, src: 'db', noflags: true, set: { p: this.p, db: v } }); break; }
      case 'JMP': {
        if (mode === 'abs') { const lo = this.fetch('operand'); const hi = this.fetch('operand'); this.pc = lo | (hi << 8); this.ev({ t: 'jump', target: this.pc, set: { pc: this.pc } }); }
        else {
          const lo = this.fetch('operand'); const hi = this.fetch('operand'); const p = lo | (hi << 8);
          const l = this.rd(p, 'ptr'); const h = this.rd((p & 0xFF00) | ((p + 1) & 0xFF), 'ptr');
          this.pc = l | (h << 8); this.ev({ t: 'jump', target: this.pc, set: { pc: this.pc } });
        }
        break;
      }
      case 'JSR': {
        const lo = this.fetch('operand'); this.idle(1, 'Internal cycle: stack pointer setup');
        const ret = this.pc; // address of the last byte of the JSR
        this.ev({ t: 'regout', reg: 'pc', val: ret >> 8, set: { db: ret >> 8 } });
        this.push((ret >> 8) & 255);
        this.ev({ t: 'regout', reg: 'pc', val: ret & 255, set: { db: ret & 255 } });
        this.push(ret & 255);
        const hi = this.fetch('operand'); this.pc = lo | (hi << 8);
        this.ev({ t: 'jump', target: this.pc, set: { pc: this.pc } });
        break;
      }
      case 'RTS': {
        this.idle(1, 'Internal cycle'); this.idle(1, 'Internal cycle: stack pointer setup', null);
        const lo = this.pull(); const hi = this.pull();
        this.idle(1, 'Increment the return address', null);
        this.pc = ((lo | (hi << 8)) + 1) & 0xFFFF;
        this.ev({ t: 'jump', target: this.pc, set: { pc: this.pc } });
        break;
      }
      case 'RTI': {
        this.idle(1, 'Internal cycle'); this.idle(1, 'Internal cycle');
        const p = this.pull(); this.p = (p & ~FB) | FU;
        this.ev({ t: 'load', reg: 'p', val: this.p, src: 'db', noflags: true, set: { p: this.p } });
        const lo = this.pull(); const hi = this.pull(); this.pc = lo | (hi << 8);
        this.ev({ t: 'jump', target: this.pc, set: { pc: this.pc } });
        break;
      }
      case 'BRK': {
        this.fetch('operand');
        const ret = this.pc;
        this.push((ret >> 8) & 255); this.push(ret & 255); this.push(this.p | 0x30);
        this.p |= FI;
        const lo = this.rd(0x1FFE, 'vector'), hi = this.rd(0x1FFF, 'vector');
        this.pc = lo | (hi << 8);
        this.ev({ t: 'jump', target: this.pc, set: { pc: this.pc, p: this.p } });
        break;
      }
      case 'BCC': this.branch(!(this.p & FC), m); break;
      case 'BCS': this.branch(!!(this.p & FC), m); break;
      case 'BNE': this.branch(!(this.p & FZ), m); break;
      case 'BEQ': this.branch(!!(this.p & FZ), m); break;
      case 'BPL': this.branch(!(this.p & FN), m); break;
      case 'BMI': this.branch(!!(this.p & FN), m); break;
      case 'BVC': this.branch(!(this.p & FV), m); break;
      case 'BVS': this.branch(!!(this.p & FV), m); break;
    }
  }
  rmw(m, mode) {
    const addr = this.ea(mode, true);
    const v = this.rd(addr, 'data');
    this.idle(1, 'Write the old value back (read-modify-write)', null);
    let res;
    if (m === 'INC') res = this.aluAdd('INC', v, 1, 'M', 'mem');
    else if (m === 'DEC') res = this.aluAdd('DEC', v, 255, 'M', 'mem');
    else res = this.aluShift(m, v, 'M', 'mem');
    this.wr(addr, res, 'data');
  }
}

const api = { Machine, TIA, RIOT, assemble, OPS, DEF, TIA_W, PALETTE, paletteCss, hex2, hex4, fmtOperand, FC, FZ, FI, FD, FB, FU, FV, FN };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Atari = api;
})(typeof window !== 'undefined' ? window : globalThis);
