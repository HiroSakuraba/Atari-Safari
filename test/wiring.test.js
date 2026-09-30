const A = require('../src/cpu.js'), LAY = require('../src/layout.js'), DEMOS = require('../src/demos.js'), PH = require('../src/phases.js');
const ids = new Set([...LAY.N.map(n=>n.id), ...LAY.E.map(e=>e.id), ...LAY.L.map(l=>l.id), 'bcd','romcur']);
for (let b=0;b<8;b++) ids.add('cell'+b);
for (let i=0;i<128;i++) ids.add('ram_'+i);
['COLUBK','COLUPF','COLUP0','COLUP1','PF0','PF1','PF2','CTRLPF','GRP0','GRP1','VSYNC','VBLANK'].forEach(n=>ids.add('tr_'+n));
const missing = new Map(); let phaseCount = 0, insCount = 0, problems = 0; const kinds = {};
// extra program hitting rare paths
const extra = `start: LDX #5
 LDY #3
 LDA #$10
 STA $80,X
 STA $F0,Y
 LDA ($80),Y
 LDA ($80,X)
 STA ($80),Y
 INC $80
 DEC $80,X
 ASL $80
 ROL $80
 LSR A
 ROR A
 BIT $80
 PHA
 PHP
 PLA
 PLP
 TSX
 TXS
 TAY
 TYA
 CPX #3
 CPY #3
 EOR $80
 SEC
 SBC #1
 LDA $F0FF,X
 JMP (vec)
 BEQ start
vec: .word start
 BRK`;
const fs = require('fs'), path = require('path');
const gameSrcs = fs.readdirSync(path.join(__dirname, '..', 'games')).filter(f => f.endsWith('.asm')).map(f => fs.readFileSync(path.join(__dirname, '..', 'games', f), 'utf8'));
for (const src of [...DEMOS.map(d=>d.src), extra, ...gameSrcs]) {
  const r = A.assemble(src); if (r.errors.length) { console.log('ASM ERR', r.errors); continue; }
  const m = new A.Machine(); m.loadRom(r.rom);
  for (let i=0;i<(gameSrcs.includes(src)?4000:400);i++) {
    const info = m.step(); const tr = m.tr.slice(); insCount++;
    const phases = PH.buildPhases(info, tr);
    if (!phases.length) { problems++; console.log('NO PHASES for', info); }
    phases.forEach(p => { phaseCount++; kinds[p.kind]=(kinds[p.kind]||0)+1;
      if (!p.text) { problems++; console.log('empty text', p.kind); }
      p.on.forEach(([id]) => { if (!ids.has(id)) missing.set(id,(missing.get(id)||0)+1); });
      p.on.forEach(([id,t]) => { if (t<0||t>1.0001) { problems++; console.log('bad t', id, t); } });
    });
  }
}
console.log('instructions', insCount, 'phases', phaseCount, kinds);
// TIA registers that are not drawn in the register grid (WSYNC, RESP0, AUD*, ...) are allowed to have no highlight
const real = [...missing.entries()].filter(([id]) => !id.startsWith('tr_'));
console.log('ids with no matching element:', real.length ? real : 'none');
if (real.length || problems) { console.log('WIRING CHECK FAILED'); process.exit(1); }
console.log('WIRING OK');
