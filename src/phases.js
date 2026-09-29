/* Turns a machine trace into animation phases.
   phase = { on:[[id, startFraction, reversed]], sets:[[fraction, displayChanges]], text, focus, dur, cyc, kind } */
(function (root) {
const hex2 = v => (v & 255).toString(16).toUpperCase().padStart(2, '0');
const hex4 = v => (v & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');

const CHIP_NAME = { rom: 'cartridge ROM', tia: 'TIA', ram: 'RIOT RAM', timer: 'RIOT timer', io: 'RIOT I/O' };
const CHIP_VIEW = { rom: 'rom', tia: 'tia', ram: 'ram', timer: 'riot', io: 'riot' };
const CHIP_ADDR = { tia: ['e_a_tia'], rom: ['e_a_up', 'e_a_rom'], ram: ['e_a_up', 'e_a_riot'], timer: ['e_a_up', 'e_a_riot'], io: ['e_a_up', 'e_a_riot'] };
const CHIP_DATA = { rom: ['e_d_low', 'e_d_mid'], tia: ['e_d_tia', 'e_d_up'], ram: ['e_lbus_ram', 'e_d_riot', 'e_d_mid'], timer: ['e_lbus_timer', 'e_d_riot', 'e_d_mid'], io: ['e_lbus_io', 'e_d_riot', 'e_d_mid'] };
function chipNodes(chip, addr) {
  switch (chip) {
    case 'rom': return ['f_rom', 'rom_arr', 'romcur'];
    case 'tia': return ['f_tia', 'tia_dec', 'e_tia_dec_regs', 'tia_regs'];
    case 'ram': return ['f_riot', 'riot_dec', 'e_dec_ram', 'riot_ram', 'ram_' + (addr & 0x7F)];
    case 'timer': return ['f_riot', 'riot_dec', 'e_dec_timer', 'riot_timer'];
    default: return ['f_riot', 'riot_dec', 'e_dec_timer', 'e_tim_io', 'riot_io'];
  }
}
const TIA_EXTRA = (reg) => {
  if (!reg) return [];
  if (reg === 'WSYNC') return ['e_regs_wsync', 'tia_wsync'];
  if (/^RES/.test(reg)) return ['e_regs_gen', 'tia_gen', 'e_clk_gen', 'tia_clk'];
  if (/^COL/.test(reg)) return ['e_regs_mux', 'tia_mux', 'e_mux_out', 'tia_out'];
  if (/^(PF|GRP|NUSIZ|CTRLPF|REFP|ENA|ENAB)/.test(reg)) return ['e_regs_gen', 'tia_gen'];
  if (/^(VSYNC|VBLANK)/.test(reg)) return ['e_mux_out', 'tia_out'];
  return [];
};

/* address then data, in either direction, staggered over the phase */
function accessOn(on, chip, addr, dir, t0) {
  const add = (id, t, rev) => on.push([id, t, !!rev]);
  add('ar', t0); add('e_ar_pin', t0 + 0.05);
  CHIP_ADDR[chip].forEach((id, i) => add(id, t0 + 0.12 + i * 0.04));
  chipNodes(chip, addr).forEach((id, i) => add(id, t0 + 0.28 + i * 0.02));
  const d = CHIP_DATA[chip];
  if (dir === 'r') {
    d.forEach((id, i) => add(id, t0 + 0.5 + i * 0.05, true));
    add('e_data_pin', t0 + 0.5 + d.length * 0.05, true);
    add('buf', t0 + 0.7); add('e_db_buf', t0 + 0.75, true); add('e_db', t0 + 0.8, true);
  } else {
    add('e_db', t0 + 0.4); add('e_db_buf', t0 + 0.45); add('buf', t0 + 0.5); add('e_data_pin', t0 + 0.55);
    d.slice().reverse().forEach((id, i) => add(id, t0 + 0.62 + i * 0.05));
  }
}
function ripple(a, b, c) {
  const cs = []; let res = 0;
  for (let i = 0; i < 8; i++) {
    const ai = (a >> i) & 1, bi = (b >> i) & 1; const s = ai ^ bi ^ c, co = (ai & bi) | (ai & c) | (bi & c);
    res |= s << i; c = co; cs.push(co);
  }
  return { res, cs };
}
function adderOn(on, cs, t0, span, cin) {
  const add = (id, t, rev) => on.push([id, t, !!rev]);
  if (cin) { add('p', t0 - 0.1); add('e_p_cin', t0 - 0.05); add('k_in', t0); }
  for (let b = 0; b < 8; b++) {
    const t = t0 + span * b / 8;
    add('cell' + b, t);
    if (cs[b]) add('k' + b, t + span / 16);
  }
}
const REGN = { a: 'A', x: 'X', y: 'Y', s: 'S', p: 'P' };
const flagsTxt = fl => fl ? ' Flags ' + fl.split('').join(' ') + ' updated.' : '';

function buildPhases(info, tr) {
  const phases = []; let cyc = 0;
  const mode = info.mode;
  for (let i = 0; i < tr.length; i++) {
    const e = tr[i], nxt = tr[i + 1];
    const on = [], sets = []; let text = '', focus = 'cpu', dur = 1, kind = 'cpu';
    const add = (id, t, rev) => on.push([id, t, !!rev]);
    switch (e.t) {
      case 'fetch': {
        cyc++; focus = 'cpu'; kind = 'fetch';
        add('pc', 0); add('e_pc_ar', 0.05); add('ar', 0.1);
        accessOn(on, e.chip, e.addr, 'r', 0);
        add('e_pc_inc', 0.3); add('inc', 0.36); add('e_inc_pc', 0.42);
        sets.push([0, { ar: e.addr }], [0.45, { pc: e.set.pc }], [0.6, { db: e.val }]);
        if (e.chip === 'rom') sets.push([0.28, { romAddr: e.addr & 0xFFF }]);
        if (e.kind === 'op') {
          add('e_db_ir', 0.86); add('ir', 0.9); add('e_ir_dec', 0.93); add('dec', 0.95); add('tim', 0.97);
          sets.push([0.9, { ir: e.val, opinfo: true }]);
          text = 'Fetch the opcode $' + hex2(e.val) + ' from $' + hex4(e.addr) + '. It goes into the instruction register and the decoder takes over.';
        } else {
          if (mode === 'rel') { add('e_db_alub', 0.86); add('bin', 0.92); }
          else if (mode !== 'imm') { add('e_db_ar', 0.86); }
          text = 'Fetch operand byte $' + hex2(e.val) + ' from $' + hex4(e.addr) + (mode === 'imm' ? '. It is the value itself.' : mode === 'rel' ? '. It is the branch offset.' : '. It is part of an address.');
        }
        break;
      }
      case 'read': {
        cyc++; focus = CHIP_VIEW[e.chip]; kind = 'mem';
        accessOn(on, e.chip, e.addr, 'r', 0);
        if (e.tag === 'ptr') { add('e_db_ar', 0.9); }
        if (e.tag === 'vector') { add('e_db_pc', 0.9); add('pc', 0.95); }
        sets.push([0, { ar: e.addr }], [0.6, { db: e.val }]);
        if (e.chip === 'rom') sets.push([0.28, { romAddr: e.addr & 0xFFF }]);
        const what = e.tag === 'stack' ? 'Pull' : e.tag === 'ptr' ? 'Read pointer byte' : e.tag === 'vector' ? 'Read vector byte' : 'Read';
        text = what + ' $' + hex2(e.val) + ' from $' + hex4(e.addr) + ' (' + CHIP_NAME[e.chip] + (e.chip === 'io' || e.chip === 'timer' ? '' : '') + ').';
        break;
      }
      case 'write': {
        cyc++; focus = CHIP_VIEW[e.chip]; kind = 'mem';
        accessOn(on, e.chip, e.addr, 'w', 0);
        if (e.chip === 'tia') { if (e.reg) add('tr_' + e.reg, 0.85); TIA_EXTRA(e.reg).forEach((id, k) => add(id, 0.85 + k * 0.02)); }
        const s = { ar: e.addr, db: e.val };
        sets.push([0, { ar: e.addr }]);
        if (e.chip === 'ram') sets.push([0.85, { ramw: [e.addr & 0x7F, e.val] }]);
        if (e.chip === 'tia') sets.push([0.85, { tiaw: [e.addr & 0x3F, e.val] }]);
        const where = e.chip === 'tia' && e.reg ? e.reg + ' (TIA $' + hex2(e.addr & 0x3F) + ')' : '$' + hex4(e.addr) + ' (' + CHIP_NAME[e.chip] + ')';
        text = (e.tag === 'stack' ? 'Push' : 'Write') + ' $' + hex2(e.val) + ' to ' + where + '.' + (e.reg === 'WSYNC' ? ' The CPU will now be halted until the scanline ends.' : '');
        break;
      }
      case 'ea': {
        focus = 'alu'; kind = 'alu';
        const r = ripple(e.base & 255, e.idxv, 0);
        const rg = e.idx.toLowerCase();
        add(rg, 0); add('e_' + rg + '_sb', 0.06); add('e_sb', 0.12); add('e_sb_ain', 0.16); add('ain', 0.2);
        add('e_db_alub', 0.1); add('bin', 0.2);
        add('e_ain_add', 0.28); add('e_bin_binv', 0.26); add('binv', 0.3); add('e_binv_add', 0.34); add('adder', 0.36);
        adderOn(on, r.cs, 0.38, 0.4, 0);
        add('e_add_res', 0.8); add('res', 0.84); add('e_res_db', 0.88); add('e_db', 0.92); add('e_db_ar', 0.95); add('ar', 0.98);
        sets.push([0.05, { ain: e.idxv, bin: e.base & 255, binvtxt: 'off' }], [0.7, { res: (e.base + e.idxv) & 255 }], [0.95, { ar: e.addr & 0x1FFF }]);
        text = 'Effective address: $' + hex4(e.base) + ' + ' + e.idx + ' ($' + hex2(e.idxv) + ') = $' + hex4(e.addr) + (e.cross ? ' (the low byte carried into the high byte).' : '.');
        break;
      }
      case 'alu': {
        focus = e.unit === 'add' ? 'alu' : 'alu'; kind = 'alu';
        const srcReg = e.src === 'A' ? 'a' : e.src === 'X' ? 'x' : e.src === 'Y' ? 'y' : null;
        const constB = /^(INX|INY|DEX|DEY)$/.test(e.op);
        if (e.unit === 'shift') {
          if (e.src === 'A') { add('a', 0); add('e_db_a', 0.05, true); add('e_db', 0.1); }
          add('e_db_alub', 0.15); add('bin', 0.22);
          add('e_bin_shift', 0.3); add('shift', 0.36);
          if (e.useCin) { add('p', 0.3); add('e_p_cin', 0.34); }
          add('e_shift_res', 0.6); add('res', 0.68);
          sets.push([0.2, { bin: e.a, ain: e.a, shiftop: e.op }], [0.68, { res: e.res }]);
        } else if (e.unit === 'logic') {
          if (srcReg) { add(srcReg, 0); add('e_' + srcReg + '_sb', 0.05); add('e_sb', 0.1); add('e_sb_ain', 0.14); add('ain', 0.2); }
          add('e_db_alub', 0.1); add('bin', 0.2);
          add('e_ain_logic', 0.3); add('e_bin_logic', 0.3); add('logic', 0.4);
          add('e_logic_res', 0.62); add('res', 0.7);
          sets.push([0.2, { ain: e.a, bin: e.b, logicop: e.op }], [0.7, { res: e.res }]);
        } else {
          if (srcReg) { add(srcReg, 0); add('e_' + srcReg + '_sb', 0.05); add('e_sb', 0.1); add('e_sb_ain', 0.14); add('ain', 0.2); }
          else { add('e_db_alub', 0.05); }
          if (constB) { add('dec', 0.05); add('e_ctl', 0.1); }
          else if (srcReg) { add('e_db_alub', 0.1); }
          add('bin', 0.2);
          add('e_ain_add', 0.28); add('e_bin_binv', 0.26); add('binv', 0.3); add('e_binv_add', 0.34); add('adder', 0.36);
          if (e.inv) add('binv', 0.3);
          if (e.dec) add('bcd', 0.75);
          adderOn(on, e.cs, 0.38, 0.4, e.useCin && e.cin);
          add('e_add_res', 0.8); add('res', 0.84);
          sets.push([0.2, { ain: e.a, bin: e.b, binvtxt: e.inv ? 'ON' : 'off' }], [0.84, { res: e.res }]);
        }
        const dstReg = e.dst === 'a' || e.dst === 'x' || e.dst === 'y' ? e.dst : null;
        if (dstReg) { add('e_res_db', 0.88); add('e_db', 0.9); add('e_db_' + dstReg, 0.93); add(dstReg, 0.96); }
        else if (e.dst === 'mem') { add('e_res_db', 0.88); add('e_db', 0.92); }
        add('e_alu_p', 0.9); add('p', 0.96);
        const late = { p: e.set.p }; if (dstReg) late[dstReg] = e.res;
        sets.push([0.95, late]);
        const opn = e.op, hx = v => '$' + hex2(v);
        if (e.unit === 'add') {
          if (/^(CMP|CPX|CPY)$/.test(opn)) text = opn + ': ' + hx(e.a) + ' - ' + hx(e.bRaw) + ' (subtract, keep flags only, result thrown away).';
          else if (opn === 'SBC') text = 'SBC: ' + hx(e.a) + ' - ' + hx(e.bRaw) + ' - (1 - C) = ' + hx(e.res) + '. B is inverted and the carry is the borrow.';
          else if (opn === 'ADC') text = 'ADC: ' + hx(e.a) + ' + ' + hx(e.b) + ' + C(' + e.cin + ') = ' + hx(e.res) + (e.cout ? ', carry out = 1.' : ', carry out = 0.') + (e.dec ? ' Decimal mode: the result is BCD-corrected.' : '');
          else text = opn + ': ' + hx(e.a) + ' ' + (/^(DEC|DEX|DEY)$/.test(opn) ? '- 1' : '+ 1') + ' = ' + hx(e.res) + '.';
        } else if (e.unit === 'logic') {
          text = opn === 'BIT' ? 'BIT: ' + hx(e.a) + ' AND ' + hx(e.b) + ' sets Z; bits 7 and 6 of the memory byte are copied into N and V.' : opn + ': ' + hx(e.a) + ' ' + (opn === 'AND' ? 'AND' : opn === 'ORA' ? 'OR' : 'XOR') + ' ' + hx(e.b) + ' = ' + hx(e.res) + '.';
        } else text = opn + ': ' + hx(e.a) + ' becomes ' + hx(e.res) + ', carry out = ' + e.cout + '.';
        text += flagsTxt(e.fl);
        if (nxt && nxt.t === 'wb') { i++; }
        break;
      }
      case 'wb': continue;
      case 'load': {
        kind = 'cpu';
        add('e_db_' + e.reg, 0.15); add(e.reg, 0.35);
        if (!e.noflags) { add('e_db_p', 0.4); add('p', 0.55); }
        sets.push([0, { db: e.val }], [0.35, { [e.reg]: e.val }]);
        if (!e.noflags) sets.push([0.55, { p: e.set.p }]);
        text = 'Load ' + REGN[e.reg] + ' with $' + hex2(e.val) + (e.noflags ? '.' : ' and update the N and Z flags.');
        dur = 0.8;
        break;
      }
      case 'regout': {
        const r = e.reg;
        add(r, 0); add('e_db_' + r, 0.15, true); add('e_db', 0.35);
        sets.push([0.35, { db: e.val }]);
        text = (r === 'pc' ? 'PC' : REGN[r]) + ' drives $' + hex2(e.val) + ' onto the data bus.';
        dur = 0.65;
        break;
      }
      case 'xfer': {
        add(e.from, 0); add('e_db_' + e.from, 0.15, true); add('e_db', 0.35);
        text = 'Copy ' + REGN[e.from] + ' onto the internal bus.';
        dur = 0.6;
        break;
      }
      case 'sreg': {
        add('s', 0); add('e_s_sb', 0.06); add('e_sb', 0.12); add('e_sb_ain', 0.16); add('ain', 0.2);
        add('e_ain_add', 0.3); add('adder', 0.4); add('e_add_res', 0.55); add('res', 0.62);
        add('e_res_db', 0.7); add('e_db', 0.76); add('e_db_s', 0.84); add('s', 0.9);
        sets.push([0.15, { ain: e.s - e.dir & 255, res: e.s }], [0.9, { s: e.s }]);
        text = 'Stack pointer ' + (e.dir < 0 ? 'decrements' : 'increments') + ' to $' + hex2(e.s) + '.';
        dur = 0.9; focus = 'regs';
        break;
      }
      case 'idle': {
        if (nxt && nxt.t === 'ea') { cyc += e.n; continue; }
        cyc += e.n;
        add('tim', 0); add('dec', 0.1);
        text = e.text || 'Internal cycle.';
        dur = 0.5; kind = 'idle';
        break;
      }
      case 'branch': {
        add('p', 0); add('dec', 0.3); add('tim', 0.5);
        text = e.name + ': the flag test ' + (e.taken ? 'passes, so the branch is taken.' : 'fails, so execution falls through to the next instruction.');
        dur = 0.7;
        break;
      }
      case 'jump': {
        if (e.viaAdder) {
          ['e_db_alub', 'bin', 'e_bin_binv', 'binv', 'e_binv_add', 'adder', 'e_add_res', 'res', 'e_res_db', 'e_db', 'e_db_pc', 'pc'].forEach((id, k) => add(id, k * 0.075));
          focus = 'alu';
          text = 'Add the signed offset to PC: the new address is $' + hex4(e.target) + '.';
        } else {
          add('e_db_pc', 0.2); add('pc', 0.4);
          text = 'PC is loaded with $' + hex4(e.target) + '.';
        }
        sets.push([0.9, { pc: e.target }]);
        break;
      }
      case 'flag': {
        add('dec', 0); add('tim', 0.2); add('p', 0.5);
        sets.push([0.5, { p: e.set.p }]);
        text = 'Flag change: ' + e.text + '.';
        dur = 0.6;
        break;
      }
      case 'halt': {
        add('tia_wsync', 0); add('f_tia', 0); add('e_rdy', 0.1); add('tim', 0.6); add('f_cpu', 0.6);
        text = 'WSYNC: RDY is held low, so the CPU sits idle for ' + e.n + ' cycles (' + (e.n * 3) + ' colour clocks) until the beam reaches the end of the scanline.';
        dur = 1.3; focus = 'tia'; kind = 'halt';
        break;
      }
      default: continue;
    }
    phases.push({ on, sets, text, focus, dur, cyc, kind });
  }
  return phases;
}
const api = { buildPhases };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PHASES = api;
})(typeof window !== 'undefined' ? window : globalThis);
