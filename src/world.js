/* world.js — builds the tile grid from story rectangles, owns collision,
   door state, and draws the station floor/walls/props. */
(function () {
  "use strict";
  const AURORA = window.AURORA;
  const U = AURORA.util;
  const T = AURORA.TILE;

  const VOID = 0, FLOOR = 1, WALL = 2, DOOR = 3;

  const World = (AURORA.world = {});

  let grid = [];       // 2D array of tile types
  let roomOf = [];     // 2D array -> room object (or null)
  let W = 0, H = 0;
  let doorState = {};  // doorId -> { open:bool, def }
  let doorTileMap = {};// "x,y" -> doorId

  World.FLOOR = FLOOR; World.WALL = WALL; World.VOID = VOID; World.DOOR = DOOR;

  World.build = function () {
    const S = AURORA.story;
    // Compute bounds from all rects + a margin for walls.
    let maxX = 0, maxY = 0;
    const rects = S.rooms.concat(S.corridors);
    rects.forEach((r) => {
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    });
    W = maxX + 3;
    H = maxY + 3;

    grid = [];
    roomOf = [];
    for (let y = 0; y < H; y++) {
      grid.push(new Array(W).fill(VOID));
      roomOf.push(new Array(W).fill(null));
    }

    // Carve floors.
    S.rooms.forEach((r) => carve(r, r));
    S.corridors.forEach((r) => carve(r, null));

    // Wrap floors in walls.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (grid[y][x] !== VOID) continue;
        if (hasFloorNeighbor(x, y)) grid[y][x] = WALL;
      }
    }

    // Place doors.
    doorState = {};
    doorTileMap = {};
    S.doors.forEach((d) => {
      doorState[d.id] = { open: false, def: d };
      d.tiles.forEach(([x, y]) => {
        grid[y][x] = DOOR;
        doorTileMap[x + "," + y] = d.id;
      });
    });

    World.w = W;
    World.h = H;
  };

  function carve(r, room) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (y < 0 || x < 0 || y >= H || x >= W) continue;
        grid[y][x] = FLOOR;
        if (room) roomOf[y][x] = room;
      }
    }
  }

  function hasFloorNeighbor(x, y) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (grid[ny][nx] === FLOOR) return true;
      }
    return false;
  }

  World.tileAt = (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return VOID;
    return grid[ty][tx];
  };

  World.roomAtTile = (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return null;
    return roomOf[ty][tx];
  };

  World.roomAtPx = (px, py) => World.roomAtTile((px / T) | 0, (py / T) | 0);

  // Solid for movement: walls, void, and closed doors.
  World.solidAt = function (tx, ty) {
    const t = World.tileAt(tx, ty);
    if (t === WALL || t === VOID) return true;
    if (t === DOOR) {
      const id = doorTileMap[tx + "," + ty];
      return !(doorState[id] && doorState[id].open);
    }
    return false;
  };

  // Pixel-space solid test for an AABB (used by player + presence).
  World.rectHitsSolid = function (px, py, w, h) {
    const x0 = Math.floor(px / T);
    const y0 = Math.floor(py / T);
    const x1 = Math.floor((px + w - 1) / T);
    const y1 = Math.floor((py + h - 1) / T);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (World.solidAt(tx, ty)) return true;
    return false;
  };

  // Line-of-sight between two tile coords (Bresenham), blocked by walls/void
  // but NOT by open doors. Used for the presence's sight and light checks.
  World.lineClear = function (x0, y0, x1, y1) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    let guard = 0;
    while (guard++ < 500) {
      if (x === x1 && y === y1) return true;
      const t = World.tileAt(x, y);
      if ((t === WALL || t === VOID) && !(x === x0 && y === y0)) return false;
      if (t === DOOR) {
        const id = doorTileMap[x + "," + y];
        if (!(doorState[id] && doorState[id].open)) return false;
      }
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return false;
  };

  World.openDoor = function (id) {
    if (doorState[id]) doorState[id].open = true;
  };
  World.isDoorOpen = (id) => doorState[id] && doorState[id].open;
  World.doorIdAtTile = (tx, ty) => doorTileMap[tx + "," + ty] || null;

  // ---------- Rendering ----------
  // Deterministic per-tile detail so texture doesn't shimmer frame to frame.
  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) ^ 0x5f356495;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }

  World.draw = function (ctx, cam, powered) {
    const x0 = Math.max(0, (cam.x / T | 0) - 1);
    const y0 = Math.max(0, (cam.y / T | 0) - 1);
    const x1 = Math.min(W - 1, ((cam.x + AURORA.VIEW_W) / T | 0) + 1);
    const y1 = Math.min(H - 1, ((cam.y + AURORA.VIEW_H) / T | 0) + 1);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = grid[ty][tx];
        if (t === VOID) continue;
        const sx = Math.round(tx * T - cam.x);
        const sy = Math.round(ty * T - cam.y);
        if (t === FLOOR) drawFloor(ctx, sx, sy, tx, ty);
        else if (t === WALL) drawWall(ctx, sx, sy, tx, ty);
        else if (t === DOOR) drawDoor(ctx, sx, sy, tx, ty);
      }
    }
  };

  function drawFloor(ctx, sx, sy, tx, ty) {
    const room = roomOf[ty][tx];
    const glow = room && room.glow;
    const h = hash(tx, ty);
    // base plate
    ctx.fillStyle = glow ? "#141b22" : "#0f1318";
    ctx.fillRect(sx, sy, T, T);
    // seam grid
    ctx.fillStyle = glow ? "#1c2732" : "#151b21";
    ctx.fillRect(sx, sy, T, 1);
    ctx.fillRect(sx, sy, 1, T);
    // scattered detail: rivets, stains, grating
    if (h < 0.10) {
      ctx.fillStyle = "#0a0d10";
      ctx.fillRect(sx + 4, sy + 5, 8, 6); // stain
    } else if (h < 0.18) {
      ctx.fillStyle = "#1a222a";
      ctx.fillRect(sx + 3, sy + 3, 2, 2);
      ctx.fillRect(sx + 11, sy + 11, 2, 2); // rivets
    }
    if (glow && h < 0.06) {
      ctx.fillStyle = "#2a4d3a";
      ctx.fillRect(sx + 6, sy + 6, 4, 4); // faint reactor-green light strip
    }
  }

  function drawWall(ctx, sx, sy, tx, ty) {
    const h = hash(tx, ty);
    // Is the tile "below" a floor? Then it's a front-facing wall; add a lip.
    const front = World.tileAt(tx, ty - 1) === FLOOR ||
      (World.tileAt(tx, ty - 1) === DOOR);
    ctx.fillStyle = "#20272e";
    ctx.fillRect(sx, sy, T, T);
    // paneling
    ctx.fillStyle = "#171d23";
    ctx.fillRect(sx + 1, sy + 1, T - 2, T - 2);
    ctx.fillStyle = "#2a333b";
    ctx.fillRect(sx + 1, sy + 1, T - 2, 2);
    if (h < 0.14) {
      ctx.fillStyle = "#0c0f12";
      ctx.fillRect(sx + 5, sy + 6, 6, 5); // grime / hole
    }
    if (front) {
      ctx.fillStyle = "#0a0d10";
      ctx.fillRect(sx, sy + T - 3, T, 3); // shadow lip at floor line
    }
  }

  function drawDoor(ctx, sx, sy, tx, ty) {
    const id = doorTileMap[tx + "," + ty];
    const open = doorState[id] && doorState[id].open;
    if (open) {
      drawFloor(ctx, sx, sy, tx, ty);
      // recessed door pockets
      ctx.fillStyle = "#0a0d10";
      ctx.fillRect(sx, sy, 2, T);
      ctx.fillRect(sx + T - 2, sy, 2, T);
      return;
    }
    // closed blast door
    ctx.fillStyle = "#2c343c";
    ctx.fillRect(sx, sy, T, T);
    ctx.fillStyle = "#3a444d";
    for (let i = 2; i < T; i += 4) ctx.fillRect(sx, sy + i, T, 2); // ridges
    // hazard chevrons
    const type = doorState[id].def.type;
    ctx.fillStyle = type === "power" ? "#c8402f" : "#d9a441";
    ctx.fillRect(sx + T / 2 - 1, sy + 2, 2, T - 4);
  }

  // Reset (for restart).
  World.reset = function () {
    World.build();
  };
})();
