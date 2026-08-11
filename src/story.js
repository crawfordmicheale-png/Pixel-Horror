/* story.js — all authored content for STATION AURORA-9.
   The world is built from rectangles (rooms + corridors) so the layout is
   verifiable by coordinate rather than hand-drawn ASCII. Everything the
   player reads, every puzzle code, and every gate lives here. */
(function () {
  "use strict";
  const AURORA = window.AURORA;

  const STORY = (AURORA.story = {});

  // --- Puzzle codes (also embedded, in-fiction, in the logs below) ---
  STORY.REACTOR_CODE = "7419"; // spoken in Log 2 (chief engineer)
  STORY.SAFE_CODE = "2317";    // spoken in Log 5 (research data console)

  // --- Rooms: interior floor rectangles (tile coords). ---
  // lit: has ceiling lights that come on with main power.
  // emergency: keeps a faint light even when power is out.
  STORY.rooms = [
    { id: "dock",    x: 3,  y: 25, w: 12, h: 8,  name: "DOCKING BAY A",     emergency: true },
    { id: "quarters",x: 3,  y: 3,  w: 14, h: 9,  name: "CREW QUARTERS",     lit: true },
    { id: "medical", x: 22, y: 3,  w: 12, h: 9,  name: "MEDICAL BAY",       lit: true },
    { id: "research",x: 39, y: 3,  w: 14, h: 10, name: "RESEARCH LAB",      lit: true, glow: true },
    { id: "bridge",  x: 23, y: 16, w: 11, h: 6,  name: "COMMAND BRIDGE",    lit: true },
    { id: "junction",x: 22, y: 25, w: 8,  h: 7,  name: "CORRIDOR JUNCTION", emergency: true },
    { id: "engine",  x: 36, y: 23, w: 16, h: 10, name: "REACTOR CONTROL",   glow: true },
    { id: "hydro",   x: 3,  y: 14, w: 13, h: 9,  name: "HYDROPONICS",       lit: true },
    // ---- Right wing (reached post-power, via Research) ----
    { id: "cryo",    x: 55, y: 4,  w: 14, h: 11, name: "CRYOGENICS",        lit: true },
    { id: "observ",  x: 55, y: 17, w: 16, h: 10, name: "OBSERVATION DECK",  lit: true },
    { id: "cargo",   x: 53, y: 29, w: 16, h: 10, name: "CARGO BAY",         emergency: true },
    // ---- Containment: gated by the maintenance keycard ----
    { id: "contain", x: 36, y: 34, w: 14, h: 9,  name: "CONTAINMENT",       glow: true },
  ];

  // --- Corridors: thin floor rectangles that overlap two rooms to link them.
  STORY.corridors = [
    { x: 14, y: 27, w: 9,  h: 2 },  // C2 dock <-> junction
    { x: 29, y: 27, w: 8,  h: 2 },  // C3 junction <-> engineering
    { x: 26, y: 21, w: 2,  h: 5 },  // C4 junction <-> bridge (keycard door)
    { x: 44, y: 12, w: 2,  h: 12 }, // C8 engineering <-> research (power door)
    { x: 33, y: 6,  w: 7,  h: 2 },  // C7 research <-> medical
    { x: 16, y: 6,  w: 7,  h: 2 },  // C6 medical <-> quarters
    { x: 8,  y: 22, w: 2,  h: 4 },  // C9 dock <-> hydroponics (open, early access)
    { x: 8,  y: 11, w: 2,  h: 4 },  // C10 hydroponics <-> quarters (power door)
    { x: 52, y: 7,  w: 4,  h: 2 },  // CR1 research <-> cryo
    { x: 61, y: 13, w: 2,  h: 5 },  // OB1 cryo <-> observation
    { x: 60, y: 26, w: 2,  h: 4 },  // CG1 observation <-> cargo
    { x: 42, y: 31, w: 2,  h: 4 },  // CT1 engine <-> containment (maint. keycard door)
  ];

  // --- Doors: gate a set of tiles until a condition is met. ---
  STORY.doors = [
    {
      id: "bridge_door", type: "keycard",
      tiles: [ [26, 22], [27, 22] ],
      lockedMsg: "COMMAND HATCH — sealed. Requires command keycard.",
      openMsg: "Command keycard accepted. Hatch cycling open.",
    },
    {
      id: "research_door", type: "power",
      tiles: [ [44, 14], [45, 14] ],
      lockedMsg: "BLAST DOOR — no power. Restore main reactor to proceed.",
      openMsg: "Blast door disengaging.",
    },
    {
      id: "hydro_door", type: "power",
      tiles: [ [8, 12], [9, 12] ],
      lockedMsg: "MAINTENANCE HATCH — no power. It won't budge.",
      openMsg: "The maintenance hatch grinds open. A shortcut, now.",
    },
    {
      id: "contain_door", type: "maintenance",
      tiles: [ [42, 33], [43, 33] ],
      lockedMsg: "CONTAINMENT SEAL — requires a maintenance keycard.",
      openMsg: "Maintenance keycard accepted. The containment seal parts.",
    },
  ];

  // --- Items you can pick up. ---
  // kind "key" items matter to progression; "salvage" are optional personal
  // effects that reward exploration (tracked as SALVAGE x/y).
  STORY.items = [
    {
      id: "flashlight", glyph: "f", x: 11, y: 27, kind: "key",
      name: "FLASHLIGHT",
      pickup: "You pry the flashlight from a dead responder's hand. The beam stutters, then holds.",
    },
    // ---- Salvage (optional collectibles) ----
    {
      id: "salvage_photo", glyph: "s", x: 4, y: 10, kind: "salvage",
      name: "A CREW PHOTO",
      pickup: "SALVAGE — A crew photo. Fourteen people squint into a sun they'll never see again. Someone drew a small heart around one of the faces.",
    },
    {
      id: "salvage_tags", glyph: "s", x: 32, y: 4, kind: "salvage",
      name: "DOG TAGS",
      pickup: "SALVAGE — Dog tags: DOYLE, M. Still warm. You tell yourself that's the ventilation.",
    },
    {
      id: "salvage_drawing", glyph: "s", x: 14, y: 21, kind: "salvage",
      name: "A CHILD'S DRAWING",
      pickup: "SALVAGE — A child's crayon drawing, pinned above a workbench: a stick-figure family, a green garden, and a tall black smudge standing just behind them.",
    },
    {
      id: "salvage_ring", glyph: "s", x: 50, y: 11, kind: "salvage",
      name: "A WEDDING RING",
      pickup: "SALVAGE — A wedding ring on the lab floor, engraved: 'come home to the light.' The finger it belonged to is nowhere in sight.",
    },
    // ---- Batteries (recharge the flashlight) ----
    {
      id: "batt_engine", glyph: "b", x: 49, y: 25, kind: "battery",
      name: "POWER CELL",
      pickup: "You slot a fresh power cell into the flashlight. The beam brightens.",
    },
    {
      id: "batt_cryo", glyph: "b", x: 58, y: 7, kind: "battery",
      name: "POWER CELL",
      pickup: "A power cell, frost-cold from the cryo bay. The flashlight drinks it down.",
    },
    {
      id: "batt_observ", glyph: "b", x: 58, y: 22, kind: "battery",
      name: "POWER CELL",
      pickup: "Another power cell. You top off the flashlight while you still can.",
    },
    {
      id: "batt_cargo1", glyph: "b", x: 55, y: 36, kind: "battery",
      name: "POWER CELL",
      pickup: "A crate of power cells, mostly looted. You take a good one.",
    },
    {
      id: "batt_cargo2", glyph: "b", x: 66, y: 33, kind: "battery",
      name: "POWER CELL",
      pickup: "One more cell. Ballast against the dark.",
    },
    // ---- Maintenance keycard (gates Containment) ----
    {
      id: "maint_keycard", glyph: "c", x: 60, y: 37, kind: "maintkey",
      name: "MAINTENANCE KEYCARD",
      pickup: "A maintenance keycard, clipped to a work vest with no one in it. The containment deck is yours to open now.",
    },
    // ---- Containment override: REQUIRED to use the bridge command console ----
    {
      id: "contain_auth", glyph: "a", x: 44, y: 40, kind: "auth",
      name: "CONTAINMENT OVERRIDE",
      pickup: "You take Marrow's override key from the dead cradle at the cage's heart. Only now will the bridge answer to you. Now you have seen what you are choosing for.",
    },
  ];

  // --- Lockers: hide inside to break the presence's line of sight. ---
  STORY.lockers = [
    { id: "lk_cryo1",   x: 56, y: 5 },
    { id: "lk_cryo2",   x: 67, y: 13 },
    { id: "lk_observ",  x: 69, y: 25 },
    { id: "lk_cargo1",  x: 54, y: 30 },
    { id: "lk_cargo2",  x: 67, y: 30 },
    { id: "lk_med",     x: 22, y: 10 },
  ];

  // --- Decorative props: non-blocking set dressing that gives each deck an
  //     identity. Items with a `label` are named by the flashlight scanner. ---
  STORY.props = [
    // Docking Bay
    { kind: "body", x: 10, y: 27, label: "DEAD RESPONDER" },
    { kind: "crate", x: 4, y: 31 },
    // Crew Quarters — bunks
    { kind: "bunk", x: 5, y: 6 }, { kind: "bunk", x: 5, y: 9 },
    { kind: "bunk", x: 15, y: 6 },
    // Medical — beds
    { kind: "medbed", x: 25, y: 6 }, { kind: "medbed", x: 28, y: 6 }, { kind: "medbed", x: 31, y: 6 },
    // Hydroponics — overgrowth
    { kind: "plant", x: 5, y: 16, label: "BLACK OVERGROWTH" }, { kind: "plant", x: 7, y: 21 },
    { kind: "plant", x: 12, y: 16 }, { kind: "plant", x: 10, y: 20 },
    // Research — benches + a body
    { kind: "bench", x: 46, y: 10 }, { kind: "bench", x: 49, y: 6 },
    { kind: "body", x: 42, y: 11, label: "RESEARCHER'S REMAINS" },
    // Reactor Control — the core
    { kind: "core", x: 40, y: 29, label: "REACTOR CORE" },
    // Cryogenics — pods
    { kind: "pod", x: 59, y: 6, label: "CRYO POD — OCCUPIED" }, { kind: "pod", x: 63, y: 6, label: "CRYO POD — OCCUPIED" },
    { kind: "pod", x: 59, y: 12, label: "CRYO POD — OCCUPIED" },
    { kind: "podopen", x: 65, y: 12, label: "CRYO POD 3 — FORCED OPEN" },
    // Observation — the comet beyond the glass
    { kind: "comet", x: 63, y: 19, label: "THE COMET — SOURCE" },
    // Cargo — crates
    { kind: "crate", x: 56, y: 31 }, { kind: "crate", x: 63, y: 31 }, { kind: "crate", x: 57, y: 36 },
    { kind: "crateopen", x: 65, y: 31, label: "CRATE C-7 — EMPTY" },
    // Containment — the cradle at the cage's heart
    { kind: "cradle", x: 41, y: 38, label: "CONTAINMENT CRADLE" },
    // Junction
    { kind: "body", x: 24, y: 30, label: "CREW REMAINS" },
  ];

  // --- Interactive consoles / terminals / puzzles. ---
  // kind: "log" (reader), "reactor" (keypad -> power), "safe" (keypad -> keycard),
  //       "broadcast" (finale).
  STORY.terminals = [
    // ------- DOCK -------
    {
      id: "log_dock", kind: "log", x: 4, y: 26,
      source: "// EMERGENCY BEACON — CAPT. R. VANCE",
      title: "Automated Distress — Loop 0447",
      body:
`If you're hearing this, the beacon is still cycling. Good.

Aurora-9. Deep survey station. Registry says fourteen souls aboard.
That number is a lie now.

Main power is down. Something in the reactor tripped every breaker
we had — like the station itself flinched.

Do not trust the dark. It is not empty.
Get to Reactor Control. Bring the lights up.
And then, please — end the loop. Shut us up for good.

— Vance. Out.`,
    },

    // ------- ENGINEERING -------
    {
      id: "log_eng1", kind: "log", x: 38, y: 24,
      source: "// CHIEF ENGINEER K. OSEI",
      title: "Reactor Ignition — Handover Notes",
      body:
`Whoever restarts her: listen close.

Cold-start ignition sequence for the mains is locked behind my code.
I'm not writing it on a sticky note for the Object to read.

It's the date we lost the first man. Seventh of the fourth. One... nine.
7-4-1-9. Punch it into the reactor console and hold.

The core will scream. Let it. That's just metal.
The other screaming — that isn't.`,
    },
    {
      id: "log_eng2", kind: "log", x: 49, y: 31,
      source: "// MAINTENANCE — AUTO-TRANSCRIPT",
      title: "Fault Log (partial)",
      body:
`03:12 — corridor lights, deck B: FAULT
03:12 — motion in deck B corridor: 1 contact
03:13 — crew tags in deck B corridor: 0
03:13 — motion in deck B corridor: 1 contact
03:14 — audio: [banging] [banging] [wet]
03:14 — motion: contact now at Reactor Control door
03:15 — SYSTEM: who turned off the lights
03:15 — SYSTEM: who turned off the lights
03:15 — SYSTEM: who turned off the lights`,
    },
    {
      id: "reactor", kind: "reactor", x: 44, y: 24,
      source: "// REACTOR CONTROL",
      label: "COLD-START — ENTER IGNITION CODE",
      lockedMsg: "REACTOR CONSOLE — dead-start ready. [E] to enter ignition code.",
    },

    // ------- RESEARCH -------
    {
      id: "log_res1", kind: "log", x: 41, y: 4,
      source: "// DR. L. MARROW, LEAD RESEARCH",
      title: "The Aurora Object — Day 19",
      body:
`We pulled it from the ice-comet's core. It does not reflect light.
It drinks it.

In total darkness it is... active. It moves without moving.
Under bright light it goes still, like it's holding its breath.

That is the whole rule, and we broke it. We cut the power to run
the deep scan in the dark. For nineteen hours it had the run of the ship.

It doesn't want to hurt us. I don't think it understands "us" at all.
It's just cold, and it's learning to keep warm.`,
    },
    {
      id: "log_res2", kind: "log", x: 50, y: 4,
      source: "// SECURE DATA CONSOLE",
      title: "Contingency — VANCE, R. (eyes only)",
      body:
`Marrow won't destroy it. So I will.

The scuttle authorization is on the Bridge, behind the command
keycard. I locked the keycard in my quarters safe where the Object
can't reach a keypad.

Safe code — our launch date. 2-3-1-7. 2317.

If you're reading this and I'm not there: take the keycard.
Get to the Bridge. You'll have a choice I couldn't make in time.
Warn the fleet, or burn it all down with us. Choose better than I did.`,
    },

    // ------- MEDICAL -------
    {
      id: "log_med1", kind: "log", x: 24, y: 4,
      source: "// DR. A. FENN, MEDICAL",
      title: "Patient Notes — Crewman Doyle",
      body:
`Doyle was the first to spend a night near the Object in the dark.

No wound. No fever. But he stopped blinking in shadow, and his
pupils won't contract under my penlight. He says the dark "talks back"
now, and that it is very patient.

I sedated him. In the dark his vitals read as two heartbeats.
In the light, one.

There is no cure for this. There is only the light switch,
and I am so afraid of the moment someone flips it off.`,
    },
    {
      id: "log_med2", kind: "log", x: 31, y: 10,
      source: "// VITALS MONITOR — WARD 2",
      title: "Live Feed",
      body:
`BED 1 — DOYLE, M. .......... [ NO SIGNAL ]
BED 2 — OSEI, K. ........... FLATLINE
BED 3 — FENN, A. ........... FLATLINE
BED 4 — MARROW, L. ......... FLATLINE
BED 5 — [ unregistered ] ... ♥ 41 bpm

BED 5 is empty.
The monitor insists otherwise.
It has insisted for 63 days.`,
    },

    // ------- HYDROPONICS -------
    {
      id: "log_hydro1", kind: "log", x: 4, y: 15,
      source: "// DR. I. HOLT, BOTANY",
      title: "Grow Log — Bay 3",
      body:
`The garden is the only place on this station that isn't afraid.

The plants have gone strange since the dark came. They lean away from
where the lamps used to be. New shoots come up black and they come up
fast — a season overnight — and they all point the same way.

Toward the lab. Toward the Object.

I stopped running the grow-lights to save power for the reactor. God
help me, I think the garden thanked me for it.`,
    },
    {
      id: "log_hydro2", kind: "log", x: 14, y: 15,
      source: "// MAINTENANCE HATCH — SCRAWL",
      title: "scratched into the paint",
      body:
`whoever comes after —

the hatch here goes straight up to the crew deck. we used it to move
soil. now we use it to run.

if the lights are on you can take it. if they're off, don't. it lives
in the between-places and this is the most between place there is.

hold your breath. count to nothing. it counts too.`,
    },

    // ------- QUARTERS -------
    {
      id: "safe", kind: "safe", x: 8, y: 3,
      source: "// CAPTAIN'S SAFE",
      label: "ENTER SAFE CODE",
      lockedMsg: "CAPTAIN'S SAFE — locked keypad. [E] to enter code.",
      grants: "command keycard",
    },
    {
      id: "log_q1", kind: "log", x: 4, y: 4,
      source: "// CAPT. VANCE — PERSONAL",
      title: "Last Entry",
      body:
`I keep the lights on now. All of them. I sleep in the glare.

I could have scuttled us on day nineteen. One code, one choice.
But there were still fourteen names on my manifest and I told myself
some of them might still be them.

They aren't. I've known for weeks.

Whoever you are — you won't have my hesitation, because you won't
have my hope. That's a gift. Use it.`,
    },
    {
      id: "log_q2", kind: "log", x: 14, y: 10,
      source: "// CREW DIARY — M. DOYLE",
      title: "found under a bunk",
      body:
`day ?? — the light in here flickers if i stare at it. i've started
begging it not to.

when it's dark i'm not alone and i'm not scared and THAT is what scares
me in the morning. it feels like coming home.

if you're reading this, don't hold your breath waiting for rescue.
hold it so the dark can't hear you.

it's almost lights-out. i can't wait.`,
    },

    // ------- CRYOGENICS -------
    {
      id: "log_cryo1", kind: "log", x: 57, y: 5,
      source: "// CRYO CONTROL — DR. A. FENN",
      title: "Pod Manifest",
      body:
`We put four of them under. Doyle first. If sleep is dreamless and
lightless, we reasoned, maybe the Object can't reach a mind that's
already gone dark.

We reasoned wrong.

Under the ice they don't dream. They wait. Every pod's internal camera
shows the same thing at 03:15 — eyes open, in the cold, in the dark,
looking up at a ceiling that is looking back.

POD 1 DOYLE ....... OCCUPIED (?)
POD 2 HOLT ........ OCCUPIED (?)
POD 3 REYES ....... OPEN — LID FORCED FROM INSIDE
POD 4 [sealed] .... do not open. do NOT open. we did not fill pod 4.`,
    },
    {
      id: "log_cryo2", kind: "log", x: 66, y: 13,
      source: "// SCRATCHED INTO POD 3 GLASS",
      title: "(from the inside)",
      body:
`IT IS WARM IN HERE NOW

IT IS WARM EVERYWHERE I GO

STOP LEAVING THE LIGHTS ON FOR ME I DON'T NEED THEM ANYMORE

COME SEE`,
    },

    // ------- OBSERVATION DECK -------
    {
      id: "log_observ1", kind: "log", x: 57, y: 18,
      source: "// DR. L. MARROW — OBSERVATION",
      title: "Where It Came From",
      body:
`I come here to look at the thing we should have left alone.

The comet is still out there off the port window — a dirty snowball the
size of a city, tumbling through a dark so complete it has never once,
in four billion years, been touched by a star.

That is where the Object learned what it is. Not evil. Not hungry the
way a wolf is hungry. Just... adapted. To a universe that is almost
entirely darkness, with only the rarest, thinnest scattering of light.

We are the light. We are the anomaly. And it has been so alone.`,
    },
    {
      id: "log_observ2", kind: "log", x: 69, y: 18,
      source: "// NAV BEACON CONFIG",
      title: "Beacon — Loop Settings",
      body:
`DISTRESS LOOP: ACTIVE (day 63)
MESSAGE: "survivors aboard, request immediate rescue"
BROADCAST RADIUS: MAXIMUM

Note (Vance): the message is a lie. There are no survivors. I keep the
loop running anyway, at full power, screaming for help across the whole
sector.

Because a rescue ship will come with its lights blazing. And that is the
only meal big enough to make it leave with them.

God forgive me. The loop is bait. Shut it off, or aim it true.`,
    },

    // ------- CARGO BAY -------
    {
      id: "log_cargo1", kind: "log", x: 54, y: 37,
      source: "// CARGO MANIFEST — AUTO",
      title: "Inbound Crate C-7",
      body:
`CRATE C-7 — SURVEY RECOVERY, COMET CORE SAMPLE
HANDLING: KEEP ILLUMINATED AT ALL TIMES
HANDLING: DO NOT OPEN OUTSIDE CONTAINMENT

03:02 — crate C-7 opened. Location: this cargo bay. In the dark.
03:02 — authorizing crewmember: [none logged]
03:03 — crate C-7 is empty
03:03 — crate C-7 is empty
03:03 — it isn't in the crate anymore. it's in the ship.`,
    },

    // ------- CONTAINMENT -------
    {
      id: "log_contain1", kind: "log", x: 38, y: 35,
      source: "// CONTAINMENT — DR. L. MARROW",
      title: "The Only Thing That Works",
      body:
`We tried everything. Fire starves in the airlocks. Cold makes it
stronger. It walks through any door we can't keep lit.

Only one thing holds it: a room lit so bright there is not one shadow
for it to stand in. That is all containment is — a cage made of light.

The reactor feeds that cage. If the power ever fails, the cage opens.

So do not, whatever you are told, whatever you feel, cut the power to
this deck. The moment you do, you are simply switching off the only
wall between it and the rest of forever.`,
    },
    {
      id: "log_contain2", kind: "log", x: 47, y: 41,
      source: "// MARROW — FINAL, UNSENT",
      title: "To whoever is brave or stupid enough",
      body:
`I understand it now, and understanding is the disease.

It is not attacking us. It is answering us. Every light we ever lit was
a word in a language we didn't know we were speaking, and it has crossed
the whole cold dark to finally, finally answer.

You have three ways to end the conversation.
Warn the others, and let it starve out here in the quiet.
Burn it, and burn the answer with it.
Or say nothing, walk away, and leave the line open for the next voice.

I couldn't choose. Marrow, L. — the last light on Aurora-9.`,
    },

    // ------- BRIDGE -------
    {
      id: "broadcast", kind: "broadcast", x: 28, y: 17,
      source: "// COMMAND — FLEET UPLINK",
      label: "COMMAND AUTHORITY GRANTED",
      lockedMsg: "COMMAND CONSOLE — awaiting command authority.",
    },
  ];

  // --- The presence: spawn + roam waypoints (tile coords). Inert until power. ---
  STORY.presence = {
    spawn: { x: 45, y: 8 },
    // patrol anchors it drifts between while it hasn't noticed you
    waypoints: [
      { x: 45, y: 8 },  // research
      { x: 44, y: 18 }, // C8 corridor
      { x: 44, y: 27 }, // engineering
      { x: 26, y: 28 }, // junction
      { x: 30, y: 6 },  // medical/research hall
      { x: 9, y: 18 },  // hydroponics
      { x: 61, y: 9 },  // cryogenics
      { x: 62, y: 22 }, // observation
      { x: 60, y: 34 }, // cargo
      { x: 43, y: 38 }, // containment
    ],
  };

  // Intro crawl shown once at boot.
  STORY.intro = [
    "THE AURORA SIGNAL — EPISODE ONE: \"DEAD AIR\"",
    "SALVAGE VESSEL KESTREL — solo responder.",
    "Contract: investigate a 63-day distress loop from deep-survey station AURORA-9.",
    "Docking clamp engaged. Life support: marginal. Main power: OFFLINE.",
    "",
    "You seal your helmet and step into the dark.",
  ];

  // Endings, keyed by the choice made at the broadcast console.
  STORY.endings = {
    warn: {
      cls: "good",
      title: "// TRANSMISSION SENT",
      body:
`You upload every log, every scan, every warning, and burn it out
across the fleet band on a loop that will never stop.

AURORA-9 stays dark and drifting — a buoy that says, forever:
DO NOT APPROACH. DO NOT CUT THE LIGHTS.

You undock. Behind you the station shrinks to a single amber window.
Something in it presses close to the glass, patient as ever,
and watches your engine-light dwindle into a dark it cannot cross.

You kept the hope Vance lost. You warned them.

— EPISODE ONE — END —

Two light-days coreward, a relay station wakes to your warning.
A dispatcher named Okonkwo leans toward the screen, and frowns,
and does not yet reach for the light switch.

[ THE AURORA SIGNAL CONTINUES — EPISODE TWO: "LANDFALL" ]`,
    },
    burn: {
      cls: "bad",
      title: "// SCUTTLE AUTHORIZED",
      body:
`You enter the scuttle sequence Vance never could. The reactor you
fought so hard to wake now winds toward the light of a small sun.

You run for the Kestrel as bulkheads drop gold behind you.
For one heartbeat the whole station blazes — every lamp, every screen,
brighter than it has ever been — and in that glare the dark has
nowhere left to hide.

You feel it lose its grip a hundred meters out. The shockwave is
almost gentle. No more loop. No more window. No more patience.

You burned it all down with them. Vance would understand.

— EPISODE ONE — END —

The flash reaches the core worlds nine days later, a new false star
low on the horizon of a planet you used to call home. In a harbor town,
a boy watches it fade and asks his mother what it was.

She tells him it was nothing. She has already stopped believing in
nothing.

[ THE AURORA SIGNAL CONTINUES — EPISODE TWO: "LANDFALL" ]`,
    },
    leave: {
      cls: "bad",
      title: "// UPLINK CLOSED",
      body:
`You look at the warning you could send and the charges you could arm,
and you do neither. Not your station. Not your fourteen names.

You pocket what salvage you found and walk back to the Kestrel through
corridors that seem, somehow, disappointed to see you go.

The beacon keeps cycling behind you — the same loop, the same lie about
survivors, thrown out into the black for the next ship, and the next.

AURORA-9 shrinks to a single amber window. It does not watch you leave.
It is already watching the dark for whoever comes next.

You told yourself it wasn't your choice to make.
It was. You made it.

— EPISODE ONE — END —

The Kestrel's autopilot is already set for home. You sleep the whole
way, and you do not dream, and behind you the loop keeps calling into
the dark — patient, and baited, and answered at last by a freighter
that alters course, lights blazing, and begins the long fall inward.

[ THE AURORA SIGNAL CONTINUES — EPISODE TWO: "LANDFALL" ]`,
    },
  };

  // Death (caught by the presence) — atmospheric, not gory.
  STORY.death = {
    cls: "dead",
    title: "// SIGNAL LOST",
    body:
`The cold reaches you before it does.

Your flashlight gutters. In its dying stutter you see it isn't a shape
so much as a hunger wearing the last person who held still too long.

Then the dark is very close, and very patient, and not empty at all.

You come to at the last lit doorway, helmet chiming, the loop still
running. Keep to the light.`,
  };
})();
