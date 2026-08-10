/* lighting.js — the darkness and the flashlight.
   Renders a black overlay and carves visibility into it: a raycast
   flashlight cone (with real wall shadows), a faint halo around the
   player, dim ambient in powered rooms, and reactor/research glow. */
(function () {
  "use strict";
  const AURORA = window.AURORA;
  const U = AURORA.util;
  const T = AURORA.TILE;
  const World = AURORA.world;

  const Light = (AURORA.lighting = {});

  let lc = null, lctx = null; // darkness/mask canvas
  let tc = null, tctx = null; // warm tint canvas

  Light.init = function () {
    lc = document.createElement("canvas");
    lc.width = AURORA.VIEW_W; lc.height = AURORA.VIEW_H;
    lctx = lc.getContext("2d");
    tc = document.createElement("canvas");
    tc.width = AURORA.VIEW_W; tc.height = AURORA.VIEW_H;
    tctx = tc.getContext("2d");
  };

  // March a ray from (px,py) at angle until it hits a solid tile or maxR.
  function castRay(px, py, ang, maxR) {
    const step = 3;
    const dx = Math.cos(ang) * step, dy = Math.sin(ang) * step;
    let x = px, y = py, d = 0;
    while (d < maxR) {
      x += dx; y += dy; d += step;
      if (World.solidAt((x / T) | 0, (y / T) | 0)) break;
    }
    return { x, y, d };
  }

  // Build + carve a visibility polygon for a light at (px,py).
  function carveLight(cam, px, py, a0, a1, maxR, rays, intensity) {
    const cx = px - cam.x, cy = py - cam.y;
    lctx.save();
    lctx.beginPath();
    lctx.moveTo(cx, cy);
    for (let i = 0; i <= rays; i++) {
      const ang = U.lerp(a0, a1, i / rays);
      const hit = castRay(px, py, ang, maxR);
      lctx.lineTo(hit.x - cam.x, hit.y - cam.y);
    }
    lctx.closePath();
    lctx.clip();
    // radial falloff, carved via destination-out
    const g = lctx.createRadialGradient(cx, cy, 4, cx, cy, maxR);
    g.addColorStop(0, `rgba(0,0,0,${intensity})`);
    g.addColorStop(0.55, `rgba(0,0,0,${intensity * 0.65})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = g;
    lctx.fillRect(cx - maxR, cy - maxR, maxR * 2, maxR * 2);
    lctx.restore();
  }

  // Warm additive tint inside the flashlight cone.
  function tintCone(cam, px, py, a0, a1, maxR, rays, color, alpha) {
    const cx = px - cam.x, cy = py - cam.y;
    tctx.save();
    tctx.beginPath();
    tctx.moveTo(cx, cy);
    for (let i = 0; i <= rays; i++) {
      const ang = U.lerp(a0, a1, i / rays);
      const hit = castRay(px, py, ang, maxR);
      tctx.lineTo(hit.x - cam.x, hit.y - cam.y);
    }
    tctx.closePath();
    tctx.clip();
    const g = tctx.createRadialGradient(cx, cy, 2, cx, cy, maxR);
    g.addColorStop(0, color.replace("A", alpha));
    g.addColorStop(1, color.replace("A", "0"));
    tctx.fillStyle = g;
    tctx.fillRect(cx - maxR, cy - maxR, maxR * 2, maxR * 2);
    tctx.restore();
  }

  /**
   * @param opts { cam, player, powered, time, fearVignette (0..1) }
   */
  Light.draw = function (ctx, opts) {
    const { cam, player, powered, time } = opts;

    // 1) Base darkness. Emergency/lit rooms are handled by carving below.
    lctx.globalCompositeOperation = "source-over";
    lctx.clearRect(0, 0, lc.width, lc.height);
    // Fear tightens the darkness (less ambient bleed).
    const baseDark = 1.0;
    lctx.fillStyle = `rgba(2,3,6,${baseDark})`;
    lctx.fillRect(0, 0, lc.width, lc.height);

    // Prepare tint canvas
    tctx.globalCompositeOperation = "source-over";
    tctx.clearRect(0, 0, tc.width, tc.height);

    // 2) Ambient room light (dim) for emergency + powered rooms.
    lctx.globalCompositeOperation = "destination-out";
    carveRooms(cam, powered, time);

    // 3) Player halo — always a faint pool so you see your own feet.
    // With the beam off (or dead battery) it shrinks to near-blindness.
    const px = player.cx(), py = player.cy();
    const beam = player.beamActive();
    const haloR = beam ? 30 : 18;
    carveLight(cam, px, py, 0, Math.PI * 2, haloR, 20, beam ? 0.85 : 0.42);

    // 4) Flashlight cone (raycast, with wall shadows + a subtle flicker).
    if (player.beamActive()) {
      // Low battery makes the beam gutter and shrink.
      const low = player.battery < 22 ? (player.battery / 22) : 1;
      const lowFlick = player.battery < 22 ? (U.flicker(time * 9, 3) > 0.4 ? 1 : 0.45) : 1;
      const flick = (0.9 + U.flicker(time * 3, 1) * 0.12 - (player.batteryFlicker ? 0.25 : 0)) * lowFlick;
      const half = 0.52;
      const R = (96 * (0.6 + 0.4 * low)) * flick;
      const dir = player.facing;
      carveLight(cam, px, py, dir - half, dir + half, R, 40, 1.0);
      // warm amber tint in the beam
      tctx.globalCompositeOperation = "source-over";
      tintCone(cam, px, py, dir - half, dir + half, R, 40, "rgba(240,196,110,A)", 0.16 * flick);
    }

    // 5) Reactor / research glow (green), carved so those rooms breathe light.
    carveGlow(cam, powered, time);

    // 6) Composite darkness over the scene.
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(lc, 0, 0);

    // 7) Additive warm tint (kept subtle so it never blows out).
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.9;
    ctx.drawImage(tc, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // 8) Fear vignette — closes in when the presence is near.
    if (opts.fearVignette > 0.01) {
      const f = opts.fearVignette;
      const g = ctx.createRadialGradient(
        lc.width / 2, lc.height / 2, lc.height * (0.42 - 0.22 * f),
        lc.width / 2, lc.height / 2, lc.height * 0.72
      );
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(20,0,0,${0.55 * f})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, lc.width, lc.height);
    }

    // 9) Dread — a cold, breathing edge-darkness as your composure frays.
    const dread = opts.dread || 0;
    if (dread > 0.02) {
      const pulse = 0.6 + Math.sin(time * (2 + dread * 4)) * 0.4 * dread;
      const g = ctx.createRadialGradient(
        lc.width / 2, lc.height / 2, lc.height * (0.5 - 0.25 * dread),
        lc.width / 2, lc.height / 2, lc.height * 0.85
      );
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(6,10,22,${0.5 * dread * pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, lc.width, lc.height);
    }
  };

  function carveRooms(cam, powered, time) {
    const S = AURORA.story;
    S.rooms.forEach((room) => {
      let lvl = 0;
      if (room.emergency) lvl = 0.30;              // faint always
      if (powered && room.lit) lvl = 0.62;         // dim ceiling light
      if (powered && room.glow) lvl = Math.max(lvl, 0.5);
      if (lvl <= 0) return;

      // Flicker unstable rooms slightly.
      const fk = 0.9 + U.flicker(time * 2.3, room.x + room.y) * 0.16;
      lvl *= fk;

      const rx = room.x * T - cam.x;
      const ry = room.y * T - cam.y;
      const rw = room.w * T, rh = room.h * T;
      // Cull offscreen.
      if (rx > lc.width || ry > lc.height || rx + rw < 0 || ry + rh < 0) return;

      // Soft-edged rect: radial-ish via a gradient from center.
      const g = lctx.createRadialGradient(
        rx + rw / 2, ry + rh / 2, Math.min(rw, rh) * 0.15,
        rx + rw / 2, ry + rh / 2, Math.max(rw, rh) * 0.62
      );
      g.addColorStop(0, `rgba(0,0,0,${lvl})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      lctx.fillStyle = g;
      lctx.fillRect(rx - 4, ry - 4, rw + 8, rh + 8);
    });
  }

  function carveGlow(cam, powered, time) {
    if (!powered) return;
    const S = AURORA.story;
    tctx.globalCompositeOperation = "source-over";
    S.rooms.forEach((room) => {
      if (!room.glow) return;
      const pulse = 0.5 + Math.sin(time * 1.4 + room.x) * 0.18;
      const cx = (room.x + room.w / 2) * T - cam.x;
      const cy = (room.y + room.h / 2) * T - cam.y;
      const r = Math.max(room.w, room.h) * T * 0.5;
      const g = tctx.createRadialGradient(cx, cy, 4, cx, cy, r);
      g.addColorStop(0, `rgba(70,180,120,${0.10 * pulse})`);
      g.addColorStop(1, "rgba(70,180,120,0)");
      tctx.fillStyle = g;
      tctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    });
  }
})();
