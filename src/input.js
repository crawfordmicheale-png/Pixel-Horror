/* input.js — keyboard + touch state. Exposes AURORA.input with the
   currently-held movement vector and edge-triggered action flags. */
(function () {
  "use strict";
  const AURORA = window.AURORA;
  const I = (AURORA.input = {});

  const held = {};
  let interactEdge = false; // consumed once per press
  let escEdge = false;

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

  I.holdingBreath = () => !!held.breath;

  I.consumeInteract = function () {
    if (interactEdge) { interactEdge = false; return true; }
    return false;
  };
  I.consumeEsc = function () {
    if (escEdge) { escEdge = false; return true; }
    return false;
  };

  // ---- Touch controls (mobile): left half = virtual stick, right = interact ----
  let touchStick = null;
  I.touch = { x: 0, y: 0, active: false };

  function bindTouch(canvas) {
    canvas.addEventListener("touchstart", (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth / 2) {
          touchStick = { id: t.identifier, ox: t.clientX, oy: t.clientY };
          I.touch.active = true;
        } else {
          interactEdge = true;
        }
      }
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) {
        if (touchStick && t.identifier === touchStick.id) {
          const dx = t.clientX - touchStick.ox;
          const dy = t.clientY - touchStick.oy;
          const m = Math.hypot(dx, dy) || 1;
          const cl = Math.min(m, 50) / 50;
          I.touch.x = (dx / m) * cl;
          I.touch.y = (dy / m) * cl;
        }
      }
      e.preventDefault();
    }, { passive: false });

    const end = (e) => {
      for (const t of e.changedTouches) {
        if (touchStick && t.identifier === touchStick.id) {
          touchStick = null;
          I.touch = { x: 0, y: 0, active: false };
        }
      }
    };
    canvas.addEventListener("touchend", end);
    canvas.addEventListener("touchcancel", end);
  }

  I.bindTouch = bindTouch;

  // Merge touch into axis
  const baseAxis = I.axis;
  I.axis = function () {
    const a = baseAxis();
    if (I.touch.active && (Math.abs(I.touch.x) > 0.15 || Math.abs(I.touch.y) > 0.15)) {
      let x = I.touch.x, y = I.touch.y;
      if (x && y && Math.hypot(x, y) > 1) { const m = Math.hypot(x, y); x /= m; y /= m; }
      return { x, y };
    }
    return a;
  };
})();
