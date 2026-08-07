# STATION AURORA-9

A pixel-art horror game about a dead deep-space station, a flashlight, and
something that only moves in the dark.

Heavy on **atmosphere and narrative**, built around **exploration and mystery
solving**. There is **no combat** — your only defense is light, and your only
weapons are patience and the truth you piece together from the crew's logs.

> *"Do not trust the dark. It is not empty."* — Capt. R. Vance

---

## Play it

**Just open `index.html` in any modern browser.** No install, no build step,
no server. Headphones strongly recommended — the entire soundtrack (reactor
drone, hull groans, heartbeat, stingers) is synthesized live in your browser.

### Controls

**Keyboard**

| Input | Action |
|---|---|
| **WASD** / **Arrow keys** | Move (your flashlight follows your direction) |
| **E** / **Space** / **Enter** | Interact · read logs · confirm |
| **Shift** (hold) | Hold your breath — stand still and go quiet |
| **Esc** | Close a log / cancel a keypad / skip the intro |

**Touch (mobile)** — on-screen controls appear automatically on touch devices:

| Control | Action |
|---|---|
| **Left half of screen** | Floating virtual joystick — press and drag anywhere to move |
| **E button** (bottom-right) | Interact · read logs · confirm · skip intro |
| **HOLD BREATH button** | Press and hold to stand still and go quiet |
| **Tap a log's dim background** | Close it. Keypads are tap-to-type; tap outside to cancel |

The layout is landscape-friendly; turn your phone sideways for the best view.

---

## The story

You are the solo responder aboard the salvage vessel **Kestrel**, sent to
investigate a distress beacon that has been looping out of deep-survey station
**Aurora-9** for sixty-three days.

Fourteen souls were aboard. The station is dark. The reactor is cold.

To learn what happened you'll need to bring the lights back up — and the moment
you do, you'll understand exactly why the crew turned them off. Restore power,
recover the command keycard, reach the bridge, and make the choice Captain
Vance couldn't: **warn the fleet, or burn it all down.**

### Objectives (spoiler-light)

1. **Find a light source** in the docking bay.
2. **Restore main power** at Reactor Control — the ignition code is in a
   crew log nearby.
3. **Recover the command keycard** from the captain's safe — its code is
   hidden in the research archives, which only open once power is on.
4. **Reach the Command Bridge** and decide how the loop ends.

The presence awakens when the power comes on. **Keep your beam on it to freeze
it; look away and it closes in.** Bright rooms hold it back. If it catches you,
you wake at the last lit doorway — keep to the light.

At the bridge you get **three endings**: broadcast the warning, scuttle the
station, or leave the loop running and walk away.

### Decks & extras

Seven connected decks: Docking Bay, Corridor Junction, Reactor Control,
**Hydroponics** (an overgrown garden with its own maintenance-hatch shortcut
that opens once power is on), Research Lab, Medical Bay, Crew Quarters, and the
Command Bridge.

- **11 crew logs** tell the full story; two of them hide the puzzle codes.
- **4 pieces of optional salvage** — personal effects scattered across the
  station for anyone who explores thoroughly.
- An **inventory / progress HUD** tracks your gear, logs read, and salvage found.

---

## Project layout

```
index.html        # shell + DOM overlays (title, log reader, keypad, endings)
styles.css        # CRT/terminal presentation, scanlines, vignette
src/
  util.js         # AURORA namespace, math helpers, event bus
  audio.js        # 100% procedural Web Audio (drone, groans, heartbeat, stingers)
  input.js        # keyboard + touch
  story.js        # ALL authored content: layout, logs, puzzle codes, endings
  world.js        # builds the tile grid from room rectangles; collision; tiles
  lighting.js     # raycast flashlight cone with wall shadows + ambient light
  entities.js     # interactable consoles/items + THE PRESENCE (its AI)
  player.js       # movement, wall-sliding, facing, hold-breath
  ui.js           # log reader, keypad puzzles, subtitles, objective, inventory, endings
  mobile.js       # on-screen touch controls (floating joystick + buttons)
  game.js         # main loop, camera, state machine, story beats
```

### Design notes

- **No external assets.** Every sprite is drawn procedurally to `<canvas>` and
  every sound is synthesized, so the game is fully self-contained and runs from
  `file://`.
- The map is defined as **room + corridor rectangles** in `story.js`, not a
  hand-drawn tilemap, so the geometry is verifiable by coordinate. Rooms are
  wrapped in walls automatically and linked by overlapping corridor rects.
- The flashlight uses a **raycast visibility polygon**, so walls actually cast
  shadows and you can't see through them.

## Extending it

Want more of the station? Almost everything is data in `src/story.js`:

- Add a room to `rooms` and a corridor to `corridors` to link it in.
- Add a `log` terminal for lore, or a `keypad` puzzle, in `terminals`.
- Drop new `items`, `doors`, or presence `waypoints`.

There's a headless validator in the repo's history (`scratchpad/validate.js`
during development) that flood-fills the map to confirm every new object is on
a real floor tile and reachable.

---

*A pixel horror. Mind the dark.*
