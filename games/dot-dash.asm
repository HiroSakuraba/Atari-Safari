; @id dotdash
; @name Dot Dash
; @blurb An original maze chase. Joystick or arrow keys steer, and you turn at the gaps. The maze and dots are a full-width asymmetric playfield, the two ghosts share one sprite by flickering, and catches come from the collision registers.
; Dot Dash: a maze chase for the Atari 2600 (original design).
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
REFP0  = $0B
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
CXPPMM = $07
INPT4  = $0C
SWCHA  = $280
SWCHB  = $282
INTIM  = $284
TIM64T = $296

gp     = $80
g0     = $81
g1     = $82
n0     = $83
n1     = $84
pm0    = $85
pm1    = $86
sp0    = $87
sp1    = $89
plx    = $8B
ply    = $8C
pdir   = $8D
pwant  = $8E
gh     = $8F
score  = $95
scoreH = $96
lives  = $97
state  = $98
timer2 = $99
dotcnt = $9A
level  = $9B
fc     = $9C
rng    = $9D
ex     = $9E
ey     = $9F
tmp    = $A0
tmp2   = $A1
tmp3   = $A2
lifepf = $A3
gidx   = $A4
tx     = $A5
sc     = $A6
sh     = $B2
dots   = $BE
ord    = $E8
hd     = $EC
vd     = $ED
hdist  = $EE
vdist  = $EF

start:  SEI
        CLD
        LDX #$FF
        TXS
        LDA #0
clr:    STA $00,X
        DEX
        BNE clr
        LDA #$A7
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
        STA CXCLR
        ; ---- sprite setup
        LDA pdir
        AND #3
        CMP #2
        BCS pvert
        LDA #0
        JMP pgot
pvert:  BNE pdown
        LDA #16
        JMP pgot
pdown:  LDA #32
pgot:   STA tmp
        LDA plx
        CLC
        ADC ply
        LSR A
        LSR A
        AND #1
        ASL A
        ASL A
        ASL A
        CLC
        ADC tmp
        CLC
        ADC #<pacspr
        STA sp0
        LDA #>pacspr
        STA sp0+1
        LDA #0
        LDX pdir
        CPX #1
        BNE noref
        LDA #8
noref:  STA REFP0
        LDA ply
        SEC
        SBC #1
        STA pm0
        ; ghost shown this frame
        LDA fc
        AND #1
        BEQ gsel0
        LDX #3
        LDA #$8C
        JMP gsel
gsel0:  LDX #0
        LDA #$46
gsel:   STA COLUP1
        LDA gh+1,X
        SEC
        SBC #1
        STA pm1
        LDA gh,X
        CLC
        ADC gh+1,X
        LSR A
        LSR A
        AND #1
        ASL A
        ASL A
        ASL A
        CLC
        ADC #<ghsspr
        STA sp1
        LDA #>ghsspr
        STA sp1+1
        LDA gh,X
        STA tmp
        LDA plx
        SEC
        SBC #3
        LDX #0
        JSR PosObj
        LDA tmp
        SEC
        SBC #3
        LDX #1
        JSR PosObj
        STA WSYNC
        STA HMOVE
        LDA #0
        STA NUSIZ0
        STA NUSIZ1
        STA GRP0
        STA GRP1
        STA g0
        STA g1
        STA n0
        STA n1
        STA CTRLPF
        STA COLUBK
        LDA #$1E
        STA COLUP0
        LDA #$9E
        STA COLUPF
        LDA state
        CMP #2
        BNE bgok
        LDA #$42
        STA COLUBK
bgok:   LDA lives
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
        LDA sh,Y
        STA PF0
        LDA sc,Y
        STA PF1
        LDX #0
        STX PF2
        LDX #4
sdl:    DEX
        BNE sdl
        STX PF0
        STX PF1
        LDA lifepf
        STA PF2
        INY
        CPY #12
        BNE stat
        STA WSYNC
        LDA #0
        STA PF2
        STA gp
        LDA #7
        STA gp

; ---------------- the maze ----------------
        LDX #24
        JSR PairPF
        LDX #0
        JSR PairPF
        JSR PairKeep
        LDA #0
        STA tmp3
        LDA #0
        STA tmp2
mz:     LDX #24
        JSR PairPF
        JSR PairKeep
        JSR PairKeep
        JSR PairPreDot
        LDX tmp2
        JSR PairDot
        LDX #24
        JSR PairPF
        JSR PairKeep
        JSR PairKeep
        JSR PairKeep
        JSR PairKeep
        LDA tmp2
        CLC
        ADC #6
        STA tmp2
        INC tmp3
        ; the next bar: index tmp3, table offset tmp3*3
        LDA tmp3
        ASL A
        CLC
        ADC tmp3
        TAX
        JSR PairPF
        JSR PairKeep
        LDA tmp3
        CMP #7
        BNE mz
        LDX #24
        JSR PairPF
        STA WSYNC
        LDA #0
        STA GRP0
        STA GRP1
        STA PF0
        STA PF1
        STA PF2
        STA WSYNC
        LDA #2
        STA VBLANK

; ---------------- overscan: game logic ----------------
        LDA #35
        STA TIM64T
        JSR Logic
osw:    LDA INTIM
        BNE osw
        JMP frame

; ---------------- kernel pairs ----------------
; Each pair is two scanlines. Sprite bytes for the next pair are worked out during the pair.
PairPF: STA WSYNC
        LDA g0
        STA GRP0
        LDA g1
        STA GRP1
        LDA pftab,X
        STA PF0
        LDA pftab+1,X
        STA PF1
        LDA pftab+2,X
        STA PF2
        LDA gp
        SEC
        SBC pm0
        CMP #8
        BCS pf0o
        TAY
        LDA (sp0),Y
        JMP pf0s
pf0o:   LDA #0
pf0s:   STA g0
        STA WSYNC
        LDA gp
        SEC
        SBC pm1
        CMP #8
        BCS pf1o
        TAY
        LDA (sp1),Y
        JMP pf1s
pf1o:   LDA #0
pf1s:   STA g1
        INC gp
        RTS

PairKeep: STA WSYNC
        LDA g0
        STA GRP0
        LDA g1
        STA GRP1
        LDA gp
        SEC
        SBC pm0
        CMP #8
        BCS pk0o
        TAY
        LDA (sp0),Y
        JMP pk0s
pk0o:   LDA #0
pk0s:   STA g0
        STA WSYNC
        LDA gp
        SEC
        SBC pm1
        CMP #8
        BCS pk1o
        TAY
        LDA (sp1),Y
        JMP pk1s
pk1o:   LDA #0
pk1s:   STA g1
        INC gp
        RTS

; the pair before a dot pair also prepares the sprite bytes for the pair after it (n0, n1)
PairPreDot: STA WSYNC
        LDA g0
        STA GRP0
        LDA g1
        STA GRP1
        LDA gp
        SEC
        SBC pm0
        CMP #8
        BCS pd0o
        TAY
        LDA (sp0),Y
        JMP pd0s
pd0o:   LDA #0
pd0s:   STA g0
        LDA gp
        SEC
        SBC pm0
        SEC
        SBC #1
        CMP #8
        BCS pd2o
        TAY
        LDA (sp0),Y
        JMP pd2s
pd2o:   LDA #0
pd2s:   STA n0
        STA WSYNC
        LDA gp
        SEC
        SBC pm1
        CMP #8
        BCS pd1o
        TAY
        LDA (sp1),Y
        JMP pd1s
pd1o:   LDA #0
pd1s:   STA g1
        LDA gp
        SEC
        SBC pm1
        SEC
        SBC #1
        CMP #8
        BCS pd3o
        TAY
        LDA (sp1),Y
        JMP pd3s
pd3o:   LDA #0
pd3s:   STA n1
        INC gp
        RTS

; a dot pair: full-width asymmetric playfield, six writes per line
PairDot: STA WSYNC
        LDA g0
        STA GRP0
        LDA g1
        STA GRP1
        LDA dots,X
        STA PF0
        LDA dots+1,X
        STA PF1
        LDA dots+2,X
        STA PF2
        LDA dots+3,X
        STA PF0
        LDA dots+4,X
        STA PF1
        LDA dots+5,X
        STA PF2
        LDA n0
        STA g0
        LDA n1
        STA g1
        STA WSYNC
        NOP
        NOP
        NOP
        NOP
        NOP
        NOP
        LDA dots,X
        STA PF0
        LDA dots+1,X
        STA PF1
        LDA dots+2,X
        STA PF2
        LDA dots+3,X
        STA PF0
        LDA dots+4,X
        STA PF1
        LDA dots+5,X
        STA PF2
        INC gp
        RTS

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

; ---------------- game logic ----------------
NextRng: LDA rng
        LSR A
        BCC nr1
        EOR #$B8
nr1:    STA rng
        RTS

NewGame: LDA #0
        STA score
        STA scoreH
        STA level
        LDA #3
        STA lives
        JSR InitDots
        JSR ResetPos
        LDA #0
        STA state
        RTS

InitDots: LDX #0
id1:    LDY #0
id2:    LDA dotpat,Y
        STA dots,X
        INX
        INY
        CPY #6
        BNE id2
        CPX #42
        BNE id1
        LDA #126
        STA dotcnt
        RTS

ResetPos: LDA #80
        STA plx
        LDA #82
        STA ply
        LDA #4
        STA pdir
        STA pwant
        LDA #8
        STA gh
        LDA #10
        STA gh+1
        LDA #0
        STA gh+2
        LDA #144
        STA gh+3
        LDA #10
        STA gh+4
        LDA #1
        STA gh+5
        RTS

Logic:  LDA SWCHB
        LSR A
        BCS nores
        JSR NewGame
nores:  INC fc
        JSR PrepScore
        LDA state
        BEQ play
        CMP #2
        BEQ over
        DEC timer2
        BNE pdone2
        JSR ResetPos
        LDA #0
        STA state
pdone2: RTS
over:   BIT INPT4
        BMI overdone
        JSR NewGame
overdone: RTS

play:   LDA CXPPMM
        BPL nocatch
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
nocatch:
        ; ---- steer: last direction pressed
        LDA SWCHA
        AND #$10
        BNE nu
        LDA #2
        STA pwant
nu:     LDA SWCHA
        AND #$20
        BNE nd
        LDA #3
        STA pwant
nd:     LDA SWCHA
        AND #$40
        BNE nl
        LDA #1
        STA pwant
nl:     LDA SWCHA
        AND #$80
        BNE nr
        LDA #0
        STA pwant
nr:     LDA plx
        STA ex
        LDA ply
        STA ey
        LDA pwant
        CMP #4
        BCS trycur
        JSR TryStep
        BCC trycur
        LDA pwant
        STA pdir
        JMP pmoved
trycur: LDA pdir
        CMP #4
        BCS pmoved
        JSR TryStep
pmoved: LDA ex
        STA plx
        LDA ey
        STA ply
        JSR EatDot
        ; ---- ghosts (a little slower than the player at first)
        LDA level
        CMP #3
        BCS gmove
        LDA fc
        AND #3
        BEQ noghost
gmove:  LDX #0
        STX gidx
        JSR MoveGhost
        LDX #3
        STX gidx
        JSR MoveGhost
noghost:
        LDA dotcnt
        BNE lvdone
        INC level
        JSR InitDots
        JSR ResetPos
lvdone: RTS

; Move one ghost (gidx = 0 or 3)
MoveGhost: LDX gidx
        LDA gh,X
        STA ex
        LDA gh+1,X
        STA ey
        LDA ex
        AND #7
        BNE mgcont
        LDA ey
        JSR AlignY
        BNE mgcont
        JSR ChooseDir
        JMP mgstore
mgcont: LDX gidx
        LDA gh+2,X
        JSR TryStep
        BCS mgstore
        JSR ChooseDir
mgstore: LDX gidx
        LDA ex
        STA gh,X
        LDA ey
        STA gh+1,X
        RTS

; Try dirs in order of preference (chase the player), never turning straight back unless stuck.
ChooseDir: LDA plx
        SEC
        SBC ex
        BCS cd1
        EOR #$FF
        CLC
        ADC #1
        LDY #1
        JMP cd2
cd1:    LDY #0
cd2:    STA hdist
        STY hd
        LDA ply
        SEC
        SBC ey
        BCS cd3
        EOR #$FF
        CLC
        ADC #1
        LDY #2
        JMP cd4
cd3:    LDY #3
cd4:    STA vdist
        STY vd
        LDA vdist
        ASL A
        CMP hdist
        BCS vfirst
        LDA hd
        STA ord
        LDA vd
        STA ord+1
        JMP cd5
vfirst: LDA vd
        STA ord
        LDA hd
        STA ord+1
cd5:    LDA ord+1
        EOR #1
        STA ord+2
        LDA ord
        EOR #1
        STA ord+3
        ; now and then wander: rotate the start of the list
        JSR NextRng
        AND #7
        BNE cd6
        JSR NextRng
        AND #3
        STA ord
        EOR #1
        STA ord+3
cd6:    LDX gidx
        LDA gh+2,X
        EOR #1
        STA tmp3
        LDX #0
cd7:    STX tx
        LDA ord,X
        CMP tmp3
        BEQ cdskip
        JSR TryStep
        BCC cdskip
        LDX gidx
        LDX tx
        LDA ord,X
        LDY gidx
        STA gh+2,Y
        RTS
cdskip: LDX tx
        INX
        CPX #4
        BNE cd7
        ; nothing else worked: turn back
        LDA tmp3
        JSR TryStep
        BCC cdnone
        LDY gidx
        LDA tmp3
        STA gh+2,Y
cdnone: RTS

; A = ey. Returns Z set when the row is on a corridor centre, X = corridor row (0 to 6).
AlignY: SEC
        SBC #10
        BCC ayno
        LDX #0
ay1:    CMP #12
        BCC ay2
        SBC #12
        INX
        BNE ay1
ay2:    CMP #0
        RTS
ayno:   LDX #0
        LDA #1
        RTS

; Move (ex, ey) one step in direction A (0 right, 1 left, 2 up, 3 down). Carry set if it moved.
TryStep: STA tmp
        CMP #2
        BCS tsvert
        LDA ey
        JSR AlignY
        BNE tsno
        LDA tmp
        BNE tsleft
        LDA ex
        CMP #144
        BCS tsno
        INC ex
        SEC
        RTS
tsleft: LDA ex
        CMP #9
        BCC tsno
        DEC ex
        SEC
        RTS
tsvert: LDA ex
        AND #7
        BNE tsno
        LDA ey
        JSR AlignY
        BNE tsmid
        STX tmp2
        LDA tmp
        CMP #2
        BEQ tsup
        INC tmp2
tsup:   LDY tmp2
        LDA bar20,Y
        STA tmp2
        LDA ex
        LSR A
        LSR A
        LSR A
        CLC
        ADC tmp2
        TAY
        LDA gapmap,Y
        BEQ tsno
tsmid:  LDA fc
        AND #1
        BEQ tsdo
        SEC
        RTS
tsdo:   LDA tmp
        CMP #2
        BNE tsdn
        DEC ey
        SEC
        RTS
tsdn:   INC ey
        SEC
        RTS
tsno:   CLC
        RTS

; eat the dot under the player, if there is one
EatDot: LDA plx
        AND #7
        BNE edret
        LDA ply
        JSR AlignY
        BNE edret
        LDA rowoff,X
        STA tmp
        LDA plx
        LSR A
        LSR A
        LSR A
        CMP #10
        BCC edleft
        SEC
        SBC #10
        ASL A
        TAY
        LDA tmp
        CLC
        ADC #3
        STA tmp
        JMP edhave
edleft: ASL A
        TAY
edhave: LDA regof,Y
        CLC
        ADC tmp
        TAX
        LDA dots,X
        AND maskof,Y
        BEQ edret
        LDA dots,X
        EOR maskof,Y
        STA dots,X
        SED
        CLC
        LDA score
        ADC #1
        STA score
        LDA scoreH
        ADC #0
        STA scoreH
        CLD
        DEC dotcnt
edret:  RTS

; three-digit score into the status band: hundreds in PF0, tens and ones in PF1
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
        LDA scoreH
        AND #$0F
        ASL A
        ASL A
        ASL A
        STA tmp3
        LDY #0
ps1:    LDX tmp
        LDA font,X
        ASL A
        ASL A
        ASL A
        ASL A
        ASL A
        STA gidx
        LDX tmp2
        LDA font,X
        ASL A
        ORA gidx
        STA gidx
        LDX tmp3
        LDA fontr,X
        STA tx
        TYA
        ASL A
        TAX
        LDA gidx
        STA sc+2,X
        STA sc+3,X
        LDA tx
        STA sh+2,X
        STA sh+3,X
        INC tmp
        INC tmp2
        INC tmp3
        INY
        CPY #5
        BNE ps1
        RTS

; ---------------- data ----------------
lifetbl: .byte 0,$03,$1B,$DB
dotpat: .byte $40,$AA,$55,$50,$AA,$15
rowoff: .byte 0,6,12,18,24,30,36
bar20:  .byte 0,20,40,60,80,100,120,140
pftab:
        .byte $F0,$FF,$FF
        .byte $F0,$3C,$CF
        .byte $30,$F3,$F3
        .byte $F0,$CF,$3C
        .byte $F0,$3C,$CF
        .byte $30,$F3,$F3
        .byte $F0,$CF,$3C
        .byte $F0,$FF,$FF
        .byte $00,$00,$00
gapmap:
        .byte 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
        .byte 0,0,1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,1,0
        .byte 0,1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,1,0,0
        .byte 0,0,0,1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,1
        .byte 0,0,1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,1,0
        .byte 0,1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,1,0,0
        .byte 0,0,0,1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,1
        .byte 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
regof:  .byte 0,0,0,0,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2
maskof: .byte $10,$20,$40,$80,$80,$40,$20,$10,$08,$04,$02,$01,$01,$02,$04,$08,$10,$20,$40,$80

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
; the same digits mirrored and shifted into PF0 bits 4 to 6 (PF0 runs left to right from bit 4)
fontr:  .byte $70,$50,$50,$50,$70,0,0,0
        .byte $20,$30,$20,$20,$70,0,0,0
        .byte $70,$10,$70,$40,$70,0,0,0
        .byte $70,$10,$70,$10,$70,0,0,0
        .byte $50,$50,$70,$10,$10,0,0,0
        .byte $70,$40,$70,$10,$70,0,0,0
        .byte $70,$40,$70,$50,$70,0,0,0
        .byte $70,$10,$10,$10,$10,0,0,0
        .byte $70,$50,$70,$50,$70,0,0,0
        .byte $70,$50,$70,$10,$70,0,0,0

        .org $FE00
pacspr: .byte $3C,$7E,$F8,$E0,$E0,$F8,$7E,$3C
        .byte $3C,$7E,$FF,$FF,$FF,$FF,$7E,$3C
        .byte $81,$C3,$E7,$FF,$FF,$FF,$7E,$3C
        .byte $3C,$7E,$FF,$FF,$FF,$FF,$7E,$3C
        .byte $3C,$7E,$FF,$FF,$FF,$E7,$C3,$81
        .byte $3C,$7E,$FF,$FF,$FF,$FF,$7E,$3C
ghsspr: .byte $3C,$7E,$DB,$FF,$FF,$FF,$FF,$A5
        .byte $3C,$7E,$DB,$FF,$FF,$FF,$FF,$5A
