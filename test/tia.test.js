/* TIA objects: missiles, ball, collisions, HMOVE, input. Drives the TIA directly, one colour clock at a time. */
const A = require('../src/cpu.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

function tia() { const t = new A.TIA(); t.line = 60; t.hpos = 0; return t; }
/* Run the TIA to the end of the current line; returns the framebuffer row for the line drawn. */
function row(t) { const y = t.line - 40; while (t.line === y + 40) t.clock(); return Array.from(t.fb.slice(y * 160, y * 160 + 160)); }
const lit = (r, bg) => r.map((v, i) => v !== bg && v !== 0xFF000000 ? i : -1).filter(i => i >= 0);
const BG = A.PALETTE[0] >>> 0, WHITE = A.PALETTE[0x0E] >>> 0;

let t = tia(); t.write(6, 0x0E); t.write(0x1D, 2); t.write(4, 0x20); /* M0 enabled, width 4 */
t.hpos = 100; t.write(0x12, 0); let r = row(t); const px = lit(r, BG);
ok(px.length === 4 && px[3] - px[0] === 3, 'missile 0 is 4 pixels wide: ' + px.join(','));
ok(r[px[0]] === WHITE, 'missile takes the player colour');

t = tia(); t.write(8, 0x0E); t.write(0x1F, 2); t.write(0x0A, 0x30); t.hpos = 120; t.write(0x14, 0);
r = row(t); ok(lit(r, BG).length === 8, 'ball width 8 from CTRLPF: ' + lit(r, BG).length);

/* HMOVE: $70 moves left 7, $80 moves right 8 */
t = tia(); t.write(6, 0x0E); t.write(0x1D, 2); t.hpos = 100; t.write(0x12, 0);
const x0 = t.m0x; t.write(0x22, 0x70); t.write(0x2A, 0); ok((x0 - t.m0x + 160) % 160 === 7, 'HMOVE $70 moves 7 left');
t.write(0x22, 0x80); t.write(0x2A, 0); ok((t.m0x - (x0 - 7) + 160) % 160 === 8, 'HMOVE $80 moves 8 right');
t.write(0x2B, 0); ok(t.reg[0x22] === 0, 'HMCLR clears motion');
t = tia(); t.write(9, 0x44); t.hpos = 10; t.write(0x2A, 0); r = row(t);
ok(r[0] === 0xFF000000 && r[8] !== 0xFF000000, 'HMOVE blanks the first 8 pixels of the line');

/* collisions */
t = tia(); t.write(0x1B, 0xFF); t.write(0x1C, 0xFF); t.write(6, 2); t.write(7, 4);
t.hpos = 100; t.write(0x10, 0); t.hpos = 100; t.write(0x11, 0); row(t);
ok(t.read(7) & 0x80, 'P0-P1 collision latches in CXPPMM');
ok(!(t.read(2) & 0xC0), 'no P0-PF collision without playfield');
t.write(0x2C, 0); ok(t.read(7) === 0, 'CXCLR clears collisions');
t = tia(); t.write(0x1B, 0xFF); t.write(0x0D, 0xF0); t.write(0x0E, 0xFF); t.write(0x0F, 0xFF); t.hpos = 120; t.write(0x10, 0); row(t);
ok(t.read(2) & 0x80, 'P0-PF collision latches in CXP0FB');
t = tia(); t.write(1, 2); t.write(0x1B, 0xFF); t.write(0x0D, 0xF0); t.write(0x0E, 0xFF); t.write(0x0F, 0xFF); t.hpos = 120; t.write(0x10, 0); t.line = 10; row(t);
ok(t.read(2) & 0x80, 'collisions are detected during VBLANK');
t = tia(); t.write(0x1F, 2); t.write(0x1D, 2); t.write(0x0D, 0xF0); t.hpos = 100; t.write(0x14, 0); t.hpos = 100; t.write(0x12, 0); row(t);
ok(t.read(4) & 0x40, 'M0-BL collision latches in CXM0FB bit 6');

/* input */
t = tia(); ok(t.read(0x0C) === 0x80, 'fire released reads with bit 7 set'); t.fire = true; ok(t.read(0x0C) === 0, 'fire pressed reads 0');
t.fire1 = true; ok(t.read(0x0D) === 0, 'second fire button');

/* vertical delay */
t = tia(); t.write(0x1B, 0xFF); ok(t.gp0n === 0xFF, 'GRP0 latches new value'); t.write(0x1C, 0x81); ok(t.gp0o === 0xFF, 'writing GRP1 copies GRP0 to its delayed copy');

/* joystick reaches the CPU through RIOT */
const m = new A.Machine(); m.loadRom(A.assemble('start: LDA $280\nSTA $80\nJMP start').rom); m.riot.swcha = 0xEF;
for (let i = 0; i < 3; i++) m.step(); ok(m.ram[0] === 0xEF, 'SWCHA read by the program');
console.log(fails ? 'FAILURES ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
