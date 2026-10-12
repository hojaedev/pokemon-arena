# PMD SpriteCollab assets

Source: [PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab), pinned at commit `cd566fffbcd8e1001cee8ec511f42c07e8d65457` (retrieved 2026-10-11).

## Included

- `pikachu/`: #0025 Pikachu. Idle, Walk, Attack, Hurt, Shock, QuickStrike, Shoot, Charge, Pain, Faint, `AnimData.xml`, per-frame offsets/shadows, raw sprite credits, and 40x40 Normal portrait with raw portrait credits.
- `typhlosion/`: #0157 Typhlosion. Idle, Walk, Attack, Hurt, Strike, Shoot, Charge, Swing, Pain, Faint, `AnimData.xml`, per-frame offsets/shadows, raw sprite credits, and 40x40 Normal portrait with raw portrait credits.
- Each creature has `animations.json` with exact frame/sheet dimensions, timings, event frames, URLs, and SHA-256 hashes.
- `../sprite-credits.json` contains structured attribution and license notes.

## Sheet layout

For every `*-Anim.png`, frames advance left to right. Direction rows run top to bottom in this exact order:

`down`, `downRight`, `right`, `upRight`, `up`, `upLeft`, `left`, `downLeft`

Crop a frame with:

- `sx = frameIndex * frameWidth`
- `sy = directionIndex * frameHeight`
- source rectangle: `(sx, sy, frameWidth, frameHeight)`

Durations in `AnimData.xml` and the manifests are 1/60-second frames. The manifest also supplies rounded milliseconds.

Matching `*-Offsets.png` and `*-Shadow.png` use the identical grid. Offset marker colors are green body center, red left hand, blue right hand, and black head. In the shadow sheets, the white pixel is the sprite/shadow anchor; RGB channels describe small/normal/large shadow regions.

## Rendering

Keep the source PNGs at native resolution and render with nearest-neighbor filtering. For the project's 1280x720 logical canvas, use 2x as the default display scale. Use 3x only for close-ups; avoid fractional scaling and smoothing. The HUD portraits are 40x40 native and look appropriate at 80x80 (2x).

## Attribution and licensing

Preserve each bundled `credits.txt`. SpriteCollab's repository submission policy is CC BY-NC 4.0 with attribution, but its per-file records mark official CHUNSOFT artwork as `Unspecified`. Do not relabel official files as CC BY-NC. See `../sprite-credits.json` for the exact per-creature credits and the historical `PMDCollab_1` permission statement.
