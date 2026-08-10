/* player.js — the salvage responder. Smooth pixel movement with wall
   sliding, a facing direction the flashlight follows, and "hold breath"
   (stand still to go quiet). */
(function () {
  "use strict";
  const AURORA = window.AURORA;
  const U = AURORA.util;
  const T = AURORA.TILE;
  const World = AURORA.world;

  function Player() {
    this.w = 8; this.h = 8;
    this.x = 0; this.y = 0;
    this.speed = 44;             // px/s
    this.facing = 0;            // radians; flashlight direction
    this.hasFlashlight = false;
    this.moving = false;
    this.holdingBreath = false;
    this.bob = 0;
    this.batteryFlicker = false; // brief beam stutter (atmosphere)
    this.batteryDead = false;    // not used for game-over; reserved
    this.step = 0;
  }

  Player.prototype.spawnAtDock = function () {
    const S = AURORA.story;
    // story player start is baked into dock; place near flashlight-ish.
    this.x = 6 * T;
    this.y = 29 * T;
    this.facing = -Math.PI / 2; // looking "up" into the station
  };

  Player.prototype.placeTile = function (tx, ty) {
    this.x = tx * T + (T - this.w) / 2;
    this.y = ty * T + (T - this.h) / 2;
  };

  Player.prototype.cx = function () { return this.x + this.w / 2; };
  Player.prototype.cy = function () { return this.y + this.h / 2; };
  Player.prototype.tileX = function () { return (this.cx() / T) | 0; };
  Player.prototype.tileY = function () { return (this.cy() / T) | 0; };

  Player.prototype.update = function (dt, input) {
    const ax = input.axis();
    this.holdingBreath = input.holdingBreath();
    let mx = ax.x, my = ax.y;

    // Hold breath -> stand still & quiet (no movement).
    if (this.holdingBreath) { mx = 0; my = 0; }

    this.moving = (mx !== 0 || my !== 0);
    if (this.moving) {
      // Update facing toward movement direction (smoothly).
      const target = Math.atan2(my, mx);
      const diff = U.angleDiff(target, this.facing);
      this.facing += diff * Math.min(1, dt * 14);
      this.step += dt * 8;
      this.bob = Math.sin(this.step) * 1;

      const spd = this.speed * (this.holdingBreath ? 0 : 1);
      const nx = mx * spd * dt;
      const ny = my * spd * dt;
      // axis-separated collision for wall sliding
      if (!World.rectHitsSolid(this.x + nx, this.y, this.w, this.h)) this.x += nx;
      if (!World.rectHitsSolid(this.x, this.y + ny, this.w, this.h)) this.y += ny;
    } else {
      this.bob *= 0.8;
    }

    // Rare beam flicker for unease.
    this.batteryFlicker = this.hasFlashlight && U.chance(dt * 0.4);
  };

  Player.prototype.draw = function (ctx, cam, time) {
    const sx = Math.round(this.cx() - cam.x);
    const sy = Math.round(this.cy() - cam.y + this.bob);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(sx - 4, sy + 4, 8, 3);

    // Body — a hunched figure in an EVA suit, seen top-down/back.
    // orientation cue: a small helmet lamp nub points in facing dir.
    ctx.fillStyle = "#3b4a52";           // suit
    ctx.fillRect(sx - 4, sy - 5, 8, 9);
    ctx.fillStyle = "#4d606a";           // shoulders highlight
    ctx.fillRect(sx - 4, sy - 5, 8, 2);
    ctx.fillStyle = "#222c32";           // backpack
    ctx.fillRect(sx - 3, sy - 3, 6, 4);
    // helmet
    ctx.fillStyle = "#5a6f79";
    ctx.fillRect(sx - 3, sy - 6, 6, 3);
    // facing nub (lamp housing)
    const fx = Math.round(Math.cos(this.facing) * 5);
    const fy = Math.round(Math.sin(this.facing) * 5);
    ctx.fillStyle = this.hasFlashlight ? "#e9dca0" : "#33403a";
    ctx.fillRect(sx + fx - 1, sy + fy - 1, 2, 2);

    // Holding breath cue — a faint ring.
    if (this.holdingBreath) {
      ctx.strokeStyle = "rgba(180,200,210,0.25)";
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  AURORA.Player = Player;
})();
