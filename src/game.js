/* game.js — bootstrap, main loop, state machine, camera, and the rules that
   connect player · world · presence · lighting · UI into STATION AURORA-9. */
(function () {
  "use strict";
  const AURORA = window.AURORA;
  const U = AURORA.util;
  const T = AURORA.TILE;
  const World = AURORA.world;
  const Light = AURORA.lighting;
  const E = AURORA.entities;
  const audio = AURORA.audio;
  const input = AURORA.input;
  const UI = AURORA.ui;

  let canvas, ctx;
  let player;
  const cam = { x: 0, y: 0 };

  let state = "title";     // "title" | "intro" | "play" | "over"
  let powered = false;
  let hasKeycard = false;
  let time = 0;
  let last = 0;
  let ambientTimer = 4;
  let fear = 0;            // smoothed vignette level
  let lastSafeTile = { x: 6, y: 29 };

  // Intro crawl queue
  let introQueue = [];
  let introTimer = 0;

  function init() {
    canvas = document.getElementById("game");
    ctx = canvas.getContext("2d");
    canvas.width = AURORA.VIEW_W;
    canvas.height = AURORA.VIEW_H;
    ctx.imageSmoothingEnabled = false;

    Light.init();
    UI.init();
    input.bindTouch(canvas);
    resize();
    window.addEventListener("resize", resize);

    document.getElementById("startBtn").addEventListener("click", startGame);
    document.getElementById("endBtn").addEventListener("click", onEndButton);

    U.on("caught", onCaught);

    requestAnimationFrame(loop);
  }

  function resize() {
    const aspect = AURORA.VIEW_W / AURORA.VIEW_H;
    let w = window.innerWidth, h = window.innerHeight;
    if (w / h > aspect) w = Math.floor(h * aspect);
    else h = Math.floor(w / aspect);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  }

  function startGame() {
    audio.start();
    audio.resume();
    UI.hideTitle();
    UI.hideEnd();

    World.build();
    E.initObjects();
    E.resetPresence();
    player = new AURORA.Player();
    player.spawnAtDock();
    powered = false;
    hasKeycard = false;
    fear = 0;
    lastSafeTile = { x: player.tileX(), y: player.tileY() };

    // Internal handle — lets tooling/tests inspect live state. Harmless.
    AURORA._state = () => ({
      state, powered, hasKeycard,
      hasFlashlight: player.hasFlashlight,
      px: player.tileX(), py: player.tileY(),
      presenceActive: E.presence.active,
    });
    // QA teleport hook (console-only; no in-game UI exposes it).
    AURORA._tp = (tx, ty) => player.placeTile(tx, ty);

    audio.setTension(0);

    // Intro crawl, then hand control over.
    introQueue = AURORA.story.intro.filter((s) => s.length).map((s) => ({ text: s, dur: 2.6 }));
    introTimer = 0;
    state = "intro";
    updateObjective();
    updateInventory();
  }

  function onEndButton() {
    const dead = document.getElementById("end-title").classList.contains("dead");
    if (dead) {
      // respawn and resume
      UI.hideEnd();
      respawn();
      state = "play";
    } else {
      // return to title
      UI.hideEnd();
      UI.showTitle();
      UI.objective(null);
      UI.inventory(null);
      state = "title";
    }
  }

  // ---------------- Core loop ----------------
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    time += dt;

    if (state === "intro") updateIntro(dt);
    else if (state === "play") updatePlay(dt);

    render();
    UI.tickSubtitle(dt);
    requestAnimationFrame(loop);
  }

  function updateIntro(dt) {
    // Let the player skip the crawl.
    if (input.consumeInteract() || input.consumeEsc()) {
      introQueue = [];
      state = "play";
      UI.subtitle("Keep to the light.", 3);
      return;
    }
    introTimer -= dt;
    if (introTimer <= 0) {
      if (introQueue.length) {
        const line = introQueue.shift();
        UI.subtitle(line.text, line.dur + 0.4);
        introTimer = line.dur;
      } else {
        state = "play";
        UI.subtitle("Keep to the light.", 3);
      }
    }
    // camera settles on player during intro
    centerCamera(0.1);
  }

  function updatePlay(dt) {
    // Modal overlays freeze the world.
    if (UI.isModal()) {
      UI.handleModalKeys(input);
      return;
    }

    player.update(dt, input);

    // Track last "safe" (lit) tile for respawns.
    const room = World.roomAtPx(player.cx(), player.cy());
    const safe = room && (room.emergency || (powered && room.lit));
    if (safe) lastSafeTile = { x: player.tileX(), y: player.tileY() };

    // Presence
    E.updatePresence(dt, player, powered);

    // Tension + fear vignette follow the presence's danger.
    const danger = E.presence.active ? E.presence.danger : 0;
    audio.setTension(danger);
    fear += (danger - fear) * Math.min(1, dt * 3);

    // Interactions
    handleInteraction();

    // Ambient audio events
    ambientTimer -= dt;
    if (ambientTimer <= 0) {
      ambientTimer = U.rand(9, 20);
      if (audio.isReady()) audio.ambientRoll();
    }

    centerCamera(0.18);
  }

  function centerCamera(k) {
    const tx = U.clamp(player.cx() - AURORA.VIEW_W / 2, 0, World.w * T - AURORA.VIEW_W);
    const ty = U.clamp(player.cy() - AURORA.VIEW_H / 2, 0, World.h * T - AURORA.VIEW_H);
    cam.x = U.lerp(cam.x, tx, k);
    cam.y = U.lerp(cam.y, ty, k);
  }

  // ---------------- Interaction ----------------
  function handleInteraction() {
    const near = E.nearest(player.cx(), player.cy(), 18);
    if (!near) { UI.prompt(null); input.consumeInteract(); return; }

    // Prompt text
    let label = "[ E ]";
    if (near.type === "item") label = "[ E ] take " + near.ref.name;
    else if (near.type === "terminal") {
      const k = near.ref.kind;
      if (k === "log") label = "[ E ] read " + (near.ref.used ? "(again)" : "log");
      else if (k === "reactor") label = powered ? "[ E ] reactor online" : "[ E ] reactor console";
      else if (k === "safe") label = hasKeycard ? "[ E ] safe (empty)" : "[ E ] captain's safe";
      else if (k === "broadcast") label = hasKeycard ? "[ E ] command console" : "[ E ] locked — needs command keycard";
    } else if (near.type === "door") {
      label = near.ref.type === "keycard" && hasKeycard
        ? "[ E ] use keycard"
        : "[ E ] " + (near.ref.type === "power" ? "no power" : "sealed");
    }
    UI.prompt(label);

    if (!input.consumeInteract()) return;

    if (near.type === "item") return pickUp(near.ref);
    if (near.type === "terminal") return useTerminal(near.ref);
    if (near.type === "door") return useDoor(near.ref);
  }

  function pickUp(it) {
    it.taken = true;
    audio.confirm();
    if (it.id === "flashlight") player.hasFlashlight = true;
    UI.subtitle(it.pickup, it.kind === "salvage" ? 5.5 : 4.5);
    updateObjective();
    updateInventory();
  }

  function useTerminal(t) {
    if (t.kind === "log") {
      const firstRead = !t.used;
      t.used = true;
      UI.showReader(t);
      if (firstRead) updateInventory();
      return;
    }
    if (t.kind === "reactor") {
      if (powered) { UI.subtitle("The reactor hums. The lights are already up.", 2.5); return; }
      UI.showKeypad(t.label, AURORA.story.REACTOR_CODE, onPowerRestored);
      return;
    }
    if (t.kind === "safe") {
      if (hasKeycard) { UI.subtitle("The safe is open and empty.", 2.5); return; }
      UI.showKeypad(t.label, AURORA.story.SAFE_CODE, onKeycardTaken);
      return;
    }
    if (t.kind === "broadcast") {
      if (!hasKeycard) { UI.subtitle(t.lockedMsg, 3); audio.error(); return; }
      UI.showChoice(onEndingChosen);
      return;
    }
  }

  function useDoor(d) {
    if (d.type === "keycard") {
      if (hasKeycard) {
        World.openDoor(d.id);
        audio.confirm();
        UI.subtitle(d.openMsg, 3);
        updateObjective();
      } else {
        UI.subtitle(d.lockedMsg, 3);
        audio.error();
      }
    } else {
      UI.subtitle(d.lockedMsg, 3);
      audio.error();
    }
  }

  // ---------------- Story beats ----------------
  function onPowerRestored() {
    powered = true;
    // Open all power-gated doors.
    AURORA.story.doors.forEach((d) => { if (d.type === "power") World.openDoor(d.id); });
    E.activatePresence();
    audio.groan();
    setTimeout(() => audio.groan(), 900);
    UI.subtitle("MAIN POWER RESTORED. The lights stutter on — and somewhere, something wakes.", 5);
    updateObjective();
  }

  function onKeycardTaken() {
    hasKeycard = true;
    UI.subtitle("You take the command keycard. Vance's contingency is now yours to make.", 5);
    updateObjective();
    updateInventory();
  }

  function onEndingChosen(which) {
    const ending = AURORA.story.endings[which];
    audio.setTension(0);
    if (which === "burn") { audio.stinger(); }
    else { audio.confirm(); }
    state = "over";
    UI.showEnd(ending);
  }

  function onCaught() {
    if (state !== "play") return;
    audio.stinger();
    state = "over";
    UI.showEnd(AURORA.story.death);
  }

  function respawn() {
    player.placeTile(lastSafeTile.x, lastSafeTile.y);
    // Send the presence back to a distant waypoint and blind it.
    E.resetPresence();
    if (powered) E.activatePresence();
    fear = 0;
    audio.setTension(0);
    UI.subtitle("You come to at the last lit doorway. Keep moving. Keep to the light.", 4);
  }

  // ---------------- Objective HUD ----------------
  function updateObjective() {
    let html;
    if (!player || !player.hasFlashlight) html = "OBJECTIVE<br/><b>Find a light source.</b>";
    else if (!powered) html = "OBJECTIVE<br/><b>Restore main power — Reactor Control.</b><br/>Follow the corridor east.";
    else if (!hasKeycard) html = "OBJECTIVE<br/><b>Find the command keycard.</b><br/>Search the crew quarters. Avoid the presence — use your light.";
    else if (!World.isDoorOpen("bridge_door")) html = "OBJECTIVE<br/><b>Reach the Command Bridge.</b><br/>The command hatch will accept your keycard.";
    else html = "OBJECTIVE<br/><b>Make Vance's choice at the command console.</b>";
    UI.objective(html);
  }

  function updateInventory() {
    if (!player) { UI.inventory(null); return; }
    const logs = E.terminals().filter((t) => t.kind === "log");
    const logsRead = logs.filter((t) => t.used).length;
    const salvage = E.items().filter((it) => it.kind === "salvage");
    const salvageGot = salvage.filter((it) => it.taken).length;

    const fl = player.hasFlashlight ? "<span class='have'>✓ flashlight</span>" : "· flashlight";
    const kc = hasKeycard ? "<span class='have'>✓ keycard</span>" : "· keycard";
    UI.inventory(
      `<b>GEAR</b><br/>${fl}<br/>${kc}<br/>` +
      `<b>LOGS</b> ${logsRead}/${logs.length}<br/>` +
      `<b>SALVAGE</b> ${salvageGot}/${salvage.length}`
    );
  }

  // ---------------- Render ----------------
  function render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, AURORA.VIEW_W, AURORA.VIEW_H);

    if (state === "title") return; // title handled by DOM overlay

    // World + objects + player (lit colors)
    World.draw(ctx, cam, powered);
    E.draw(ctx, cam, powered, time);
    if (player) player.draw(ctx, cam, time);

    // Darkness + flashlight
    if (player) {
      Light.draw(ctx, {
        cam, player, powered, time,
        fearVignette: fear,
      });
    }

    // Emissive glints (terminals, item shimmer, the eyes) punch through dark
    E.drawEmissive(ctx, cam, powered, time);

    // Film grain
    grain();
  }

  let grainT = 0;
  function grain() {
    grainT += 1;
    if (grainT % 2 !== 0) return; // every other frame, cheap
    ctx.globalAlpha = 0.035;
    ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#000";
    for (let i = 0; i < 24; i++) {
      const x = (Math.random() * AURORA.VIEW_W) | 0;
      const y = (Math.random() * AURORA.VIEW_H) | 0;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // Kick off once DOM is ready.
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
