(function (root) {
const DEMOS = [
{ id: 'tour', name: 'Instruction tour', blurb: 'One of each kind of operation: loads, stores, add, logic, shifts, compare, branch, subroutine, and a TIA write.',
src: `; Instruction tour. Every line lights a different path.
COLUBK = $09

start:  SEI             ; set interrupt-disable flag
        CLD             ; binary (not decimal) arithmetic
        LDX #$FF
        TXS             ; stack pointer = $FF
        LDA #$05        ; load immediate
        STA $80         ; store into RIOT RAM
        CLC
        ADC #$07        ; add: the adder lights up
        STA $81
        LDA $80         ; read RAM back
        AND #$0F        ; logic unit
        ORA #$30
        EOR #$FF
        ASL A           ; shifter
        LSR A
        TAX
        INX             ; increment through the adder
        DEX
        CMP #$10        ; compare = subtract, keep flags only
        BNE skip        ; branch on the Z flag
        NOP
skip:   JSR sub         ; pushes the return address on the stack
        LDA #$44
        STA COLUBK      ; write a TIA register
        JMP start

sub:    LDY #$03
loop:   DEY
        BNE loop
        RTS
` },
{ id: 'ripple', name: 'Carry ripple', blurb: 'Watch the carry travel through the 8 adder cells: $FF + 1 ripples all the way, $55 + $2A never does.',
src: `; Carry ripple through the 8-bit adder
start:  CLC
        LDA #$FF
        ADC #$01        ; carry ripples through all 8 bits
        CLC
        LDA #$55
        ADC #$2A        ; no carries at all
        CLC
        LDA #$7F
        ADC #$01        ; carry into bit 7 sets the V flag
        SEC
        LDA #$10
        SBC #$01        ; subtract = add the inverse
        JMP start
` },
{ id: 'bcd', name: 'Decimal mode', blurb: 'With the D flag set, the adder works in BCD: $19 + $28 gives $47, and $99 + 1 wraps to $00 with carry.',
src: `; Decimal (BCD) arithmetic
start:  SED             ; decimal flag on
        CLC
        LDA #$19
        ADC #$28        ; 19 + 28 = 47 in BCD
        CLC
        LDA #$99
        ADC #$01        ; 99 + 1 = 100: A=00, carry set
        CLD
        JMP start
` },
{ id: 'ram', name: 'RAM fill', blurb: 'Indexed addressing writes a ramp into RIOT RAM. Zoom into the RAM grid to see each cell light.',
src: `; Fill zero-page RAM with a ramp using indexed addressing
start:  LDX #$00
fill:   TXA
        STA $80,X       ; address = $80 + X
        INX
        CPX #$20
        BNE fill
        JMP start
` },
{ id: 'timer', name: 'RIOT timer', blurb: 'Start the interval timer and poll it. It counts down once every 64 CPU cycles.',
src: `; RIOT interval timer
INTIM  = $0284
TIM64T = $0296
start:  LDA #$0A
        STA TIM64T      ; timer counts down every 64 cycles
wait:   LDA INTIM       ; read it back
        STA $80
        BNE wait        ; loop until it reaches zero
        JMP start
` },
{ id: 'kernel', name: 'Rainbow picture', blurb: 'A tiny display kernel: sync, blank, 192 lines of colour, overscan. Run it at Real time to see the TV fill in.',
src: `; A minimal 2600 display kernel: rainbow bars, playfield and one sprite
VSYNC  = $00
VBLANK = $01
WSYNC  = $02
COLUP0 = $06
COLUPF = $08
COLUBK = $09
CTRLPF = $0A
PF0    = $0D
PF1    = $0E
PF2    = $0F
RESP0  = $10
GRP0   = $1B

start:  SEI
        CLD
        LDX #$FF
        TXS
        LDA #$0E
        STA COLUPF      ; white playfield
        LDA #$1E
        STA COLUP0      ; yellow player
        LDA #$3C
        STA GRP0        ; player shape
        LDA #$01
        STA CTRLPF      ; mirror the playfield
        LDA #$50
        STA PF0
        LDA #$AA
        STA PF1
        LDA #$0F
        STA PF2
        STA WSYNC       ; start of a scanline
        LDX #$06
pos:    DEX
        BNE pos         ; burn cycles to choose the x position
        STA RESP0       ; strobe: the player lands here

frame:  LDA #$02
        STA VSYNC       ; vertical sync on
        STA VBLANK
        STA WSYNC
        STA WSYNC
        STA WSYNC
        LDA #$00
        STA VSYNC       ; vertical sync off
        LDX #37
vb:     STA WSYNC
        DEX
        BNE vb          ; 37 blank lines
        STA VBLANK      ; picture on
        LDX #192
        LDY #$00
line:   STA WSYNC       ; wait for the start of the line
        STY COLUBK      ; background colour for this line
        INY
        INY
        DEX
        BNE line
        LDA #$02
        STA VBLANK      ; picture off
        LDX #29
os:     STA WSYNC
        DEX
        BNE os          ; overscan
        JMP frame
` }
];
if (typeof module !== 'undefined' && module.exports) module.exports = DEMOS; else root.DEMOS = DEMOS;
})(typeof window !== 'undefined' ? window : globalThis);
