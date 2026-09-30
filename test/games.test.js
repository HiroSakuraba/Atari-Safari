/* Plays each game in the emulator: the kernel draws what it should, frames are exactly 262 lines, and the rules work. */
const fs = require('fs'), path = require('path');
const A = require('../src/cpu.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
function load(name) {
  const r = A.assemble(fs.readFileSync(path.join(__dirname, '..', 'games', name + '.asm'), 'utf8'));
  ok(r.errors.length === 0, name + ' assembles ' + JSON.stringify(r.errors));
  const m = new A.Machine(); m.tracing = false; m.loadRom(r.rom); m.syms = r.syms; return m;
}
const frames = (m, n) => { const t = m.tia, target = t.frame + n; let c = 0; while (t.frame < target && c++ < 5e6) m.step(); };
const rd = (m, n) => m.ram[m.syms[n] - 0x80], wr = (m, n, v) => { m.ram[m.syms[n] - 0x80] = v; };
const BG = A.PALETTE[0] >>> 0;
function litRuns(t, y) { const runs = []; let x = 0; while (x < 160) { const v = t.fb[y * 160 + x]; if (v !== BG && v !== 0xFF000000) { const s = x; while (x < 160 && t.fb[y * 160 + x] !== BG && t.fb[y * 160 + x] !== 0xFF000000) x++; runs.push([s, x - s]); } else x++; } return runs; }

/* ---------------- Star Sentry ---------------- */
{
  let m = load('star-sentry'), t = m.tia;
  const vb = []; const w = t.write.bind(t); t.write = (a, v) => { if (a === 1) vb.push([v, t.line]); w(a, v); };
  frames(m, 4);
  ok(vb.slice(-2).map(x => x.join(':')).join(' ') === '0:40 2:232', 'sentry: picture is exactly 192 lines (' + vb.slice(-2).map(x => x.join(':')).join(' ') + ')');
  const c0 = m.cycles; frames(m, 3); ok(m.cycles - c0 === 3 * 19912, 'sentry: frames are 19,912 cycles, so 262 lines');
  t.write = w;
  /* every formation position draws four whole aliens in the right places */
  let bad = [];
  for (let fx = 10; fx <= 50; fx++) {
    wr(m, 'fx', fx); wr(m, 'ftimer', 200); frames(m, 2);
    let found = false;
    for (let y = 0; y < 192 && !found; y++) {
      const r = litRuns(t, y);
      if (r.length === 4 && r.every(q => q[1] === 8)) { found = true; if (!r.every((q, i) => q[0] === fx + 3 + 32 * i)) bad.push(fx); }
    }
    if (!found) bad.push(fx);
  }
  ok(bad.length === 0, 'sentry: four aliens drawn correctly at every formation x from 10 to 50' + (bad.length ? ' bad: ' + bad : ''));
  /* firing kills the alien in the bullet\'s path, starting from the bottom row */
  m = load('star-sentry'); frames(m, 2);
  const alive = () => Array.from({ length: 16 }, (_, i) => m.ram[m.syms.alive - 0x80 + i] ? '#' : '.').join('');
  let killed = [];
  for (let shot = 0; shot < 8; shot++) {
    const col = shot % 4; wr(m, 'fx', 24); wr(m, 'ftimer', 250); wr(m, 'cx', 24 + 32 * col - 2);
    m.tia.fire = true; frames(m, 1); m.tia.fire = false;
    let f = 0; while (rd(m, 'byp') < 0xF0 && f++ < 150) frames(m, 1);
    killed.push(alive());
  }
  ok(killed[0] === '############.###' && killed[3] === '############....' && killed[7] === '########........', 'sentry: shots clear column by column, bottom row first (' + killed[7] + ')');
  ok(rd(m, 'score') === 8 && rd(m, 'acount') === 8, 'sentry: score is BCD 08 and eight aliens remain');
  /* a bomb landing on the cannon costs a life and eventually ends the game */
  m = load('star-sentry'); frames(m, 2);
  let lost = 0, prev = 3;
  for (let f = 0; f < 3000 && rd(m, 'state') !== 2; f++) { if (rd(m, 'myp') < 0xF0) wr(m, 'cx', Math.max(6, Math.min(140, rd(m, 'mxp') - 5))); frames(m, 1); if (rd(m, 'lives') < prev) { lost++; prev = rd(m, 'lives'); } }
  ok(lost === 3 && rd(m, 'state') === 2, 'sentry: three bomb hits end the game (lost ' + lost + ')');
  /* the reset switch starts a new game */
  m.riot.swchb = 0x0A; frames(m, 2); m.riot.swchb = 0x0B; frames(m, 2);
  ok(rd(m, 'state') === 0 && rd(m, 'lives') === 3, 'sentry: reset switch restarts');
  /* the wave is refilled when cleared */
  m = load('star-sentry'); frames(m, 2); for (let i = 0; i < 16; i++) m.ram[m.syms.alive - 0x80 + i] = 0; wr(m, 'acount', 0); frames(m, 3);
  ok(rd(m, 'acount') === 16, 'sentry: clearing the wave brings a new one');
}

/* ---------------- Dot Dash ---------------- */
{
  let m = load('dot-dash'), t = m.tia;
  const vb = []; const w = t.write.bind(t); t.write = (a, v) => { if (a === 1) vb.push([v, t.line]); w(a, v); };
  frames(m, 4);
  ok(vb.slice(-2).map(x => x.join(':')).join(' ') === '0:40 2:232', 'dash: picture is exactly 192 lines');
  const c0 = m.cycles; frames(m, 3); ok(m.cycles - c0 === 3 * 19912, 'dash: frames are 19,912 cycles');
  t.write = w;
  const pfc = A.PALETTE[0x9E] >>> 0;
  const runsOf = y => { const r = []; let x = 0; while (x < 160) { if (t.fb[y * 160 + x] === pfc) { const s0 = x; while (x < 160 && t.fb[y * 160 + x] === pfc) x++; r.push([s0, x - s0]); } else x++; } return r; };
  let r = runsOf(101);
  ok(r.length === 18 && r.every(q => q[1] === 4), 'dash: a dot row shows 18 whole dots (' + r.length + ')');
  ok(r[0][0] === 8 && r[9][0] === 80 && r[17][0] === 144, 'dash: dots line up with the cells (x = 8 ... 144)');
  const hold = (mask, n) => { m.riot.swcha = 0xFF & ~mask; frames(m, n); m.riot.swcha = 0xFF; };
  ok(rd(m, 'plx') === 80 && rd(m, 'ply') === 82, 'dash: player waits at the start until steered');
  hold(0x80, 90);
  ok(rd(m, 'plx') === 144 && rd(m, 'dotcnt') === 117 && rd(m, 'score') === 9, 'dash: running right eats nine dots (BCD score 009)');

  hold(0x40, 16);
  ok(rd(m, 'plx') === 128, 'dash: player turns back left');
  hold(0x10, 40);
  ok(rd(m, 'plx') === 128 && rd(m, 'ply') === 70, 'dash: up through a gap reaches the next corridor');
  hold(0x10, 10); const y0 = rd(m, 'ply'); hold(0x10, 30);
  ok(rd(m, 'ply') === y0, 'dash: a solid bar stops the player');
  /* pre-turn: hold up while running along a corridor and take the first gap */
  m = load('dot-dash'); frames(m, 2); m.riot.swcha = 0xFF & ~0x80; frames(m, 2); m.riot.swcha = 0xFF & ~0x10; frames(m, 120); m.riot.swcha = 0xFF;
  ok(rd(m, 'ply') < 82, 'dash: holding up while running turns at the first gap');
  /* the ghosts catch a player who stands still */
  m = load('dot-dash'); frames(m, 2);
  let lives = 3, lost = 0;
  for (let f = 0; f < 6000 && rd(m, 'state') !== 2; f++) { frames(m, 1); if (rd(m, 'lives') < lives) { lives = rd(m, 'lives'); lost++; } }
  ok(lost === 3 && rd(m, 'state') === 2, 'dash: ghosts catch the player three times (lost ' + lost + ')');
  m.riot.swchb = 0x0A; frames(m, 2); m.riot.swchb = 0x0B; frames(m, 2);
  ok(rd(m, 'state') === 0 && rd(m, 'lives') === 3 && rd(m, 'dotcnt') >= 125, 'dash: reset switch restarts with all dots');
  /* eating everything brings the next level */
  m = load('dot-dash'); frames(m, 2); wr(m, 'dotcnt', 1);
  for (let i = 0; i < 42; i++) m.ram[m.syms.dots - 0x80 + i] = 0; m.ram[m.syms.dots - 0x80 + 37] = 0x80; /* one dot left: bottom row, cell 2 */
  wr(m, 'plx', 8); wr(m, 'ply', 82); m.riot.swcha = 0xFF & ~0x80; frames(m, 20); m.riot.swcha = 0xFF;
  ok(rd(m, 'level') === 1 && rd(m, 'dotcnt') >= 125, 'dash: clearing the maze starts the next level');
}

console.log(fails ? 'FAILURES ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
