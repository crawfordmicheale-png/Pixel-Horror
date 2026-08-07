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
  ];

  // --- Corridors: thin floor rectangles that overlap two rooms to link them.
  STORY.corridors = [
    { x: 14, y: 27, w: 9,  h: 2 },  // C2 dock <-> junction
    { x: 29, y: 27, w: 8,  h: 2 },  // C3 junction <-> engineering
    { x: 26, y: 21, w: 2,  h: 5 },  // C4 junction <-> bridge (keycard door)
    { x: 44, y: 12, w: 2,  h: 12 }, // C8 engineering <-> research (power door)
    { x: 33, y: 6,  w: 7,  h: 2 },  // C7 research <-> medical
    { x: 16, y: 6,  w: 7,  h: 2 },  // C6 medical <-> quarters
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
  ];

  // --- Items you can pick up. ---
  STORY.items = [
    {
      id: "flashlight", glyph: "f", x: 11, y: 27,
      name: "FLASHLIGHT",
      pickup: "You pry the flashlight from a dead responder's hand. The beam stutters, then holds.",
    },
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
    ],
  };

  // Intro crawl shown once at boot.
  STORY.intro = [
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

— END —`,
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

— END —`,
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
