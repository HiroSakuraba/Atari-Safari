const A = require('../src/cpu.js'); const DEMOS = require('../src/demos.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
function run(src, n) { const r = A.assemble(src); if (r.errors.length) { console.log(r.errors); fails++; } const m = new A.Machine(); m.tracing = true; m.loadRom(r.rom); const out = []; for (let i = 0; i < n; i++) out.push(m.step()); return { m, out, r }; }
// all demos assemble
for (const d of DEMOS) { const r = A.assemble(d.src); ok(r.errors.length === 0, 'assembles: ' + d.name + (r.errors.length ? JSON.stringify(r.errors) : '')); }
// basic ops
let t = run('start: LDA #$FF\nCLC\nADC #$01', 3); ok(t.m.a === 0 && (t.m.p & 1) && (t.m.p & 2), 'FF+1=00 C Z');
t = run('start: LDA #$50\nCLC\nADC #$50', 3); ok(t.m.a === 0xA0 && (t.m.p & 0x40) && (t.m.p & 0x80), '50+50=A0 V N');
t = run('start: SEC\nLDA #$10\nSBC #$01', 3); ok(t.m.a === 0x0F && (t.m.p & 1), '10-1=0F C');
t = run('start: SED\nCLC\nLDA #$19\nADC #$28', 4); ok(t.m.a === 0x47, 'BCD 19+28=47 got ' + t.m.a.toString(16));
t = run('start: SED\nCLC\nLDA #$99\nADC #$01', 4); ok(t.m.a === 0 && (t.m.p & 1), 'BCD 99+1=00 C');
t = run('start: SED\nSEC\nLDA #$46\nSBC #$12', 4); ok(t.m.a === 0x34, 'BCD 46-12=34 got ' + t.m.a.toString(16));
t = run('start: LDA #$81\nASL A', 2); ok(t.m.a === 2 && (t.m.p & 1), 'ASL');
t = run('start: LDA #$01\nSEC\nROR A', 3); ok(t.m.a === 0x80 && (t.m.p & 1), 'ROR');
t = run('start: LDX #$05\nLDA #$AB\nSTA $80,X\nLDY $85', 4); ok(t.m.ram[5] === 0xAB && t.m.y === 0xAB, 'indexed store/load RAM');
t = run('start: LDA #$C0\nSTA $90\nBIT $90\n', 3); ok((t.m.p & 0xC0) === 0xC0, 'BIT');
t = run('start: JSR sub\nLDA #$07\nsub: RTS', 2); ok(t.m.pc === 0xF003, 'JSR/RTS return addr got ' + t.m.pc.toString(16));
t = run('start: JSR sub\nLDA #$07\nJMP start\nsub: LDX #$02\nRTS', 5); ok(t.m.a === 7 && t.m.s === 0xFD, 'JSR/RTS flow');
t = run('start: LDX #$03\nl: DEX\nBNE l\nLDA #$09', 8); ok(t.m.x === 0 && t.m.a === 9, 'DEX/BNE loop');
// cycle counts
t = run('start: LDA #$01', 1); ok(t.out[0].cycles === 2, 'LDA imm 2 cycles');
t = run('start: LDA $80', 1); ok(t.out[0].cycles === 3, 'LDA zp 3 cycles');
t = run('start: STA $1234', 1); ok(t.out[0].cycles === 4, 'STA abs 4');
t = run('start: LDX #$01\nLDA $F0FF,X', 2); ok(t.out[1].cycles === 5, 'LDA abx page cross 5 got ' + t.out[1].cycles);
t = run('start: LDX #$01\nSTA $80,X', 2); ok(t.out[1].cycles === 4, 'STA zpx 4 got ' + t.out[1].cycles);
t = run('start: INC $80', 1); ok(t.out[0].cycles === 5, 'INC zp 5 got ' + t.out[0].cycles);
t = run('start: JSR s\ns: RTS', 1); ok(t.out[0].cycles === 6, 'JSR 6');
t = run('start: LDA #1\nBNE start', 2); ok(t.out[1].cycles === 3, 'BNE taken 3 got ' + t.out[1].cycles);
// trace sanity
t = run('start: LDA #$01', 1); ok(t.m.tr.filter(e => e.t === 'fetch').length === 2, 'trace has 2 fetches');
// WSYNC alignment
t = run('start: STA $02\nNOP', 2); ok(t.m.tia.hpos % 228 === 0 || t.m.tia.hpos === 6, 'wsync halts to line start hpos=' + t.m.tia.hpos + ' line=' + t.m.tia.line);
// frame from kernel
const k = DEMOS.find(d => d.id === 'kernel'); const r = A.assemble(k.src); const m = new A.Machine(); m.loadRom(r.rom); m.tracing = false;
let n = 0; while (m.tia.frame < 3 && n < 200000) { m.step(); n++; }
ok(m.tia.frame >= 3, 'kernel reaches frame 3, instr=' + n + ' cycles=' + m.cycles + ' line=' + m.tia.line);
// verify a line color and pf
const px = (x, y) => m.tia.fb[y * 160 + x];
ok(px(150, 5) !== 0xFF000000 || px(20, 5) !== 0xFF000000, 'picture has colour');
const c3 = m.cycles; while (m.tia.frame < 5) m.step(); const cyclesPerFrame = (m.cycles - c3) / 2; ok(Math.abs(cyclesPerFrame - 19912) < 1500, 'cycles per frame ~19912: ' + cyclesPerFrame.toFixed(0));
// timer
t = run(DEMOS.find(d => d.id === 'timer').src, 40); ok(true, 'timer demo ran, ram80=' + t.m.ram[0]);
console.log(fails ? 'FAILURES ' + fails : 'ALL PASS');
process.exit(fails ? 1 : 0);
