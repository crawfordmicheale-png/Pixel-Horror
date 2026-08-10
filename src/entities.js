/* entities.js — interactive objects (terminals, items) and THE PRESENCE.
   The presence is dormant until main power wakes it. It hunts in darkness
   and freezes when your flashlight beam falls on it — so light is your only
   defense, and looking away is how it closes the distance. */
(function () {
  "use strict";
  const AURORA = window.AURORA;
  const U = AURORA.util;
  const T = AURORA.TILE;
  const World = AURORA.world;

  const E = (AURORA.entities = {});

  let items = [];      // remaining pickups
  let terminals = [];  // consoles/logs/puzzles
  let lockers = [];    // hiding spots

  E.initObjects = function () {
    const S = AURORA.story;
    items = S.items.map((it) => Object.assign({ taken: false }, it));
    terminals = S.terminals.map((t) =>
      Object.assign({ used: false }, t)
    );
    lockers = (S.lockers || []).map((l) => Object.assign({ occupied: false }, l));
  };

  E.items = () => items;
  E.terminals = () => terminals;
  E.lockers = () => lockers;

  // ---------- Interaction lookup ----------
  // Returns the nearest interactable (item/terminal/door) within reach.
  E.nearest = function (px, py, reach) {
    let best = null, bestD = reach;
    items.forEach((it) => {
      if (it.taken) return;
      const d = U.dist(px, py, (it.x + 0.5) * T, (it.y + 0.5) * T);
      if (d < bestD) { bestD = d; best = { type: "item", ref: it }; }
    });
    terminals.forEach((t) => {
      const d = U.dist(px, py, (t.x + 0.5) * T, (t.y + 0.5) * T);
      if (d < bestD) { bestD = d; best = { type: "terminal", ref: t }; }
    });
    lockers.forEach((l) => {
      const d = U.dist(px, py, (l.x + 0.5) * T, (l.y + 0.5) * T);
      if (d < bestD) { bestD = d; best = { type: "locker", ref: l }; }
    });
    // Locked doors are interactable (to show why they're locked).
    AURORA.story.doors.forEach((d) => {
      if (World.isDoorOpen(d.id)) return;
      d.tiles.forEach(([tx, ty]) => {
        const dd = U.dist(px, py, (tx + 0.5) * T, (ty + 0.5) * T);
        if (dd < bestD) { bestD = dd; best = { type: "door", ref: d }; }
      });
    });
    return best;
  };

  // ---------- Rendering (before lighting) ----------
  E.draw = function (ctx, cam, powered, time) {
    lockers.forEach((l) => drawLocker(ctx, cam, l));
    terminals.forEach((t) => drawTerminal(ctx, cam, t, powered, time));
    items.forEach((it) => { if (!it.taken) drawItem(ctx, cam, it, time); });
    if (presence.active) presence.drawBody(ctx, cam, time);
  };

  function drawLocker(ctx, cam, l) {
    const sx = Math.round(l.x * T - cam.x);
    const sy = Math.round(l.y * T - cam.y);
    // upright locker cabinet
    ctx.fillStyle = "#2b343c";
    ctx.fillRect(sx + 2, sy + 1, 12, 14);
    ctx.fillStyle = "#20272e";
    ctx.fillRect(sx + 3, sy + 2, 10, 12);
    // door seam + vents
    ctx.fillStyle = "#39454e";
    ctx.fillRect(sx + 8, sy + 2, 1, 12);
    ctx.fillStyle = "#141a1f";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(sx + 4, sy + 4 + i * 2, 3, 1);
      ctx.fillRect(sx + 10, sy + 4 + i * 2, 3, 1);
    }
    // handle glints slightly when occupied
    ctx.fillStyle = l.occupied ? "#d9a441" : "#5a6a72";
    ctx.fillRect(sx + 7, sy + 8, 2, 2);
  }

  // ---------- Emissive pass (after lighting) ----------
  // Small self-lit glints so terminals read as tiny lights in the dark and
  // the presence's eyes glimmer even in shadow.
  E.drawEmissive = function (ctx, cam, powered, time) {
    ctx.globalCompositeOperation = "lighter";
    terminals.forEach((t) => {
      if (t.used && t.kind === "log") return; // read logs stop blinking
      const sx = (t.x + 0.5) * T - cam.x;
      const sy = (t.y + 0.4) * T - cam.y;
      const on = U.flicker(time * 2, t.x + t.y) > 0.25;
      if (!on) return;
      const col = t.kind === "reactor" || t.kind === "safe" || t.kind === "broadcast"
        ? "rgba(217,164,65,"
        : "rgba(120,200,160,";
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 7);
      g.addColorStop(0, col + "0.5)");
      g.addColorStop(1, col + "0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx - 7, sy - 7, 14, 14);
    });
    items.forEach((it) => {
      if (it.taken) return;
      const sx = (it.x + 0.5) * T - cam.x;
      const sy = (it.y + 0.5) * T - cam.y;
      const p = 0.4 + Math.sin(time * 3 + it.x) * 0.25;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 8);
      g.addColorStop(0, `rgba(230,210,150,${0.4 * p})`);
      g.addColorStop(1, "rgba(230,210,150,0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx - 8, sy - 8, 16, 16);
    });
    if (presence.active) presence.drawEyes(ctx, cam, time);
    ctx.globalCompositeOperation = "source-over";
  };

  function drawTerminal(ctx, cam, t, powered, time) {
    const sx = Math.round(t.x * T - cam.x);
    const sy = Math.round(t.y * T - cam.y);
    // console body
    ctx.fillStyle = "#2a323a";
    ctx.fillRect(sx + 2, sy + 3, 12, 11);
    ctx.fillStyle = "#151b21";
    ctx.fillRect(sx + 2, sy + 12, 12, 2);
    // screen
    const on = U.flicker(time * 2, t.x + t.y) > 0.25;
    if (t.used && t.kind === "log") {
      ctx.fillStyle = "#10231a";
    } else {
      ctx.fillStyle = on
        ? (t.kind === "reactor" || t.kind === "safe" || t.kind === "broadcast" ? "#3a2f14" : "#123528")
        : "#0c120f";
    }
    ctx.fillRect(sx + 3, sy + 4, 10, 7);
    // scanline on screen
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(sx + 3, sy + 6, 10, 1);
    ctx.fillRect(sx + 3, sy + 9, 10, 1);
  }

  function drawItem(ctx, cam, it, time) {
    const sx = Math.round(it.x * T - cam.x);
    const sy = Math.round(it.y * T - cam.y) + Math.round(Math.sin(time * 2 + it.x) * 1);
    if (it.glyph === "f") {
      // flashlight sprite
      ctx.fillStyle = "#c9b070";
      ctx.fillRect(sx + 5, sy + 6, 6, 4);
      ctx.fillStyle = "#8a7840";
      ctx.fillRect(sx + 4, sy + 6, 2, 4);
      ctx.fillStyle = "#e9dca0";
      ctx.fillRect(sx + 11, sy + 6, 2, 4);
    } else if (it.glyph === "s") {
      // salvage trinket — a small pale object with a glint
      ctx.fillStyle = "#9aa0a8";
      ctx.fillRect(sx + 6, sy + 7, 4, 4);
      ctx.fillStyle = "#e9dca0";
      ctx.fillRect(sx + 6, sy + 7, 2, 2);
    } else {
      ctx.fillStyle = "#c9b070";
      ctx.fillRect(sx + 5, sy + 6, 6, 5);
    }
  }

  // ===================== THE PRESENCE =====================
  const presence = {
    active: false,
    x: 0, y: 0,          // pixel position (top-left of 12x14 body box)
    w: 10, h: 14,
    vx: 0, vy: 0,
    speed: 26,           // px/s (player is ~42) — slower, so escapable
    state: "patrol",
    wp: 0,               // waypoint index
    knows: 0,            // 0..1 awareness of player
    lit: false,          // currently in the beam
    recoil: 0,           // pushed-back timer when lit
    danger: 0,           // 0..1 how close/dangerous, drives audio+vignette
    caughtCooldown: 0,
  };

  E.presence = presence;

  E.resetPresence = function () {
    presence.active = false;
    presence.knows = 0;
    presence.danger = 0;
    presence.state = "patrol";
    presence.recoil = 0;
    const sp = AURORA.story.presence.spawn;
    presence.x = sp.x * T;
    presence.y = sp.y * T;
  };

  E.activatePresence = function () {
    presence.active = true;
    presence.state = "patrol";
  };

  function pcx() { return presence.x + presence.w / 2; }
  function pcy() { return presence.y + presence.h / 2; }

  // Try to move the presence by (dx,dy), sliding along walls.
  function moveP(dx, dy) {
    if (!World.rectHitsSolid(presence.x + dx, presence.y, presence.w, presence.h))
      presence.x += dx;
    if (!World.rectHitsSolid(presence.x, presence.y + dy, presence.w, presence.h))
      presence.y += dy;
  }

  /**
   * @param player  the player object
   * @param powered whether main power is on
   * @param dt      seconds
   */
  E.updatePresence = function (dt, player, powered) {
    if (!presence.active) return;
    if (presence.caughtCooldown > 0) presence.caughtCooldown -= dt;

    const ptx = pcx() / T, pty = pcy() / T;
    const plx = player.cx() / T, ply = player.cy() / T;
    const dPx = player.cx() - pcx();
    const dPy = player.cy() - pcy();
    const distPx = Math.hypot(dPx, dPy);
    const los = World.lineClear(ptx, pty, plx, ply);

    // Hidden in a locker: the presence loses the thread quickly and can't grab you.
    if (player.hidden) {
      presence.lit = false;
      presence.knows = Math.max(0, presence.knows - dt * 1.2);
      presence.danger = Math.max(0, presence.danger - dt);
      // still let it wander toward its last idea of you, then give up
      if (presence.knows < 0.2) presence.state = "patrol";
    }

    // --- Is the flashlight beam on the presence? Then it freezes/recoils. ---
    presence.lit = false;
    if (player.beamActive() && los && distPx < 110) {
      const ang = U.angleTo(player.cx(), player.cy(), pcx(), pcy());
      if (Math.abs(U.angleDiff(ang, player.facing)) < 0.6) {
        presence.lit = true;
        presence.recoil = 0.5;
      }
    }
    // Bright rooms also pin it (it won't chase you into full light for long).
    const room = World.roomAtPx(pcx(), pcy());
    const inLitRoom = powered && room && room.lit;

    // --- Awareness. Movement + proximity raise it; light + distance lower it. ---
    // Dread makes you easier to sense; hiding makes you invisible.
    const moving = player.moving && !player.holdingBreath;
    const dreadBonus = 1 + (player.dread01 || 0) * 0.5;
    let senseR = (moving ? 150 : 70) * dreadBonus;
    if (player.holdingBreath) senseR = 42;
    if (!player.hidden && los && distPx < senseR) {
      presence.knows = Math.min(1, presence.knows + dt * (moving ? 1.6 : 0.9));
      presence.lastSeen = { x: plx, y: ply };
    } else if (!player.hidden) {
      presence.knows = Math.max(0, presence.knows - dt * 0.35);
    }

    // --- State machine ---
    let tx, ty; // target tile
    if (presence.recoil > 0) {
      presence.recoil -= dt;
    }

    if (presence.knows > 0.55 && presence.lastSeen) {
      presence.state = "hunt";
    } else if (presence.knows <= 0.05) {
      presence.state = "patrol";
    }

    if (presence.state === "hunt" && presence.lastSeen) {
      tx = presence.lastSeen.x; ty = presence.lastSeen.y;
      if (los) { tx = plx; ty = ply; }
    } else {
      const wps = AURORA.story.presence.waypoints;
      const wp = wps[presence.wp];
      tx = wp.x; ty = wp.y;
      if (U.dist(ptx, pty, tx, ty) < 1.2) presence.wp = (presence.wp + 1) % wps.length;
    }

    // --- Motion ---
    let spd = presence.speed;
    if (presence.state === "hunt") spd *= 1.35;
    if (presence.lit || inLitRoom) spd = 0;                 // frozen in light
    if (presence.recoil > 0 && presence.lit) {
      // actively pushed away from the beam
      const away = U.angleTo(player.cx(), player.cy(), pcx(), pcy());
      moveP(Math.cos(away) * 34 * dt, Math.sin(away) * 34 * dt);
    } else if (spd > 0) {
      const ang = U.angleTo(pcx() / T, pcy() / T, tx, ty);
      // small wobble so it feels unnatural
      const wob = Math.sin(performance.now() * 0.004) * 0.15;
      moveP(Math.cos(ang + wob) * spd * dt, Math.sin(ang + wob) * spd * dt);
    }

    // --- Danger metric (for audio + vignette) ---
    let danger = 0;
    if (presence.state === "hunt") danger = U.clamp(1 - distPx / 180, 0, 1);
    else danger = U.clamp(presence.knows * 0.5 + (1 - distPx / 260) * 0.4, 0, 0.6);
    if (presence.lit) danger *= 0.5;
    presence.danger = danger;

    // --- Catch! ---
    if (distPx < 9 && !presence.lit && !inLitRoom && !player.hidden && presence.caughtCooldown <= 0) {
      AURORA.util.emit("caught");
      presence.caughtCooldown = 2;
    }
  };

  presence.drawBody = function (ctx, cam, time) {
    const sx = Math.round(this.x - cam.x);
    const sy = Math.round(this.y - cam.y);
    const wob = Math.sin(time * 6) * 1;
    // A void-black silhouette, darker than the room, faintly shifting.
    ctx.fillStyle = this.lit ? "#161016" : "#050406";
    // head
    ctx.fillRect(sx + 3, sy, 5, 5);
    // tall thin torso
    ctx.fillRect(sx + 2, sy + 4, 7, 8);
    // ragged limbs
    ctx.fillRect(sx + 1, sy + 5 + wob, 2, 6);
    ctx.fillRect(sx + 8, sy + 5 - wob, 2, 6);
    ctx.fillRect(sx + 3, sy + 11, 2, 3);
    ctx.fillRect(sx + 6, sy + 11, 2, 3);
    // when lit, a sickly pale rim reveals detail
    if (this.lit) {
      ctx.fillStyle = "rgba(180,190,180,0.20)";
      ctx.fillRect(sx + 2, sy, 7, 1);
      ctx.fillRect(sx + 1, sy + 5, 1, 6);
      ctx.fillRect(sx + 9, sy + 5, 1, 6);
    }
  };

  presence.drawEyes = function (ctx, cam, time) {
    const sx = Math.round(this.x - cam.x);
    const sy = Math.round(this.y - cam.y);
    // Two dim eyes that glimmer even in the dark — your early warning.
    const flick = 0.55 + U.flicker(time * 4, 7) * 0.45;
    const col = this.state === "hunt" ? "rgba(210,60,45," : "rgba(200,200,210,";
    ctx.fillStyle = col + (0.7 * flick) + ")";
    ctx.fillRect(sx + 3, sy + 1, 1, 1);
    ctx.fillRect(sx + 6, sy + 1, 1, 1);
    // soft bloom
    const g = ctx.createRadialGradient(sx + 5, sy + 1, 0, sx + 5, sy + 1, 6);
    g.addColorStop(0, col + (0.30 * flick) + ")");
    g.addColorStop(1, col + "0)");
    ctx.fillStyle = g;
    ctx.fillRect(sx - 1, sy - 5, 12, 12);
  };
})();
