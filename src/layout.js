/* Geometry, wiring and copy for the schematic. World is 2400 x 1500 units. */
(function (root) {
const N = [], E = [], L = [];
const node = (id, x, y, w, h, label, o) => N.push(Object.assign({ id, x, y, w, h, label, kind: 'data' }, o || {}));
const edge = (id, kind, pts, o) => E.push(Object.assign({ id, kind, pts }, o || {}));

/* ---------- CPU ---------- */
node('pc', 100, 120, 300, 90, 'PC', { sub: 'Program counter', kind: 'addr', view: 'addr', val: 'pc', fmt: 'h4',
  desc: 'The program counter holds the address of the next byte to fetch. Every fetch adds one, so the CPU walks through the cartridge in order. Jumps, branches and returns load a new value.' });
node('ar', 470, 120, 300, 90, 'Address register', { sub: 'drives A0 to A12', kind: 'addr', view: 'addr', val: 'ar', fmt: 'h4',
  desc: 'The address currently on the 13 address lines. It comes from the PC, or from an effective address the adder worked out. The 6507 has only 13 address pins, so the top three bits of every address are ignored.' });
node('inc', 100, 255, 300, 65, 'PC + 1', { kind: 'addr', view: 'addr',
  desc: 'A small incrementer that bumps the program counter after each fetch.' });
node('ir', 100, 370, 300, 90, 'Instruction register', { kind: 'ctl', view: 'ctrl', val: 'ir', fmt: 'h2', subKey: 'mnem',
  desc: 'Holds the opcode byte that was just fetched, while the decoder works out what to do with it.' });
node('dec', 100, 490, 300, 200, 'Decode ROM', { kind: 'ctl', view: 'ctrl', custom: 'dec',
  desc: 'A logic array that turns the opcode into control signals: which register drives which bus, what the ALU should do, and how many cycles the instruction takes.' });
node('tim', 100, 720, 300, 110, 'Timing control', { kind: 'ctl', view: 'ctrl', custom: 'tim',
  desc: 'Counts the cycles of the current instruction (T0, T1, and so on). Each cycle is one memory access, and the decoder uses the count to sequence the steps.' });
node('a', 470, 370, 180, 80, 'A', { sub: 'Accumulator', view: 'regs', val: 'a', fmt: 'h2',
  desc: 'The accumulator. Nearly all arithmetic and logic starts or ends here.' });
node('x', 470, 470, 180, 80, 'X', { sub: 'Index register', view: 'regs', val: 'x', fmt: 'h2',
  desc: 'Index register X. Used for indexed addressing such as STA $80,X, and for loop counters.' });
node('y', 470, 570, 180, 80, 'Y', { sub: 'Index register', view: 'regs', val: 'y', fmt: 'h2',
  desc: 'Index register Y, a second index and counter.' });
node('s', 470, 670, 180, 80, 'S', { sub: 'Stack pointer', view: 'regs', val: 's', fmt: 'h2',
  desc: 'Points into page 1 ($0100 to $01FF). On the 2600 that page is mirrored onto the 128 bytes of RIOT RAM, so the stack shares memory with your variables.' });
node('p', 470, 770, 180, 100, 'P', { sub: 'Status flags', view: 'regs', custom: 'flags',
  desc: 'The status register. N negative, V overflow, B break, D decimal, I interrupt disable, Z zero, C carry.' });
node('buf', 470, 915, 300, 80, 'Data bus buffer', { view: 'cpu', val: 'db', fmt: 'h2',
  desc: 'Connects the internal data bus to the eight data pins D0 to D7, in both directions.' });

/* ---------- ALU ---------- */
node('ain', 750, 400, 230, 65, 'A input', { kind: 'alu', view: 'alu', val: 'ain', fmt: 'h2',
  desc: 'First operand latch. Values arrive here from A, X, Y or S over the source bus.' });
node('bin', 1040, 400, 230, 65, 'B input', { kind: 'alu', view: 'alu', val: 'bin', fmt: 'h2',
  desc: 'Second operand latch. Usually the byte just read from memory.' });
node('binv', 1040, 500, 160, 45, 'Invert', { kind: 'alu', view: 'alu', val: 'binvtxt',
  desc: 'For subtraction and compare, B is inverted first. Then A - B is done as A + (not B) + 1 in the same adder.' });
node('logic', 750, 575, 170, 60, 'Logic', { kind: 'alu', view: 'alu', val: 'logicop',
  desc: 'Bitwise AND, ORA (or) and EOR (exclusive or) in one block.' });
node('shift', 1080, 575, 190, 60, 'Shifter', { kind: 'alu', view: 'alu', val: 'shiftop',
  desc: 'Moves every bit one place left or right. ASL and LSR shift in a zero, ROL and ROR shift in the carry flag.' });
node('adder', 750, 670, 520, 90, 'Adder', { kind: 'alu', view: 'adder', custom: 'adder',
  desc: 'Eight one-bit full adders in a row. Each cell passes its carry to the next, so a carry has to ripple from bit 0 to bit 7. Watch it move when you add $FF and 1. In decimal mode a correction step turns the binary result into BCD.' });
node('res', 750, 790, 520, 60, 'Result', { kind: 'alu', view: 'alu', val: 'res', fmt: 'h2',
  desc: 'Holds the ALU output until it is sent back over the data bus to a register or to memory.' });

/* ---------- TIA ---------- */
node('tia_dec', 1540, 120, 240, 70, 'Address decode', { sub: 'A12=0 and A7=0', kind: 'chip', view: 'tia',
  desc: 'The TIA answers when address bit 12 is 0 and bit 7 is 0, so its registers sit at $00 to $3F (and mirrors).' });
node('tia_regs', 1540, 220, 380, 250, 'Write registers', { kind: 'chip', view: 'tia', custom: 'tiaregs',
  desc: 'Most TIA registers are write-only. Poking a value here sets a colour, a playfield pattern or a sprite shape for the beam to use on the following pixels.' });
node('tia_clk', 1980, 120, 300, 90, 'Colour clock', { kind: 'chip', view: 'tia', custom: 'tiaclk',
  desc: 'The TIA counts 228 colour clocks per scanline, 3 for every CPU cycle. The first 68 are horizontal blank, the remaining 160 are visible pixels.' });
node('tia_wsync', 1980, 240, 300, 70, 'WSYNC and RDY', { sub: 'halts the CPU', kind: 'chip', view: 'tia',
  desc: 'Writing any value to WSYNC pulls the CPU ready line low. The CPU freezes until the beam reaches the end of the scanline, which is how programs stay in step with the picture.' });
node('tia_gen', 1980, 340, 300, 130, 'Object generators', { sub: 'playfield, players', kind: 'chip', view: 'tia', val: 'tiaobj',
  desc: 'For each pixel, the playfield and the two player sprites decide whether they are drawn. Missiles and ball are stored by this simulator but not drawn.' });
node('tia_mux', 1540, 520, 380, 80, 'Priority and palette', { kind: 'chip', view: 'tia',
  desc: 'Picks the winning object for each pixel and looks up its colour in the 128-colour palette.' });
node('tia_out', 1980, 520, 300, 80, 'Video out', { kind: 'chip', view: 'tia', custom: 'tiaout',
  desc: 'The colour signal that goes to the television. The swatch shows the current background colour.' });

/* ---------- RIOT ---------- */
node('riot_dec', 1540, 890, 240, 70, 'Address decode', { sub: 'A12=0, A7=1', kind: 'chip', view: 'riot',
  desc: 'The RIOT answers when A12 is 0 and A7 is 1. A9 then chooses RAM (0) or the timer and I/O ports (1).' });
node('riot_ram', 1540, 990, 380, 180, 'RAM', { sub: '128 bytes', kind: 'chip', view: 'ram', custom: 'ram',
  desc: 'All the memory a 2600 program gets: 128 bytes. The zero page and the stack both live here.' });
node('riot_timer', 1980, 890, 300, 120, 'Interval timer', { kind: 'chip', view: 'riot', custom: 'timer',
  desc: 'Loaded with a start value, it counts down once every 1, 8, 64 or 1024 CPU cycles depending on which address you write. After it reaches zero it counts down every cycle.' });
node('riot_io', 1980, 1040, 300, 130, 'I/O ports', { kind: 'chip', view: 'riot', custom: 'io',
  desc: 'SWCHA reads the joysticks and paddles. SWCHB reads the console switches (reset, select, colour, difficulty).' });

/* ---------- ROM ---------- */
node('rom_arr', 100, 1180, 1180, 230, 'Cartridge ROM', { kind: 'chip', view: 'rom', custom: 'rom',
  desc: 'The game itself: 4096 bytes mapped at $F000. Address bit 12 selects it. The window shows the bytes around the last address fetched.' });

/* ---------- frames ---------- */
L.push({ id: 'f_cpu', x: 60, y: 60, w: 1300, h: 1010, title: 'MOS 6507', sub: 'CPU', big: 'CPU', view: 'cpu', kind: 'addr',
  desc: 'The 6507 is a 6502 in a smaller package. It has 13 address lines instead of 16 and no interrupt pins, which is all a 2600 needs.' });
L.push({ id: 'f_tia', x: 1500, y: 60, w: 840, h: 700, title: 'TIA', sub: 'Television Interface Adaptor', big: 'TIA', view: 'tia', kind: 'chip',
  desc: 'The TIA generates the picture, one scanline at a time, while the CPU feeds it new values just in time. There is no frame buffer.' });
L.push({ id: 'f_riot', x: 1500, y: 830, w: 840, h: 610, title: 'RIOT 6532', sub: 'RAM, I/O, Timer', big: 'RIOT', view: 'riot', kind: 'chip',
  desc: 'One chip that provides the console\'s 128 bytes of RAM, the two input ports and an interval timer.' });
L.push({ id: 'f_rom', x: 60, y: 1120, w: 1300, h: 320, title: 'Cartridge', sub: '4 KB ROM', big: 'ROM', view: 'rom', kind: 'chip',
  desc: 'The cartridge plugs straight into the CPU bus. The program runs directly out of ROM.' });
L.push({ id: 'f_alu', x: 720, y: 370, w: 600, h: 510, title: 'ALU', sub: 'Arithmetic Logic Unit', big: '', tpos: 'br', view: 'alu', kind: 'alu',
  desc: 'The arithmetic logic unit: adder, logic and shifter, fed by two operand latches.' });

/* ---------- wiring: CPU ---------- */
edge('e_pc_ar', 'addr', [[400, 140], [470, 140]]);
edge('e_pc_inc', 'addr', [[250, 210], [250, 255]]);
edge('e_inc_pc', 'addr', [[100, 288], [78, 288], [78, 165], [100, 165]]);
edge('e_db_pc', 'data', [[435, 190], [400, 190]]);
edge('e_db_ar', 'data', [[435, 190], [470, 190]]);
edge('e_ar_pin', 'addr', [[770, 165], [1420, 165]], { label: 'A0-A12', lx: 1040, ly: 148 });
edge('e_db', 'data', [[435, 190], [435, 955]]);
edge('e_db_ir', 'data', [[435, 385], [400, 385]]);
edge('e_ir_dec', 'ctl', [[250, 460], [250, 490]]);
edge('e_dec_tim', 'ctl', [[250, 690], [250, 720]]);
edge('e_ctl', 'ctl', [[250, 830], [250, 1015], [900, 1015], [900, 880]]);
edge('e_db_a', 'data', [[435, 410], [470, 410]]);
edge('e_db_x', 'data', [[435, 510], [470, 510]]);
edge('e_db_y', 'data', [[435, 610], [470, 610]]);
edge('e_db_s', 'data', [[435, 710], [470, 710]]);
edge('e_db_p', 'data', [[435, 820], [470, 820]]);
edge('e_a_sb', 'data', [[650, 410], [685, 410]]);
edge('e_x_sb', 'data', [[650, 510], [685, 510]]);
edge('e_y_sb', 'data', [[650, 610], [685, 610]]);
edge('e_s_sb', 'data', [[650, 710], [685, 710]]);
edge('e_sb', 'data', [[685, 410], [685, 710]]);
edge('e_sb_ain', 'data', [[685, 435], [750, 435]]);
edge('e_db_alub', 'data', [[435, 340], [1155, 340], [1155, 400]]);
edge('e_db_buf', 'data', [[435, 955], [470, 955]]);
edge('e_data_pin', 'data', [[770, 955], [1385, 955]], { label: 'D0-D7', lx: 1040, ly: 938 });
edge('e_rdy', 'ctl', [[1980, 290], [1440, 290], [1440, 1040], [80, 1040], [80, 775], [100, 775]], { label: 'RDY', lx: 1400, ly: 1030 });

/* ---------- wiring: ALU ---------- */
edge('e_ain_logic', 'alu', [[800, 465], [800, 575]]);
edge('e_ain_add', 'alu', [[950, 465], [950, 670]]);
edge('e_bin_binv', 'alu', [[1120, 465], [1120, 500]]);
edge('e_binv_add', 'alu', [[1060, 545], [1060, 670]]);
edge('e_bin_logic', 'alu', [[1040, 432], [1000, 432], [1000, 605], [920, 605]]);
edge('e_bin_shift', 'alu', [[1240, 465], [1240, 575]]);
edge('e_logic_res', 'alu', [[750, 605], [735, 605], [735, 820], [750, 820]]);
edge('e_add_res', 'alu', [[1010, 760], [1010, 790]]);
edge('e_shift_res', 'alu', [[1270, 605], [1300, 605], [1300, 820], [1270, 820]]);
edge('e_res_db', 'data', [[1020, 850], [1020, 892], [435, 892]]);
edge('e_alu_p', 'alu', [[800, 850], [800, 866], [680, 866], [680, 830], [650, 830]]);
edge('e_p_cin', 'alu', [[650, 795], [700, 795], [700, 727], [750, 727]]);
for (let b = 0; b < 8; b++) {
  const cx = 770 + b * 62;
  if (b < 7) edge('k' + b, 'alu', [[cx + 52, 727], [cx + 62, 727]], { thick: true });
}
edge('k7', 'alu', [[1256, 727], [1268, 727]], { thick: true });
edge('k_in', 'alu', [[750, 727], [770, 727]], { thick: true });

/* ---------- wiring: buses and chips ---------- */
edge('e_a_up', 'addr', [[1420, 165], [1420, 925]]);
edge('e_a_rom', 'addr', [[1420, 925], [1420, 1250], [1280, 1250]]);
edge('e_a_tia', 'addr', [[1420, 165], [1540, 165]]);
edge('e_a_riot', 'addr', [[1420, 925], [1540, 925]]);
edge('e_d_up', 'data', [[1385, 955], [1385, 330]]);
edge('e_d_mid', 'data', [[1385, 955], [1385, 1200]]);
edge('e_d_low', 'data', [[1385, 1200], [1385, 1340], [1280, 1340]]);
edge('e_d_tia', 'data', [[1385, 330], [1540, 330]]);
edge('e_d_riot', 'data', [[1385, 1200], [1950, 1200], [1950, 950]]);
edge('e_lbus_ram', 'data', [[1950, 1080], [1920, 1080]]);
edge('e_lbus_timer', 'data', [[1950, 950], [1980, 950]]);
edge('e_lbus_io', 'data', [[1950, 1105], [1980, 1105]]);
edge('e_tia_dec_regs', 'ctl', [[1660, 190], [1660, 220]]);
edge('e_regs_gen', 'chip', [[1920, 400], [1980, 400]]);
edge('e_regs_wsync', 'chip', [[1920, 262], [1980, 262]]);
edge('e_clk_wsync', 'chip', [[2130, 210], [2130, 240]]);
edge('e_clk_gen', 'chip', [[2280, 165], [2310, 165], [2310, 405], [2280, 405]]);
edge('e_gen_mux', 'chip', [[2130, 470], [2130, 495], [1850, 495], [1850, 520]]);
edge('e_regs_mux', 'chip', [[1650, 470], [1650, 520]]);
edge('e_mux_out', 'chip', [[1920, 560], [1980, 560]]);
edge('e_dec_ram', 'ctl', [[1660, 960], [1660, 990]]);
edge('e_dec_timer', 'ctl', [[1780, 905], [1980, 905]]);
edge('e_tim_io', 'ctl', [[2130, 1010], [2130, 1040]]);

const LABELS = [];

/* ---------- camera targets ---------- */
const VIEWS = {
  sys: { x: 0, y: 0, w: 2400, h: 1500, name: 'System' },
  cpu: { x: 30, y: 30, w: 1370, h: 1060, name: 'CPU' },
  addr: { x: 60, y: 90, w: 740, h: 260, name: 'Addressing' },
  ctrl: { x: 70, y: 340, w: 380, h: 520, name: 'Decode' },
  regs: { x: 410, y: 340, w: 300, h: 560, name: 'Registers' },
  alu: { x: 690, y: 320, w: 660, h: 580, name: 'ALU' },
  adder: { x: 730, y: 640, w: 560, h: 140, name: 'Adder' },
  tia: { x: 1490, y: 50, w: 870, h: 730, name: 'TIA' },
  riot: { x: 1490, y: 820, w: 870, h: 630, name: 'RIOT' },
  ram: { x: 1520, y: 970, w: 420, h: 220, name: 'RAM' },
  rom: { x: 40, y: 1100, w: 1360, h: 360, name: 'Cartridge' }
};

const api = { N, E, L, LABELS, VIEWS, W: 2400, H: 1500 };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LAYOUT = api;
})(typeof window !== 'undefined' ? window : globalThis);
