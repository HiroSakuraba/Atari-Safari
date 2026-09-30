; @id sentry
; @name Star Sentry
; @blurb An original fixed shooter. Joystick or arrow keys move the cannon, fire button or Space shoots. The aliens are four sprite copies hidden one by one with mid-scanline writes, and hits come from the TIA collision registers.
; Star Sentry: a fixed shooter for the Atari 2600 (original design).
VSYNC  = $00
VBLANK = $01
WSYNC  = $02
NUSIZ0 = $04
NUSIZ1 = $05
COLUP0 = $06
COLUP1 = $07
COLUPF = $08
COLUBK = $09
CTRLPF = $0A
PF0    = $0D
PF1    = $0E
PF2    = $0F
RESP0  = $10
GRP0   = $1B
GRP1   = $1C
ENAM0  = $1D
ENAM1  = $1E
HMP0   = $20
HMOVE  = $2A
HMCLR  = $2B
CXCLR  = $2C
CXM0P  = $00
CXM1P  = $01
INPT4  = $0C
SWCHA  = $280
SWCHB  = $282
INTIM  = $284
TIM64T = $296

scan   = $80
patc   = $81
patn   = $82
mk0    = $83
mk1    = $84
mk2    = $85
mk3    = $86
alive  = $87
fx     = $97
fdir   = $98
ftimer = $99
fspeed = $9A
gapT   = $9B
gapB   = $9C
cx     = $9D
bxp    = $9E
byp    = $9F
mxp    = $A0
myp    = $A1
score  = $A2
lives  = $A3
anim   = $A4
ystart = $A5
ylim   = $A6
rng    = $A7
acount = $A8
state  = $A9
timer2 = $AA
hitsav = $AB
rowc   = $AC
tmp    = $AD
tmp2   = $AE
lifepf = $AF
tmp3   = $B0
sc     = $B1
FXMIN  = 10
FXMAX  = 50
GAPSUM = 34
YOFF   = $F0

start:  SEI
        CLD
        LDX #$FF
        TXS
        LDA #0
clr:    STA $00,X
        DEX
        BNE clr
        LDA #$5A
        STA rng
        JSR NewGame

frame:  LDA #2
        STA WSYNC
        STA VSYNC
        STA WSYNC
        STA WSYNC
        STA WSYNC
        LDA #0
        STA VSYNC
        LDA #43
        STA TIM64T
        LDA fx
        LDX #0
        JSR PosObj
        LDA fx
        CLC
        ADC #32
        LDX #1
        JSR PosObj
        LDA bxp
        LDX #2
        JSR PosObj
        LDA mxp
        LDX #3
        JSR PosObj
        STA WSYNC
        STA HMOVE
        LDA #$14
        STA NUSIZ0
        STA NUSIZ1
        LDA #0
        STA GRP0
        STA GRP1
        STA ENAM0
        STA ENAM1
        STA CTRLPF
        STA COLUBK
        LDA state
        CMP #2
        BNE bgok
        LDA #$42
        STA COLUBK
bgok:   LDA #$0E
        STA COLUPF
        LDA anim
        BNE an1
        LDA #11
        STA ystart
        LDA #$FF
        STA ylim
        JMP an2
an1:    LDA #22
        STA ystart
        LDA #10
        STA ylim
an2:    LDA #GAPSUM
        SEC
        SBC gapT
        STA gapB
        LDA lives
        TAX
        LDA lifetbl,X
        STA lifepf
vbw:    LDA INTIM
        BNE vbw
        STA WSYNC
        LDA #0
        STA VBLANK

; ---------------- status band: 12 lines ----------------
        LDY #0
stat:   STA WSYNC
        LDA sc,Y
        STA PF1
        LDX #0
        STX PF2
        LDX #6
sdl:    DEX
        BNE sdl
        STX PF1
        LDA lifepf
        STA PF2
        INY
        CPY #12
        BNE stat
        STA WSYNC
        LDA #0
        STA PF2
        LDA #89
        STA scan
        LDX #$1E
        TXS

; ---------------- top gap ----------------
        LDY gapT
tg:     STA WSYNC
        LDX #$1E
        TXS
        LDA scan
        EOR myp
        AND #$FE
        PHP
        DEC scan
        STA WSYNC
        LDA scan
        EOR byp
        AND #$FE
        PHP
        DEY
        BNE tg

; ---------------- alien rows ----------------
        LDA #0
        STA rowc
        STA WSYNC
        JMP rowsvc

rowend: STA WSYNC
        LDA rowc
        CMP #16
        BNE rowsvc
        JMP after
rowsvc: LDX rowc
        LDA alive,X
        STA mk0
        LDA alive+1,X
        STA mk1
        LDA alive+2,X
        STA mk2
        LDA alive+3,X
        STA mk3
        LDA rowcol,X
        STA COLUP0
        STA COLUP1
        TXA
        CLC
        ADC #4
        STA rowc
        LDY ystart
        LDA spr,Y
        STA patc
        DEY
        STA WSYNC
        DEC scan

pair:   STA WSYNC
        LDA patc
        AND mk0
        STA GRP0
        LDA patc
        AND mk1
        STA GRP1
        LDX #$1E
        TXS
        LDA scan
        EOR myp
        AND #$FE
        PHP
        LDA patc
        AND mk3
        TAX
        LDA patc
        AND mk2
        STA GRP0
        LDA spr,Y
        STA patn
        STX GRP1
        DEY
        DEC scan
        STA WSYNC
        LDA patc
        AND mk0
        STA GRP0
        LDA patc
        AND mk1
        STA GRP1
        LDA scan
        EOR byp
        AND #$FE
        PHP
        LDA patc
        AND mk3
        TAX
        LDA patc
        AND mk2
        NOP
        NOP
        STA GRP0
        LDA patn
        STA patc
        STX GRP1
        CPY ylim
        BEQ pairend
        JMP pair
pairend: JMP rowend

; ---------------- after the aliens: read hits, move P0 to the cannon ----------------
after:  LDA CXM0P
        STA hitsav
        STA CXCLR
        STA HMCLR
        LDA #$10
        STA NUSIZ0
        LDA #$36
        STA COLUP0
        LDX #$FF
        TXS
        LDA cx
        LDX #0
        JSR PosObj
        STA WSYNC
        STA HMOVE
        DEC scan
        STA WSYNC
        DEC scan

; ---------------- bottom gap ----------------
        LDY gapB
bg:     STA WSYNC
        LDX #$1E
        TXS
        LDA scan
        EOR myp
        AND #$FE
        PHP
        DEC scan
        STA WSYNC
        LDA scan
        EOR byp
        AND #$FE
        PHP
        DEY
        BNE bg

; ---------------- cannon: 4 pairs ----------------
        LDY #3
cz:     STA WSYNC
        LDX #$1E
        TXS
        LDA scan
        EOR myp
        AND #$FE
        PHP
        LDA cannon,Y
        STA GRP0
        DEC scan
        STA WSYNC
        LDA scan
        EOR byp
        AND #$FE
        PHP
        DEY
        BPL cz

; ---------------- ground ----------------
        STA WSYNC
        LDX #$FF
        TXS
        LDA #0
        STA GRP0
        STA ENAM0
        STA ENAM1
        LDA #$C6
        STA COLUPF
        LDA #$FF
        STA PF0
        STA PF1
        STA PF2
        STA WSYNC
        STA WSYNC
        LDA #2
        STA VBLANK
        LDA #0
        STA PF0
        STA PF1
        STA PF2

; ---------------- overscan: game logic ----------------
        LDA #35
        STA TIM64T
        JSR Logic
osw:    LDA INTIM
        BNE osw
        JMP frame

; ---------------- subroutines ----------------
PosObj: STA WSYNC
        SEC
pdiv:   SBC #15
        BCS pdiv
        EOR #7
        ASL A
        ASL A
        ASL A
        ASL A
        STA HMP0,X
        STA RESP0,X
        RTS

NextRng: LDA rng
        LSR A
        BCC nr1
        EOR #$B8
nr1:    STA rng
        RTS

NewGame: LDA #0
        STA score
        STA state
        LDA #3
        STA lives
NewWave: LDX #15
        LDA #$FF
nw1:    STA alive,X
        DEX
        BPL nw1
        LDA #16
        STA acount
        LDA #24
        STA fx
        LDA #0
        STA fdir
        STA anim
        LDA #3
        STA gapT
        LDA #6
        STA fspeed
        STA ftimer
        LDA #YOFF
        STA byp
        STA myp
        LDA #76
        STA cx
        RTS

Logic:  LDA SWCHB
        LSR A
        BCS nores
        JSR NewGame
nores:  JSR PrepScore
        LDA state
        BEQ play
        CMP #2
        BEQ over
        DEC timer2
        BNE pausedone
        LDA #0
        STA state
        LDA #YOFF
        STA myp
        STA byp
pausedone: RTS
over:   BIT INPT4
        BMI overdone
        JSR NewGame
overdone: RTS

play:   LDA SWCHA
        AND #$80
        BNE noright
        LDA cx
        CMP #140
        BCS noright
        INC cx
noright: LDA SWCHA
        AND #$40
        BNE noleft
        LDA cx
        CMP #6
        BCC noleft
        DEC cx
noleft: BIT INPT4
        BMI nofire
        LDA byp
        CMP #YOFF
        BCC nofire
        LDA #7
        STA byp
        LDA cx
        CLC
        ADC #5
        STA bxp
nofire:
        ; ---- bullet hit on an alien
        LDA byp
        CMP #YOFF
        BCS nobullet
        LDA hitsav
        AND #$C0
        BEQ bmove
        JSR KillAlien
        JMP nobullet
bmove:  LDA byp
        CLC
        ADC #2
        STA byp
        CMP #90
        BCC nobullet
        LDA #YOFF
        STA byp
nobullet:
        ; ---- bomb hits cannon
        LDA CXM1P
        BPL nocannonhit
        LDA #YOFF
        STA myp
        DEC lives
        BEQ dead
        LDA #1
        STA state
        LDA #60
        STA timer2
        RTS
dead:   LDA #2
        STA state
        RTS
nocannonhit:
        ; ---- bomb
        LDA myp
        CMP #YOFF
        BCC bombmove
        JSR NextRng
        AND #$07
        BNE nobomb
        JSR SpawnBomb
        JMP nobomb
bombmove: DEC myp
        LDA myp
        CMP #3
        BCS nobomb
        LDA #YOFF
        STA myp
nobomb:
        ; ---- formation
        LDA acount
        BNE alienslive
        JSR NewWave
        RTS
alienslive: DEC ftimer
        BNE fdone
        LDA acount
        LSR A
        LSR A
        CLC
        ADC #1
        STA fspeed
        STA ftimer
        LDA anim
        EOR #1
        STA anim
        LDA fdir
        BNE mleft
        INC fx
        LDA fx
        CMP #FXMAX
        BCC fdone
        LDA #1
        STA fdir
        JMP descend
mleft:  DEC fx
        LDA fx
        CMP #FXMIN
        BCS fdone
        LDA #0
        STA fdir
descend: INC gapT
        INC gapT
        LDA gapT
        CMP #GAPSUM-2
        BCC fdone
        LDA #2
        STA state
fdone:  RTS

; A bullet overlapped an alien: work out which one from the bullet position.
KillAlien:
        LDA #YOFF
        STA tmp3
        LDA #89
        SEC
        SBC gapT
        SEC
        SBC byp
        BCC kdone
        LDX #0
kr:     CMP #12
        BCC kgot
        SBC #12
        INX
        BNE kr
kgot:   CPX #4
        BCS kdone
        TXA
        ASL A
        ASL A
        STA tmp
        LDA bxp
        SEC
        SBC fx
        CLC
        ADC #1
        BMI kdone
        LSR A
        LSR A
        LSR A
        LSR A
        LSR A
        CMP #4
        BCS kdone
        CLC
        ADC tmp
        TAX
        LDA alive,X
        BEQ kdone
        LDA #0
        STA alive,X
        DEC acount
        SED
        CLC
        LDA score
        ADC #1
        STA score
        CLD
kdone:  LDA #YOFF
        STA byp
        RTS

SpawnBomb: JSR NextRng
        AND #3
        STA tmp
        LDX #12
sb1:    TXA
        CLC
        ADC tmp
        TAY
        LDA alive,Y
        BNE sbfound
        TXA
        SEC
        SBC #4
        TAX
        BPL sb1
        RTS
sbfound: STX tmp2
        LDA tmp
        ASL A
        ASL A
        ASL A
        ASL A
        ASL A
        CLC
        ADC fx
        ADC #5
        STA mxp
        LDA #89
        SEC
        SBC gapT
        SEC
        SBC #9
        LDX tmp2
sb2:    BEQ sb3
        SEC
        SBC #3
        DEX
        DEX
        DEX
        DEX
        BNE sb2
sb3:    STA myp
        RTS

PrepScore: LDA score
        LSR A
        LSR A
        LSR A
        LSR A
        ASL A
        ASL A
        ASL A
        STA tmp
        LDA score
        AND #$0F
        ASL A
        ASL A
        ASL A
        STA tmp2
        LDY #0
ps1:    LDX tmp
        LDA font,X
        ASL A
        ASL A
        ASL A
        ASL A
        ASL A
        STA tmp3
        LDX tmp2
        LDA font,X
        ASL A
        ORA tmp3
        STA tmp3
        TYA
        ASL A
        TAX
        LDA tmp3
        STA sc+2,X
        STA sc+3,X
        INC tmp
        INC tmp2
        INY
        CPY #5
        BNE ps1
        RTS

; ---------------- data ----------------
lifetbl: .byte 0,$03,$1B,$DB
rowcol: .byte $46,0,0,0,$1E,0,0,0,$8A,0,0,0,$C4
cannon: .byte $FF,$7E,$3C,$18
font:   .byte 7,5,5,5,7,0,0,0
        .byte 2,6,2,2,7,0,0,0
        .byte 7,1,7,4,7,0,0,0
        .byte 7,1,7,1,7,0,0,0
        .byte 5,5,7,1,1,0,0,0
        .byte 7,4,7,1,7,0,0,0
        .byte 7,4,7,5,7,0,0,0
        .byte 7,1,1,1,1,0,0,0
        .byte 7,5,7,5,7,0,0,0
        .byte 7,5,7,1,7,0,0,0

        .org $FE00
spr:    .byte 0
        .byte 0,0,0,$18,$A5,$BD,$FF,$66,$3C,$18,$24
        .byte 0,0,0,$42,$24,$BD,$FF,$66,$3C,$18,$24
