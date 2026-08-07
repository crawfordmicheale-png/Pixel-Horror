/* util.js — global namespace + small helpers shared across modules.
   Everything hangs off window.AURORA so the classic scripts can talk
   to each other without a module bundler. */
(function () {
  "use strict";

  const AURORA = (window.AURORA = window.AURORA || {});

  // Core tuning constants in one place.
  AURORA.TILE = 16;          // world tile size, in source pixels
  AURORA.VIEW_W = 320;       // canvas source resolution
  AURORA.VIEW_H = 180;

  const U = (AURORA.util = {});

  U.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  // Deterministic-ish RNG helpers (Math.random is fine for a horror mood).
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
  U.chance = (p) => Math.random() < p;
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Angle helpers
  U.angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  U.angleDiff = (a, b) => {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  // AABB overlap
  U.aabb = (ax, ay, aw, ah, bx, by, bw, bh) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  // Simple event bus so modules stay decoupled.
  const listeners = {};
  U.on = (evt, fn) => {
    (listeners[evt] = listeners[evt] || []).push(fn);
  };
  U.emit = (evt, data) => {
    (listeners[evt] || []).forEach((fn) => fn(data));
  };

  // 1D value noise-ish flicker generator, for lights.
  U.flicker = (t, seed) => {
    const s = Math.sin((t + seed) * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };
})();
