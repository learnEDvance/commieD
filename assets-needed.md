# commieD — Asset Manifest

This is the single list of image, video, audio, and font assets the unified game
needs. Paths are suggestions: drop final files into the matching `assets/`
folder and update the central path maps (`dash-supplement-factory/src/assets.js`,
`main-game/src/main.js`, and each minigame's `src/main.js`).

Legend: **P0** required for the current prototype to stop using placeholders,
**P1** needed for a presentable build, **P2** polish.

---

## 1. Global shell and shared UI

| Asset | Type | Suggested path | Format | Size / length | Pri |
|---|---|---|---|---|---|
| commieD emblem / wordmark | image | `shared/assets/logo.svg` | SVG (+ PNG fallback) | 1024×256 viewBox, transparent | P0 |
| Favicon | image | `shared/assets/favicon.svg` | SVG / ICO | 32×32, 64×64 | P0 |
| Lobby background | image | `shared/assets/lobby-bg.webp` | WebP/JPG | 2560×1440 | P1 |
| Paper / newsprint texture | image tile | `shared/assets/paper-grain.png` | PNG | 512×512, seamless | P2 |
| Achievement / medal set | image | `shared/assets/medals/*.svg` | SVG | 128×128 each | P2 |
| Cursor — pointer | image | `shared/assets/cursor-pointer.svg` | SVG/PNG | 32×32 | P2 |
| Cursor — crosshair | image | `shared/assets/cursor-crosshair.svg` | SVG/PNG | 32×32 | P2 |
| Social share card | image | `shared/assets/og-card.png` | PNG | 1200×630 | P2 |
| Loading spinner / emblem | image | `shared/assets/spinner.svg` | SVG | 128×128 | P1 |

## 2. Main game (maze)

### World and characters

| Asset | Type | Suggested path | Format | Size / length | Pri |
|---|---|---|---|---|---|
| Floor tile set (4 variants) | image | `main-game/assets/tiles/floor-*.png` | PNG/WebP | 64×64, tileable | P0 |
| Wall tile set (edge, corner, fill) | image | `main-game/assets/tiles/wall-*.png` | PNG/WebP | 64×64, tileable | P0 |
| Player sprite sheet | image | `main-game/assets/players/player.png` | PNG | 8 directions × 4 frames, 64×64 cells | P0 |
| Collective player sprite sheet | image | `main-game/assets/players/collective.png` | PNG | 8 directions × 4 frames, 64×64 cells | P0 |
| Ghost player sprite sheet | image | `main-game/assets/players/ghost.png` | PNG | 4 frames, 64×64 cells, additive | P0 |
| Team banners / flags | image | `main-game/assets/team/*.svg` | SVG | 256×128 | P1 |
| Spawn-zone decal (per team) | image | `main-game/assets/team/spawn-decal.svg` | SVG | 512×512 | P1 |
| Muzzle flash | image | `main-game/assets/fx/muzzle.png` | PNG | 128×128, additive | P1 |
| Bullet tracer | image | `main-game/assets/fx/tracer.svg` | SVG | 128×16 | P1 |
| Bomb sprite + fuse spark | image | `main-game/assets/fx/bomb.png` | PNG | 64×64 + 32×32 | P1 |
| Explosion sheet | image | `main-game/assets/fx/explosion.png` | PNG | 8×8 frames, 256×256 cells | P1 |
| Dash dust | image | `main-game/assets/fx/dash-dust.png` | PNG | 6 frames, 128×128 | P2 |
| Blood / hit splat (stylised ink) | image | `main-game/assets/fx/hit-ink.png` | PNG | 4 frames, 128×128 | P2 |
| Minimap frame / compass | image | `main-game/assets/ui/minimap-frame.svg` | SVG | 256×256 | P2 |

### Item icons

| Asset | Type | Suggested path | Format | Size | Pri |
|---|---|---|---|---|---|
| Bomb | image | `main-game/assets/items/bomb.svg` | SVG | 64×64 | P0 |
| HP capsule | image | `main-game/assets/items/hp.svg` | SVG | 64×64 | P0 |
| Speed bottle | image | `main-game/assets/items/speed.svg` | SVG | 64×64 | P0 |
| Gun+ | image | `main-game/assets/items/gun-plus.svg` | SVG | 64×64 | P0 |
| Phaseless | image | `main-game/assets/items/phaseless.svg` | SVG | 64×64 | P0 |
| Coat | image | `main-game/assets/items/coat.svg` | SVG | 64×64 | P0 |
| Item pedestal / glow | image | `main-game/assets/items/pedestal.svg` | SVG | 96×96 | P1 |

### Video

| Asset | Type | Suggested path | Format | Length | Pri |
|---|---|---|---|---|---|
| Intro / match-start broadcast | video | `main-game/assets/video/intro.mp4` | H.264 MP4 + WebM | 4–6 s, 1920×1080, loopable | P1 |
| Victory broadcast | video | `main-game/assets/video/victory.mp4` | MP4 + WebM | 5–8 s, 1920×1080 | P1 |
| Defeat broadcast | video | `main-game/assets/video/defeat.mp4` | MP4 + WebM | 5–8 s, 1920×1080 | P1 |
| Ghost-shift transition | video | `main-game/assets/video/ghost-shift.mp4` | MP4 + WebM | 1–2 s, 1280×720, alpha preferred | P2 |

## 3. Soul Clicker (ghost minigame)

| Asset | Type | Suggested path | Format | Size / length | Pri |
|---|---|---|---|---|---|
| Soul idol / clickable heart | image | `soul-clicker/assets/soul.svg` | SVG (+ 2× PNG) | 512×512 | P0 |
| Soul idle pulse (optional sprite) | image | `soul-clicker/assets/soul-pulse.png` | PNG | 8 frames, 512×512 | P2 |
| Soul shard shapes (5) | image | `soul-clicker/assets/shards/*.svg` | SVG | 64×64 each | P0 |
| Shard glow / aura | image | `soul-clicker/assets/shards/glow.png` | PNG | 256×256, additive | P1 |
| Click burst | image | `soul-clicker/assets/fx/burst.png` | PNG | 6 frames, 256×256 | P1 |
| Low-CPS warning vignette | image | `soul-clicker/assets/fx/low-cps.png` | PNG | 1920×1080, alpha | P2 |
| HP bar frame / rivets | image | `soul-clicker/assets/ui/hp-frame.svg` | SVG | 1024×96 | P1 |

## 4. Bullet Press (ghost minigame)

| Asset | Type | Suggested path | Format | Size / length | Pri |
|---|---|---|---|---|---|
| Magazine body | image | `bullet-press/assets/magazine.svg` | SVG | 256×128 | P0 |
| Bullet (green / red / gold) | image | `bullet-press/assets/bullet-*.svg` | SVG | 32×96 each | P0 |
| Press machine body | image | `bullet-press/assets/press.svg` | SVG | 1024×512 | P1 |
| Conveyor belt tile | image | `bullet-press/assets/belt.png` | PNG | 256×64, seamless | P1 |
| Feed chute | image | `bullet-press/assets/chute.svg` | SVG | 256×512 | P1 |
| Sparks / metal chips | image | `bullet-press/assets/fx/sparks.png` | PNG | 8 frames, 128×128 | P1 |
| Broken-magazine stamp | image | `bullet-press/assets/fx/rejected.svg` | SVG | 512×256 | P1 |
| Perfect-magazine stamp | image | `bullet-press/assets/fx/perfect.svg` | SVG | 512×256 | P1 |
| Line lamp (idle / run / fault) | image | `bullet-press/assets/ui/lamp-*.svg` | SVG | 64×64 each | P2 |

## 5. Dash Supplement Factory (shared ghost minigame)

| Asset | Type | Suggested path | Format | Size / length | Pri |
|---|---|---|---|---|---|
| Empty pot | image | `dash-supplement-factory/assets/pot-empty.svg` | SVG | 128×192 | P0 |
| Filled pot (per liquid colour) | image | `dash-supplement-factory/assets/pot-*.svg` | SVG | 128×192 each | P1 |
| Bottle | image | `dash-supplement-factory/assets/bottle.svg` | SVG | 128×256 | P0 |
| Vial | image | `dash-supplement-factory/assets/vial.svg` | SVG | 64×128 | P0 |
| Grain mill | image | `dash-supplement-factory/assets/stations/mill.svg` | SVG | 512×512 | P1 |
| Mash vat | image | `dash-supplement-factory/assets/stations/vat.svg` | SVG | 512×512 | P1 |
| Agitator press | image | `dash-supplement-factory/assets/stations/press.svg` | SVG | 512×512 | P1 |
| Spirit still | image | `dash-supplement-factory/assets/stations/still.svg` | SVG | 512×512 | P1 |
| Purity filter | image | `dash-supplement-factory/assets/stations/filter.svg` | SVG | 512×512 | P1 |
| Plan bureau | image | `dash-supplement-factory/assets/stations/bureau.svg` | SVG | 512×512 | P1 |
| Bottler | image | `dash-supplement-factory/assets/stations/bottler.svg` | SVG | 768×512 | P1 |
| Floor plate / grid | image | `dash-supplement-factory/assets/floor.png` | PNG | 512×512, seamless | P1 |
| Conveyor tile | image | `dash-supplement-factory/assets/conveyor.png` | PNG | 256×64, seamless | P1 |
| Pipe set (straight, elbow, T) | image | `dash-supplement-factory/assets/pipes/*.svg` | SVG | 128×128 each | P2 |
| Liquid splash / bubble | image | `dash-supplement-factory/assets/fx/liquid.png` | PNG | 8 frames, 128×128 | P2 |
| Steam puff | image | `dash-supplement-factory/assets/fx/steam.png` | PNG | 10 frames, 256×256 | P2 |
| Wasted-batch stamp | image | `dash-supplement-factory/assets/fx/wasted.svg` | SVG | 512×256 | P1 |
| Remote-player cursor (4 colours) | image | `shared/assets/cursor-camarade-*.svg` | SVG | 48×48 each | P0 |
| Pot owner tag / nameplate | image | `shared/assets/nameplate.svg` | SVG | 256×64 | P1 |

## 6. Audio

### Music

| Asset | Type | Suggested path | Format | Length | Pri |
|---|---|---|---|---|---|
| Menu / lobby anthem | audio | `shared/audio/music/lobby.*` | OGG + MP3 | 90–150 s loop | P1 |
| Main-game tension loop | audio | `shared/audio/music/maze-loop.*` | OGG + MP3 | 120 s loop | P1 |
| Ghost-shift loop | audio | `shared/audio/music/ghost-loop.*` | OGG + MP3 | 90 s loop | P1 |
| Victory sting | audio | `shared/audio/music/victory.*` | OGG + MP3 | 8–12 s | P1 |
| Defeat sting | audio | `shared/audio/music/defeat.*` | OGG + MP3 | 8–12 s | P1 |

### UI and main game SFX

| Asset | Type | Suggested path | Format | Length | Pri |
|---|---|---|---|---|---|
| UI hover | audio | `shared/audio/ui/hover.*` | OGG + MP3 | 60–120 ms | P1 |
| UI confirm | audio | `shared/audio/ui/confirm.*` | OGG + MP3 | 150–300 ms | P1 |
| UI back | audio | `shared/audio/ui/back.*` | OGG + MP3 | 150–300 ms | P1 |
| Shot | audio | `main-game/assets/audio/shot.*` | OGG + MP3 | 120–250 ms | P0 |
| Bullet impact | audio | `main-game/assets/audio/impact.*` | OGG + MP3 | 100–200 ms | P0 |
| Dash | audio | `main-game/assets/audio/dash.*` | OGG + MP3 | 200–350 ms | P1 |
| Bomb throw | audio | `main-game/assets/audio/bomb-throw.*` | OGG + MP3 | 200 ms | P1 |
| Bomb explosion | audio | `main-game/assets/audio/explosion.*` | OGG + MP3 | 900–1400 ms | P0 |
| Item pickup | audio | `main-game/assets/audio/pickup.*` | OGG + MP3 | 250 ms | P1 |
| Special triggered | audio | `main-game/assets/audio/special.*` | OGG + MP3 | 400 ms | P1 |
| Team downed | audio | `main-game/assets/audio/team-down.*` | OGG + MP3 | 800 ms | P1 |
| Team revived | audio | `main-game/assets/audio/team-revive.*` | OGG + MP3 | 900 ms | P1 |
| Ghost shift | audio | `main-game/assets/audio/ghost-shift.*` | OGG + MP3 | 600 ms | P1 |
| Low HP warning loop | audio | `main-game/assets/audio/low-hp-loop.*` | OGG + MP3 | 2 s loop | P2 |

### Minigame SFX

| Asset | Type | Suggested path | Format | Length | Pri |
|---|---|---|---|---|---|
| Soul click | audio | `soul-clicker/assets/audio/click.*` | OGG + MP3 | 80–150 ms | P0 |
| Soul shard collect | audio | `soul-clicker/assets/audio/shard.*` | OGG + MP3 | 250 ms | P1 |
| Low-CPS drone loop | audio | `soul-clicker/assets/audio/low-cps-loop.*` | OGG + MP3 | 3 s loop | P2 |
| Key press (correct) | audio | `bullet-press/assets/audio/key-good.*` | OGG + MP3 | 60–120 ms | P0 |
| Key press (wrong) | audio | `bullet-press/assets/audio/key-bad.*` | OGG + MP3 | 120–200 ms | P0 |
| Magazine complete | audio | `bullet-press/assets/audio/magazine.*` | OGG + MP3 | 300 ms | P1 |
| Magazine rejected | audio | `bullet-press/assets/audio/rejected.*` | OGG + MP3 | 400 ms | P1 |
| Machine hum loop | audio | `dash-supplement-factory/assets/audio/factory-loop.*` | OGG + MP3 | 4 s loop | P1 |
| Pot pickup / drop | audio | `dash-supplement-factory/assets/audio/pot-*.*` | OGG + MP3 | 150–250 ms | P0 |
| Station process complete | audio | `dash-supplement-factory/assets/audio/process.*` | OGG + MP3 | 400 ms | P1 |
| Batch wasted | audio | `dash-supplement-factory/assets/audio/wasted.*` | OGG + MP3 | 600 ms | P1 |
| Bottle finished | audio | `dash-supplement-factory/assets/audio/bottle.*` | OGG + MP3 | 700 ms | P1 |

### Voice / announcer (optional)

| Asset | Type | Suggested path | Format | Length | Pri |
|---|---|---|---|---|---|
| Match start | audio | `shared/audio/voice/match-start.*` | OGG + MP3 | 2 s | P2 |
| Team down | audio | `shared/audio/voice/team-down.*` | OGG + MP3 | 2 s | P2 |
| Victory | audio | `shared/audio/voice/victory.*` | OGG + MP3 | 3 s | P2 |
| Defeat | audio | `shared/audio/voice/defeat.*` | OGG + MP3 | 3 s | P2 |
| Ghost shift prompt | audio | `shared/audio/voice/ghost-shift.*` | OGG + MP3 | 2 s | P2 |

## 7. Fonts

| Asset | Type | Suggested path | Format | Pri |
|---|---|---|---|---|
| Display / propaganda headline | font | `shared/fonts/display.woff2` | WOFF2 | P1 |
| UI sans (Latin + Cyrillic) | font | `shared/fonts/ui.woff2` | WOFF2 | P1 |
| Monospace / typewriter | font | `shared/fonts/typewriter.woff2` | WOFF2 | P2 |

Use open licences (OFL) and include the licence files next to the fonts.

## 8. Delivery rules

- Ship WebP/AVIF for large stills, SVG for icons, OGG Vorbis with MP3 fallback
  for audio, and H.264 MP4 with WebM fallback for video.
- Keep loops seamless and provide short one-shots at 48 kHz mono; music at
  44.1/48 kHz stereo.
- Every visual must remain legible at the 2-tile corridor scale and inside the
  ghost-shift iframe (minimum 640×480).
- Add new paths to the manifest and to the central asset maps in the same
  commit. Do not hard-code URLs inside game logic.
- Placeholder assets stay in `assets/` until the final asset lands; never delete
  a working placeholder without a replacement.
