/* ui.js — DOM overlays: log reader, keypad puzzles, subtitles, prompts,
   objective tracker, and end screens. While a modal overlay is open the
   game loop freezes the world (see game.js checking AURORA.ui.isModal()). */
(function () {
  "use strict";
  const AURORA = window.AURORA;
  const audio = AURORA.audio;

  const UI = (AURORA.ui = {});

  let el = {};
  let modal = null;        // "reader" | "keypad" | "choice" | "end" | null
  let subtitleTimer = 0;

  // Keypad session state
  let kp = { code: "", target: "", onOk: null, entry: "" };
  // Choice session
  let choiceCb = null;

  UI.init = function () {
    el.reader = document.getElementById("reader");
    el.readerSource = document.getElementById("reader-source");
    el.readerTitle = document.getElementById("reader-title");
    el.readerBody = document.getElementById("reader-body");

    el.keypad = document.getElementById("keypad");
    el.keypadLabel = document.getElementById("keypad-label");
    el.keypadDisplay = document.getElementById("keypad-display");

    el.subtitle = document.getElementById("subtitle");
    el.prompt = document.getElementById("prompt");
    el.objective = document.getElementById("objective");

    el.title = document.getElementById("title");
    el.end = document.getElementById("endscreen");
    el.endTitle = document.getElementById("end-title");
    el.endBody = document.getElementById("end-body");
    el.endBtn = document.getElementById("endBtn");

    // Keypad buttons
    el.keypad.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => onKeypadKey(b.dataset.k));
    });

    UI.isModal = () => modal !== null && modal !== "subtitleOnly";
  };

  UI.isModal = () => modal !== null;

  // ---------------- Subtitle (non-blocking) ----------------
  UI.subtitle = function (text, dur = 3.2) {
    el.subtitle.textContent = text;
    el.subtitle.classList.add("show");
    subtitleTimer = dur;
  };
  UI.tickSubtitle = function (dt) {
    if (subtitleTimer > 0) {
      subtitleTimer -= dt;
      if (subtitleTimer <= 0) el.subtitle.classList.remove("show");
    }
  };

  // ---------------- Interaction prompt ----------------
  UI.prompt = function (text) {
    if (!text) { el.prompt.classList.add("hidden"); return; }
    el.prompt.textContent = text;
    el.prompt.classList.remove("hidden");
  };

  // ---------------- Objective ----------------
  UI.objective = function (html) {
    if (!html) { el.objective.classList.add("hidden"); return; }
    el.objective.innerHTML = html;
    el.objective.classList.remove("hidden");
  };

  // ---------------- Log reader ----------------
  UI.showReader = function (term) {
    modal = "reader";
    el.readerSource.textContent = term.source || "// LOG";
    el.readerTitle.textContent = term.title || "";
    el.readerBody.textContent = term.body || "";
    el.reader.classList.remove("hidden");
    audio.duck(true);
    audio.beep(420, 0.05, 0.1);
  };
  function closeReader() {
    el.reader.classList.add("hidden");
    audio.duck(false);
    modal = null;
  }

  // ---------------- Keypad ----------------
  UI.showKeypad = function (label, targetCode, onOk) {
    modal = "keypad";
    kp = { target: targetCode, onOk, entry: "" };
    el.keypadLabel.textContent = label || "ENTER CODE";
    updateKeypadDisplay();
    el.keypad.classList.remove("hidden");
    audio.duck(true);
  };
  function closeKeypad() {
    el.keypad.classList.add("hidden");
    audio.duck(false);
    modal = null;
  }
  function updateKeypadDisplay() {
    const slots = 4;
    let s = "";
    for (let i = 0; i < slots; i++) s += (i < kp.entry.length ? kp.entry[i] : "_") + " ";
    el.keypadDisplay.textContent = s.trim();
  }
  function onKeypadKey(k) {
    if (modal !== "keypad") return;
    if (k === "clr") { kp.entry = ""; audio.beep(300, 0.04, 0.1); }
    else if (k === "ok") {
      if (kp.entry === kp.target) {
        audio.confirm();
        const cb = kp.onOk;
        closeKeypad();
        if (cb) cb();
      } else {
        audio.error();
        kp.entry = "";
        el.keypadDisplay.textContent = "ACCESS DENIED";
        setTimeout(() => { if (modal === "keypad") updateKeypadDisplay(); }, 700);
        return;
      }
    } else if (kp.entry.length < 4) {
      kp.entry += k;
      audio.beep(540 + Number(k) * 12, 0.04, 0.1);
    }
    updateKeypadDisplay();
  }

  // ---------------- Ending choice ----------------
  UI.showChoice = function (cb) {
    modal = "choice";
    choiceCb = cb;
    // Reuse the reader panel styling with two buttons injected.
    el.readerSource.textContent = "// COMMAND AUTHORITY GRANTED";
    el.readerTitle.textContent = "One transmission window remains.";
    el.readerBody.innerHTML =
      "The uplink is live and the scuttle charges are armed. Captain Vance " +
      "left you the choice he could not make.\n\n" +
      "<div style='margin-top:18px;display:flex;flex-direction:column;gap:10px'>" +
      "<button class='start-btn' id='choiceWarn'>BROADCAST THE WARNING</button>" +
      "<button class='start-btn' id='choiceBurn' style='background:#c8402f;color:#fff'>SCUTTLE THE STATION</button>" +
      "</div>";
    el.reader.classList.remove("hidden");
    document.getElementById("choiceWarn").addEventListener("click", () => finishChoice("warn"));
    document.getElementById("choiceBurn").addEventListener("click", () => finishChoice("burn"));
    audio.duck(true);
  };
  function finishChoice(which) {
    el.reader.classList.add("hidden");
    modal = null;
    const cb = choiceCb; choiceCb = null;
    if (cb) cb(which);
  }

  // ---------------- End screen ----------------
  UI.showEnd = function (ending) {
    modal = "end";
    el.endTitle.textContent = ending.title;
    el.endTitle.className = "end-title " + (ending.cls || "");
    el.endBody.textContent = ending.body;
    el.endBtn.textContent = ending.cls === "dead" ? "TRY AGAIN" : "RETURN TO TITLE";
    el.end.classList.remove("hidden");
  };
  UI.hideEnd = function () {
    el.end.classList.add("hidden");
    modal = null;
  };

  UI.hideTitle = function () { el.title.classList.add("hidden"); };
  UI.showTitle = function () { el.title.classList.remove("hidden"); };

  // ---------------- Key handling for open modals ----------------
  // Called from game loop each frame with the raw input helpers.
  UI.handleModalKeys = function (input) {
    if (modal === "reader") {
      if (input.consumeInteract() || input.consumeEsc()) closeReader();
      return true;
    }
    if (modal === "keypad") {
      if (input.consumeEsc()) { closeKeypad(); return true; }
      // allow physical number keys
      // (interact/enter acts as OK)
      if (input.consumeInteract()) onKeypadKey("ok");
      return true;
    }
    if (modal === "choice") { input.consumeEsc(); input.consumeInteract(); return true; }
    if (modal === "end") return true;
    return false;
  };

  // Physical number keys route to keypad when open.
  window.addEventListener("keydown", (e) => {
    if (modal !== "keypad") return;
    if (/^[0-9]$/.test(e.key)) onKeypadKey(e.key);
    else if (e.key === "Backspace") onKeypadKey("clr");
  });
})();
