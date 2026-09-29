#!/usr/bin/env python3
"""Regenerates the README screenshots in docs/. Optional: needs `pip install playwright && playwright install chromium`.
Run from the repo root after `npm run build`:  python3 tools/screenshots.py"""
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri()
OUT = ROOT / 'docs'
OUT.mkdir(exist_ok=True)


def open_program_panel(pg):
    pg.evaluate("document.querySelector('#progd').open = true")


def overview(pg):
    pass


def adder(pg):
    """Mid-way through ADC #$01 with A = $FF: the carry is rippling through the adder cells."""
    pg.evaluate("window.__explorer.setLevel(0)")
    open_program_panel(pg)
    pg.select_option('#demoSel', '1')  # Carry ripple
    pg.wait_for_timeout(200)
    pg.click('#bStep')
    pg.wait_for_timeout(300)
    pg.evaluate("window.__explorer.flyTo('alu', true)")
    for _ in range(60):
        pg.click('#bMicro')
        pg.wait_for_timeout(60)
        kind = pg.evaluate("window.__explorer.cur.phases[window.__explorer.cur.idx].kind")
        text = pg.evaluate("window.__explorer.cur.text")
        if kind == 'alu' and text.startswith('ADC'):
            break
    pg.wait_for_timeout(900)


def picture(pg):
    """The rainbow-bars kernel at real-time speed, zoomed into the TIA."""
    open_program_panel(pg)
    pg.select_option('#demoSel', '5')
    pg.evaluate("window.__explorer.setLevel(4)")
    pg.click('#bRun')
    pg.wait_for_timeout(2500)
    pg.evaluate("window.__explorer.flyTo('tia', true)")
    pg.wait_for_timeout(500)


def ram(pg):
    open_program_panel(pg)
    pg.select_option('#demoSel', '3')  # RAM fill
    pg.evaluate("window.__explorer.setLevel(3)")
    pg.click('#bRun')
    pg.wait_for_timeout(1300)
    pg.evaluate("window.__explorer.flyTo('riot', true)")
    pg.wait_for_timeout(300)


def die(pg):
    """The CPU as a toy die floorplan, with the regions glowing while LDA #$55 runs."""
    open_program_panel(pg)
    pg.select_option('#demoSel', '1')
    pg.evaluate("window.__explorer.flyTo('cpu', true)")
    for _ in range(14):
        pg.click('#bMicro')
        pg.wait_for_timeout(90)




JOBS = [
    ('overview', 1400, 860, 'dark', overview),
    ('die', 1400, 860, 'dark', die),
    ('adder', 1400, 860, 'dark', adder),
    ('tia-picture', 1400, 860, 'dark', picture),
    ('riot-ram', 1400, 860, 'dark', ram),
    ('overview-light', 1400, 860, 'light', overview),
    ('phone-adder', 400, 860, 'dark', adder),
]

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, w, h, scheme, action in JOBS:
        page = browser.new_page(viewport={'width': w, 'height': h}, color_scheme=scheme)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL)
        page.wait_for_timeout(500)
        action(page)
        page.screenshot(path=str(OUT / (name + '.png')))
        print(name, 'ok' if not errors else errors)
        page.close()
    browser.close()
