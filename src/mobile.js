/* mobile.js — on-screen touch controls: a floating movement joystick on the
   left half of the screen, plus INTERACT and HOLD-BREATH buttons on the right.
   Only revealed on touch-capable devices. Feeds AURORA.input. */
(function () {
  "use strict";
  const AURORA = window.AURORA;
  const input = AURORA.input;

  const isTouch =
    "ontouchstart" in window ||
    (navigator.maxTouchPoints || 0) > 0 ||
    (navigator.msMaxTouchPoints || 0) > 0;

  function init() {
    const layer = document.getElementById("touch-controls");
    const joyBase = document.getElementById("joy-base");
    const joyThumb = document.getElementById("joy-thumb");
    const btnInteract = document.getElementById("btn-interact");
    const btnBreath = document.getElementById("btn-breath");
    if (!layer) return;

    if (!isTouch) {
      // Leave hidden on desktop; a resize might still be a touch laptop, so
      // reveal on the first real touch anywhere.
      window.addEventListener("touchstart", enable, { once: true, passive: true });
    } else {
      enable();
    }

    function enable() {
      document.body.classList.add("has-touch");
      layer.classList.add("active");
    }

    // ---- Floating joystick (left half) ----
    const R = 46; // max thumb travel (px)
    let joyId = null;
    let ox = 0, oy = 0;

    function joyStart(e) {
      // Only claim touches that begin on the left half and not on a button.
      for (const t of e.changedTouches) {
        if (joyId !== null) continue;
        if (t.clientX > window.innerWidth * 0.55) continue;
        joyId = t.identifier;
        ox = t.clientX; oy = t.clientY;
        joyBase.style.left = ox + "px";
        joyBase.style.top = oy + "px";
        joyBase.style.opacity = "1";
        moveThumb(0, 0);
      }
      enable();
    }
    function joyMove(e) {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        let dx = t.clientX - ox, dy = t.clientY - oy;
        const m = Math.hypot(dx, dy);
        if (m > R) { dx = (dx / m) * R; dy = (dy / m) * R; }
        moveThumb(dx, dy);
        input.setTouchAxis(dx / R, dy / R);
        e.preventDefault();
      }
    }
    function joyEnd(e) {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        joyId = null;
        joyBase.style.opacity = "0";
        moveThumb(0, 0);
        input.setTouchAxis(0, 0);
      }
    }
    function moveThumb(dx, dy) {
      joyThumb.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    // Listen on the whole layer so the joystick floats to wherever you press.
    layer.addEventListener("touchstart", joyStart, { passive: false });
    layer.addEventListener("touchmove", joyMove, { passive: false });
    layer.addEventListener("touchend", joyEnd, { passive: true });
    layer.addEventListener("touchcancel", joyEnd, { passive: true });

    // ---- Interact button ----
    const fireInteract = (e) => {
      e.preventDefault();
      e.stopPropagation();
      AURORA.audio && AURORA.audio.resume && AURORA.audio.resume();
      input.pressInteract();
      flash(btnInteract);
    };
    btnInteract.addEventListener("touchstart", fireInteract, { passive: false });
    btnInteract.addEventListener("click", fireInteract);

    // ---- Hold-breath button (press-and-hold) ----
    const breathOn = (e) => { e.preventDefault(); e.stopPropagation(); input.setBreath(true); btnBreath.classList.add("down"); };
    const breathOff = (e) => { if (e) e.stopPropagation(); input.setBreath(false); btnBreath.classList.remove("down"); };
    btnBreath.addEventListener("touchstart", breathOn, { passive: false });
    btnBreath.addEventListener("touchend", breathOff, { passive: true });
    btnBreath.addEventListener("touchcancel", breathOff, { passive: true });
    // Mouse fallback (useful for testing in a desktop browser).
    btnBreath.addEventListener("mousedown", breathOn);
    window.addEventListener("mouseup", () => breathOff());

    function flash(el) {
      el.classList.add("down");
      setTimeout(() => el.classList.remove("down"), 110);
    }
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
