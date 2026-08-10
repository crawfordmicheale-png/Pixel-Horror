/* input.js — keyboard + touch state. Exposes AURORA.input with the
   currently-held movement vector and edge-triggered action flags. */
(function () {
  "use strict";
  const AURORA = window.AURORA;
  const I = (AURORA.input = {});

  const held = {};
  let interactEdge = false; // consumed once per press
  let escEdge = false;
  let toggleEdge = false;   // flashlight on/off

  const MAP = {
    ArrowUp: "up", KeyW: "up",
    ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ShiftLeft: "breath", ShiftRight: "breath",
  };

  window.addEventListener("keydown", (e) => {
    // Let overlays handle their own keys when open.
    if (MAP[e.code]) {
      held[MAP[e.code]] = true;
      e.preventDefault();
    }
    if (e.code === "KeyE" || e.code === "Space" || e.code === "Enter") {
      interactEdge = true;
      e.preventDefault();
    }
    if (e.code === "Escape") escEdge = true;
    if (e.code === "KeyF") { toggleEdge = true; e.preventDefault(); }
  });

  window.addEventListener("keyup", (e) => {
    if (MAP[e.code]) held[MAP[e.code]] = false;
  });

  // Lose focus -> release everything (prevents "stuck running" bug).
  window.addEventListener("blur", () => {
    for (const k in held) held[k] = false;
  });

  I.axis = function () {
    let x = 0, y = 0;
    if (held.left) x -= 1;
    if (held.right) x += 1;
    if (held.up) y -= 1;
    if (held.down) y += 1;
    // normalize diagonals
    if (x && y) { x *= 0.7071; y *= 0.7071; }
    return { x, y };
  };

  // On-screen (mobile) control state, driven by mobile.js.
  I.touchAxis = { x: 0, y: 0 };
  I.breathButton = false;
  I.setTouchAxis = (x, y) => { I.touchAxis.x = x; I.touchAxis.y = y; };
  I.setBreath = (b) => { I.breathButton = !!b; };
  I.pressInteract = () => { interactEdge = true; };
  I.pressToggle = () => { toggleEdge = true; };

  I.consumeToggle = function () {
    if (toggleEdge) { toggleEdge = false; return true; }
    return false;
  };

  I.holdingBreath = () => !!held.breath || I.breathButton;

  I.consumeInteract = function () {
    if (interactEdge) { interactEdge = false; return true; }
    return false;
  };
  I.consumeEsc = function () {
    if (escEdge) { escEdge = false; return true; }
    return false;
  };

  // ---- Touch controls (mobile): left half = virtual stick, right = interact ----
  // Touch input is handled by the dedicated on-screen controls in mobile.js,
  // which call I.setTouchAxis / I.setBreath / I.pressInteract. bindTouch is
  // kept as a no-op so older call sites remain safe.
  I.bindTouch = function () {};

  // Merge on-screen joystick into axis (takes priority when engaged).
  const baseAxis = I.axis;
  I.axis = function () {
    const tx = I.touchAxis.x, ty = I.touchAxis.y;
    if (Math.abs(tx) > 0.12 || Math.abs(ty) > 0.12) {
      let x = tx, y = ty;
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      return { x, y };
    }
    return baseAxis();
  };
})();
