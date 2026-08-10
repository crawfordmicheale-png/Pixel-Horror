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
  let hasMaintKey = false;
  let time = 0;
  let last = 0;
  let ambientTimer = 4;
  let fear = 0;            // smoothed vignette level
  let dread = 0;          // 0..1 sanity/dread meter
  let whisperTimer = 6;   // countdown to the next dread whisper
  let phantom = null;     // transient hallucination { x, y, t }
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
    hasMaintKey = false;
    fear = 0;
    dread = 0;
    whisperTimer = 8;
    phantom = null;
    lastSafeTile = { x: player.tileX(), y: player.tileY() };

    // Internal handle — lets tooling/tests inspect live state. Harmless.
    AURORA._state = () => ({
      state, powered, hasKeycard, hasMaintKey,
      hasFlashlight: player.hasFlashlight,
      flashlightOn: player.flashlightOn,
      battery: Math.round(player.battery),
      dread: +dread.toFixed(2),
      hidden: player.hidden,
      px: player.tileX(), py: player.tileY(),
      presenceActive: E.presence.active,
      doors: {
        research: World.isDoorOpen("research_door"),
        hydro: World.isDoorOpen("hydro_door"),
        bridge: World.isDoorOpen("bridge_door"),
        contain: World.isDoorOpen("contain_door"),
      },
    });
    // QA hooks (console-only; no in-game UI exposes them).
    AURORA._tp = (tx, ty) => player.placeTile(tx, ty);
    AURORA._setBattery = (v) => { player.battery = v; };
    AURORA._setDread = (v) => { dread = v; };

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

    // Flashlight toggle (keyboard F or on-screen button).
    if (input.consumeToggle() && player.hasFlashlight && !player.hidden) {
      const on = player.toggleFlashlight();
      audio.beep(on ? 620 : 300, 0.05, 0.12);
    }

    player.update(dt, input);

    // Flashlight battery drains while the beam is active.
    if (player.beamActive()) {
      player.battery = Math.max(0, player.battery - dt * 1.15);
      if (player.battery === 0) {
        player.flashlightOn = false;
        UI.subtitle("The flashlight dies in your hand. Find a power cell — fast.", 4);
        audio.beep(200, 0.25, 0.14);
      }
    }

    // Track last "safe" (lit) tile for respawns.
    const room = World.roomAtPx(player.cx(), player.cy());
    const inLight = room && (room.emergency || (powered && (room.lit || room.glow)));
    if (inLight) lastSafeTile = { x: player.tileX(), y: player.tileY() };

    // --- Dread / sanity ---
    updateDread(dt, inLight);
    player.dread01 = dread; // feed detection

    // Presence
    E.updatePresence(dt, player, powered);

    // Tension + fear vignette follow the presence's danger (and a little dread).
    const danger = E.presence.active ? E.presence.danger : 0;
    audio.setTension(Math.min(1, danger + dread * 0.25));
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

  function updateDread(dt, inLight) {
    // Rises in the dark (worse with the beam off and the presence near),
    // falls in lit rooms. Hiding is a slow calm.
    let target;
    if (player.hidden) {
      dread = Math.max(0, dread - dt * 0.06);
    } else {
      const dark = !inLight;
      let rise = 0;
      if (dark) rise += 0.05;
      if (dark && !player.beamActive()) rise += 0.06;
      if (E.presence.active) rise += E.presence.danger * 0.18;
      if (inLight) rise -= 0.14;
      dread = U.clamp(dread + rise * dt * (rise > 0 ? 1 : 1), 0, 1);
    }

    // Whispers as composure frays.
    whisperTimer -= dt;
    if (whisperTimer <= 0) {
      whisperTimer = U.rand(5, 12) * (1.2 - dread); // more frequent at high dread
      if (dread > 0.32 && audio.isReady()) audio.whisper();
    }

    // Hallucinated phantom at high dread — a fake glimpse, no real threat.
    if (!phantom && dread > 0.6 && U.chance(dt * 0.25)) {
      const ang = U.rand(0, Math.PI * 2), r = U.rand(50, 90);
      phantom = { x: player.cx() + Math.cos(ang) * r, y: player.cy() + Math.sin(ang) * r, t: 0.7 };
      if (audio.isReady()) audio.clang();
    }
    if (phantom) { phantom.t -= dt; if (phantom.t <= 0) phantom = null; }
  }

  function centerCamera(k) {
    const tx = U.clamp(player.cx() - AURORA.VIEW_W / 2, 0, World.w * T - AURORA.VIEW_W);
    const ty = U.clamp(player.cy() - AURORA.VIEW_H / 2, 0, World.h * T - AURORA.VIEW_H);
    cam.x = U.lerp(cam.x, tx, k);
    cam.y = U.lerp(cam.y, ty, k);
  }

  // ---------------- Interaction ----------------
  function handleInteraction() {
    // While hidden, E climbs back out — nothing else is reachable.
    if (player.hidden) {
      UI.prompt("[ E ] climb out");
      if (input.consumeInteract()) exitLocker();
      return;
    }

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
      if (near.ref.type === "keycard") label = hasKeycard ? "[ E ] use command keycard" : "[ E ] sealed — command keycard";
      else if (near.ref.type === "maintenance") label = hasMaintKey ? "[ E ] use maintenance keycard" : "[ E ] sealed — maintenance keycard";
      else label = "[ E ] no power";
    } else if (near.type === "locker") {
      label = "[ E ] hide in locker";
    }
    UI.prompt(label);

    if (!input.consumeInteract()) return;

    if (near.type === "item") return pickUp(near.ref);
    if (near.type === "terminal") return useTerminal(near.ref);
    if (near.type === "door") return useDoor(near.ref);
    if (near.type === "locker") return enterLocker(near.ref);
  }

  function pickUp(it) {
    it.taken = true;
    audio.confirm();
    if (it.id === "flashlight") { player.hasFlashlight = true; player.flashlightOn = true; }
    else if (it.kind === "battery") {
      player.battery = Math.min(100, player.battery + 45);
      if (player.hasFlashlight) player.flashlightOn = true;
    }
    else if (it.kind === "maintkey") hasMaintKey = true;
    UI.subtitle(it.pickup, it.kind === "salvage" ? 5.5 : 4.5);
    updateObjective();
    updateInventory();
  }

  function enterLocker(l) {
    if (player.hidden) return;
    // snap the player into the locker tile and hide
    player.placeTile(l.x, l.y);
    player.hidden = true;
    l.occupied = true;
    player._locker = l;
    audio.beep(260, 0.08, 0.1);
    UI.subtitle("You fold yourself into the locker and pull the door shut. [ E ] to climb out.", 3.5);
  }

  function exitLocker() {
    if (!player.hidden) return;
    player.hidden = false;
    if (player._locker) { player._locker.occupied = false; player._locker = null; }
    audio.beep(360, 0.06, 0.1);
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
    const canOpen =
      (d.type === "keycard" && hasKeycard) ||
      (d.type === "maintenance" && hasMaintKey);
    if (canOpen) {
      World.openDoor(d.id);
      audio.confirm();
      UI.subtitle(d.openMsg, 3);
      updateObjective();
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
    exitLocker();
    player.placeTile(lastSafeTile.x, lastSafeTile.y);
    if (player.hasFlashlight) { player.flashlightOn = true; player.battery = Math.max(player.battery, 35); }
    dread = Math.min(dread, 0.4);
    phantom = null;
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
    const kc = hasKeycard ? "<span class='have'>✓ cmd keycard</span>" : "· cmd keycard";
    const mk = hasMaintKey ? "<span class='have'>✓ maint keycard</span>" : "· maint keycard";
    UI.inventory(
      `<b>GEAR</b><br/>${fl}<br/>${kc}<br/>${mk}<br/>` +
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
        dread,
      });
    }

    // Emissive glints (terminals, item shimmer, the eyes) punch through dark
    E.drawEmissive(ctx, cam, powered, time);

    // Hallucinated phantom — pale eyes at the edge of vision, then gone.
    if (phantom) drawPhantom();

    // Locker slats close over the view while hidden.
    if (player && player.hidden) drawLockerView();

    // HUD meters (battery + dread)
    if (player) drawMeters();

    // Film grain — thicker as dread rises.
    grain();
  }

  function drawPhantom() {
    const sx = phantom.x - cam.x, sy = phantom.y - cam.y;
    const a = Math.min(1, phantom.t / 0.7) * 0.8;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(200,205,215,${a})`;
    ctx.fillRect(sx - 1, sy, 1, 1);
    ctx.fillRect(sx + 2, sy, 1, 1);
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 10);
    g.addColorStop(0, `rgba(180,190,210,${a * 0.4})`);
    g.addColorStop(1, "rgba(180,190,210,0)");
    ctx.fillStyle = g;
    ctx.fillRect(sx - 10, sy - 10, 20, 20);
    ctx.globalCompositeOperation = "source-over";
  }

  function drawLockerView() {
    // Dark bars top/bottom + faint vertical slats you peer through.
    ctx.fillStyle = "rgba(2,3,5,0.92)";
    ctx.fillRect(0, 0, AURORA.VIEW_W, 34);
    ctx.fillRect(0, AURORA.VIEW_H - 34, AURORA.VIEW_W, 34);
    ctx.fillStyle = "rgba(2,3,5,0.55)";
    for (let x = 0; x < AURORA.VIEW_W; x += 10) ctx.fillRect(x, 34, 3, AURORA.VIEW_H - 68);
  }

  function drawMeters() {
    const x = 8, y = AURORA.VIEW_H - 14;
    // Battery (only once you have the flashlight)
    if (player.hasFlashlight) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(x - 1, y - 1, 46, 6);
      ctx.fillStyle = "#3a2f14";
      ctx.fillRect(x, y, 44, 4);
      const b = player.battery / 100;
      ctx.fillStyle = player.battery < 22 ? "#c8402f" : (player.flashlightOn ? "#d9a441" : "#6a5a2a");
      ctx.fillRect(x, y, Math.max(0, Math.round(44 * b)), 4);
    }
    // Dread bar (rises from the right, cold blue)
    if (dread > 0.02) {
      const dw = 44, dx = AURORA.VIEW_W - dw - 8, dy = AURORA.VIEW_H - 14;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(dx - 1, dy - 1, dw + 2, 6);
      ctx.fillStyle = "#10131c";
      ctx.fillRect(dx, dy, dw, 4);
      ctx.fillStyle = dread > 0.7 ? "#8fa8d8" : "#4a6a9a";
      const w = Math.round(dw * dread);
      ctx.fillRect(dx + dw - w, dy, w, 4);
    }
  }

  let grainT = 0;
  function grain() {
    grainT += 1;
    if (grainT % 2 !== 0) return; // every other frame, cheap
    ctx.globalAlpha = 0.035 + dread * 0.05;
    ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#000";
    const n = 24 + Math.round(dread * 40);
    for (let i = 0; i < n; i++) {
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
