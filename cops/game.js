/* The patio. The page opens on the clip's first frame, exactly as broadcast. Press play and it runs
   on RuneScape rules: 0.6 second ticks, click to walk, click another officer to fight or trade.
   Everyone who opens the page joins the same room (up to 24). Alone, the other officer is an NPC. */
(function () {
  "use strict";
  var GD = window.COPS_GRID, META = window.COPS_META;
  // everyone lands in room 1 unless the address says otherwise: /cops/?room=friday makes a private patio
  var roomArg = (/[?&]room=([A-Za-z0-9_-]{1,24})/.exec(location.search) || [])[1];
  var W = 1280, H = 720, TICK = 600, MAXP = 24, ROOM = "holyfire-patio-room-" + (roomArg || "1");
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage"), cv = $("world"), cx = cv.getContext("2d"), ui = $("ui");
  var scale = 1, started = false, tickN = 0, tickStart = 0;

  function fit() {
    scale = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = "scale(" + scale + ")";
    stage.style.left = (innerWidth - W * scale) / 2 + "px"; stage.style.top = (innerHeight - H * scale) / 2 + "px";
  }
  addEventListener("resize", fit); fit();

  var img = {};
  ["frame.webp", "bg.png", "cop1.png", "cop2.png"].forEach(function (f) { var i = new Image(); i.src = f; i.onload = function () { render(performance.now()); }; img[f.split(".")[0]] = i; });

  // ---------- tile grid ----------
  function walkable(i, j) { var r = GD.rows[j - GD.j0]; return !!r && r.charAt(i - GD.i0) === "1"; }
  function scr(i, j) { return { x: GD.O[0] + i * GD.U[0] + j * GD.V[0], y: GD.O[1] + i * GD.U[1] + j * GD.V[1] }; }
  function tileAt(x, y) {
    var a = GD.U[0], b = GD.V[0], c = GD.U[1], d = GD.V[1], det = a * d - b * c, dx = x - GD.O[0], dy = y - GD.O[1];
    return { i: Math.round((d * dx - b * dy) / det), j: Math.round((-c * dx + a * dy) / det) };
  }
  function nearestWalk(t, x, y) {
    if (walkable(t.i, t.j)) return t;
    var best = null, bd = 1e9;
    for (var di = -14; di <= 14; di++) for (var dj = -14; dj <= 14; dj++) {
      var i = t.i + di, j = t.j + dj; if (!walkable(i, j)) continue;
      var p = scr(i, j), dd = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); if (dd < bd) { bd = dd; best = { i: i, j: j }; }
    }
    return best;
  }
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function findPath(from, goal) {
    if (goal(from.i, from.j)) return [];
    var key = function (i, j) { return i + "," + j; }, prev = {}, q = [from], head = 0; prev[key(from.i, from.j)] = null;
    while (head < q.length) {
      var c = q[head++];
      for (var k = 0; k < 8; k++) {
        var ni = c.i + DIRS[k][0], nj = c.j + DIRS[k][1];
        if (!walkable(ni, nj) || key(ni, nj) in prev) continue;
        if (k >= 4 && (!walkable(c.i + DIRS[k][0], c.j) || !walkable(c.i, c.j + DIRS[k][1]))) continue;
        prev[key(ni, nj)] = c;
        var n = { i: ni, j: nj };
        if (goal(ni, nj)) { var out = []; for (var t = n; t && prev[key(t.i, t.j)] !== null; t = prev[key(t.i, t.j)]) out.unshift(t); return out; }
        q.push(n);
      }
    }
    return [];
  }
  // melee reach: three tiles apart in a straight line, so two sprites stand at arm's length instead of inside each other
  var REACH = 3;
  function inReach(ai, aj, b) { return (ai === b.i && Math.abs(aj - b.j) === REACH) || (aj === b.j && Math.abs(ai - b.i) === REACH); }
  function canHit(e, ai, aj, b) {   // from tile (ai, aj), can officer e hit something standing on tile b?
    var w = WEAPON[e.weapon]; if (!w || !w.ranged) return inReach(ai, aj, b);
    var d = Math.max(Math.abs(ai - b.i), Math.abs(aj - b.j)); return d >= 2 && d <= (e.style === 2 ? 10 : 8);
  }

  // ---------- officers ----------
  var h2 = scr(10, 2);
  var LOOK = {
    cop1: { img: "cop1", nativeFace: -1, ax: 469 - META.cop1.x, ay: 404 - META.cop1.y, sh: META.cop1.h },
    cop2: { img: "cop2", nativeFace: 1, ax: 742 - META.cop2.x, ay: 512 - META.cop2.y, sh: META.cop2.h }
  };
  // slot 0 is the officer mid-stride, slot 1 the one at the bar, exactly as in the frame; the rest fill the patio
  var SPAWNS = [[0, 0], [10, 2], [-6, -4], [4, -6], [-10, 2], [2, 6], [-3, 8], [6, 8], [-12, -2], [-8, 6], [-2, -8], [8, -4], [-14, 4], [0, 10], [5, 4], [-6, 2], [-5, 10], [-9, -6], [3, -3], [-13, 0], [7, 3], [-1, 5], [-7, 9], [1, -6]];
  function spawnOf(slot) {
    var s = SPAWNS[slot % SPAWNS.length], p = scr(s[0], s[1]), t = nearestWalk({ i: s[0], j: s[1] }, p.x, p.y);
    return { tile: t, look: slot % 2 ? "cop2" : "cop1", off: slot === 1 ? { x: 742 - h2.x, y: 512 - h2.y } : { x: 0, y: 0 } };
  }
  function applyLook(e, look) { var L = LOOK[look]; e.look = look; e.img = L.img; e.nativeFace = L.nativeFace; e.ax = L.ax; e.ay = L.ay; e.sh = L.sh; }
  function placeAt(e, slot) {
    var s = spawnOf(slot); e.slot = slot; applyLook(e, s.look); e.home = { i: s.tile.i, j: s.tile.j }; e.homeOff = s.off;
    e.tile = { i: s.tile.i, j: s.tile.j }; e.off = { x: s.off.x, y: s.off.y }; e.offGoal = { x: s.off.x, y: s.off.y }; e.face = e.nativeFace; e.path = []; e.steps = []; e.from = scr(e.tile.i, e.tile.j);
  }
  function baseEnt(o) { o.path = []; o.steps = []; o.target = null; o.dead = false; o.splats = []; o.lastCombat = -1e9; o.say = null; o.anim = null; o.fx = null; o.respawn = 0; o.max = 99; o.hp = 99; o.prayers = o.prayers || { melee: false, piety: false }; return o; }
  var you = baseEnt({ id: "you", name: "Unit 1", spec: 100, pray: 99, runE: 100, run: false, cd: 0, weapon: "whip", style: 0, autoRet: true, specOn: false });
  var npc = baseEnt({ id: "npc", name: "Officer", level: 126, spec: 100, cd: 0, food: 3, gone: false });
  placeAt(you, 0); placeAt(npc, 1);
  var others = {};   // other players, by their id
  function ents() { var a = [you]; if (!npc.gone) a.push(npc); for (var k in others) a.push(others[k]); return a; }
  var kills = 0, deaths = 0, quest = 0, ground = [], gidN = 0, dest = null, cross = null;

  var ITEMS = {
    whip: { name: "Abyssal whip", act: "Wield", ex: "A weapon from the Abyss. Department issue, apparently." },
    dds: { name: "Dragon dagger(p++)", act: "Wield", ex: "A powerful dagger, coated in something the lab would like a word about." },
    acb: { name: "Armadyl crossbow", act: "Wield", ex: "Built for Armadyl's forces. Logged as evidence, then signed back out." },
    bolts: { name: "Dragon bolts", ex: "Sharp. There always seem to be more." },
    donut: { name: "Donut", act: "Eat", ex: "It heals 20. It was on the bar." },
    coffee: { name: "Coffee", act: "Drink", ex: "Black. Restores run energy and some special attack." },
    cuffs: { name: "Handcuffs", act: "Use", ex: "Standard issue.", msg: "He's not under arrest. Yet." },
    radio: { name: "Police radio", act: "Use", ex: "It crackles.", msg: "Static. Then: \"...be advised, news helicopter overhead.\"" },
    ticket: { name: "Ticket book", act: "Read", ex: "One page left.", msg: "The last ticket reads: Loitering near a pool." },
    bones: { name: "Bones", act: "Bury", ex: "Bones are for burying." },
    cap: { name: "Patrol cap", ex: "Keeps the sun off." }, badge: { name: "Badge", ex: "Shiny." }, shirt: { name: "Uniform shirt", ex: "Navy. Pressed." },
    trousers: { name: "Uniform trousers", ex: "Navy. Also pressed." }, boots: { name: "Duty boots", ex: "Polished this morning." }
  };
  var inv = ["dds", "acb", "coffee", "coffee", "cuffs", "radio", "ticket", "donut", "donut", "donut", "donut", "donut", "donut", "donut", "donut", "donut", "donut"];
  while (inv.length < 28) inv.push(null);
  var WEAPON = {
    whip: { name: "Abyssal whip", acc: 0.75, max: 30, styles: ["Flick", "Lash", "Deflect"], spec: false },
    dds: { name: "Dragon dagger(p++)", acc: 0.70, max: 26, styles: ["Stab", "Lunge", "Slash", "Block"], spec: true, cost: 25 },
    // ranged: 8 tiles (10 on Longrange), 6 ticks (5 on Rapid); Armadyl Eye costs 50% and doubles accuracy for one shot
    acb: { name: "Armadyl crossbow", acc: 0.62, max: 34, styles: ["Accurate", "Rapid", "Longrange"], spec: true, cost: 50, ranged: true },
    none: { name: "Unarmed", acc: 0.60, max: 9, styles: ["Punch", "Kick", "Block"], spec: false }
  };

  // ---------- sound (tiny synth, no files) ----------
  var ac = null;
  function tone(freq, dur, type, vol, slide) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = type || "square"; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur);
    } catch (e) {}
  }
  var snd = {
    hit: function () { tone(140, 0.12, "sawtooth", 0.06, 60); }, miss: function () { tone(300, 0.06, "triangle", 0.03, 200); },
    spec: function () { tone(880, 0.09, "square", 0.05, 1500); setTimeout(function () { tone(990, 0.12, "square", 0.05, 1700); }, 130); },
    bolt: function () { tone(420, 0.05, "square", 0.03, 180); },
    eye: function () { tone(1500, 0.22, "sawtooth", 0.03, 2700); setTimeout(function () { tone(2100, 0.2, "sawtooth", 0.025, 1300); }, 90); },
    eat: function () { tone(220, 0.08, "triangle", 0.05, 160); }, die: function () { tone(400, 0.7, "sawtooth", 0.05, 60); }, click: function () { tone(700, 0.03, "square", 0.02); }
  };

  // ---------- the Afton clause: any officer with that name in theirs sets it off for the whole patio ----------
  var screamed = {}, screamUntil = 0, scareImg = new Image(); scareImg.src = "/halloween/img/goldenfreddy.png";
  function checkAfton(key, name) { if (/afton/i.test(name || "") && started) { var k = key + "|" + name.toLowerCase(); if (!screamed[k]) { screamed[k] = 1; screamer(); } } }
  function screamer() {
    var c = $("scream"), g = c.getContext("2d"), t0 = performance.now(), dur = 1300; if (t0 < screamUntil) return; screamUntil = t0 + dur; c.hidden = false;
    try {   // a harsh synthesized shriek: detuned saws plus noise
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); var t = ac.currentTime, out = ac.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.09, t + 0.03); out.gain.setValueAtTime(0.09, t + 1.0); out.gain.exponentialRampToValueAtTime(0.0001, t + 1.3); out.connect(ac.destination);
      [520, 547, 780, 1130].forEach(function (f) { var o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 1.35, t + 0.25); o.frequency.linearRampToValueAtTime(f * 0.9, t + 1.3); var l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 23 + f % 9; lg.gain.value = 60; l.connect(lg); lg.connect(o.frequency); o.connect(out); o.start(t); l.start(t); o.stop(t + 1.3); l.stop(t + 1.3); });
      var buf = ac.createBuffer(1, ac.sampleRate * 1.3, ac.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.7; var n = ac.createBufferSource(), bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.7; n.buffer = buf; n.connect(bp); bp.connect(out); n.start(t);
    } catch (e) {}
    function face(now) {
      var f = Math.min(1, (now - t0) / dur), z = 0.55 + Math.min(1, f * 3.2) * 0.75 + Math.sin(now / 23) * 0.03, sx = (Math.random() - 0.5) * 46, sy = (Math.random() - 0.5) * 34;
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = Math.random() < 0.12 ? "#2a0000" : "#000"; g.fillRect(0, 0, W, H);
      if (scareImg.complete && scareImg.naturalWidth) {   // the same face the halloween wheel uses, jolting at the screen
        var ih = H * (0.75 + Math.min(1, f * 3.2) * 0.55), iw = ih * scareImg.naturalWidth / scareImg.naturalHeight;
        g.drawImage(scareImg, W / 2 - iw / 2 + sx, H / 2 - ih / 2 + sy, iw, ih);
        g.fillStyle = "rgba(255,255,255," + (Math.random() * 0.08) + ")"; for (var r0 = 0; r0 < 14; r0++) g.fillRect(0, Math.random() * H, W, 2 + Math.random() * 5);
        if (f < 1) requestAnimationFrame(face); else { c.hidden = true; g.clearRect(0, 0, W, H); }
        return;
      }
      g.setTransform(z, 0, 0, z, W / 2 + sx, H / 2 + 30 + sy);
      var fur = "#6b4a22", dark = "#3b2810";
      g.fillStyle = dark; g.beginPath(); g.arc(-215, -215, 78, 0, 6.3); g.arc(215, -215, 78, 0, 6.3); g.fill();          // ears
      g.fillStyle = fur; g.beginPath(); g.arc(-215, -215, 46, 0, 6.3); g.arc(215, -215, 46, 0, 6.3); g.fill();
      g.fillStyle = fur; g.beginPath(); g.ellipse(0, -60, 275, 235, 0, 0, 6.3); g.fill();                                // head
      g.fillStyle = "#0b0b0b"; g.fillRect(-150, -372, 300, 26); g.fillRect(-105, -470, 210, 110);                        // top hat
      g.fillStyle = "#000"; g.beginPath(); g.ellipse(-112, -112, 74, 82, 0, 0, 6.3); g.ellipse(112, -112, 74, 82, 0, 0, 6.3); g.fill();   // sockets
      g.fillStyle = "#fff"; g.shadowColor = "#fff"; g.shadowBlur = 40; g.beginPath(); g.arc(-112 + sx * 0.2, -112, 13, 0, 6.3); g.arc(112 + sx * 0.2, -112, 13, 0, 6.3); g.fill(); g.shadowBlur = 0;
      g.strokeStyle = dark; g.lineWidth = 16; g.lineCap = "round"; g.beginPath(); g.moveTo(-200, -215); g.lineTo(-60, -190); g.moveTo(200, -215); g.lineTo(60, -190); g.stroke();   // brow
      g.fillStyle = "#8a6a3c"; g.beginPath(); g.ellipse(0, 10, 150, 90, 0, 0, 6.3); g.fill();                             // muzzle
      g.fillStyle = "#111"; g.beginPath(); g.ellipse(0, -30, 40, 26, 0, 0, 6.3); g.fill();                                // nose
      var jaw = 70 + Math.min(1, f * 4) * 150 + Math.sin(now / 31) * 14;
      g.fillStyle = "#050000"; g.beginPath(); g.ellipse(0, 70 + jaw / 2, 170, jaw / 2 + 18, 0, 0, 6.3); g.fill();         // mouth
      g.fillStyle = "#3a3a3a"; for (var k2 = -3; k2 <= 3; k2++) g.fillRect(k2 * 30 - 9, 92 + jaw * 0.3, 18, 30);          // inner teeth
      g.fillStyle = "#efe9d2"; for (var k = -4; k <= 4; k++) { g.fillRect(k * 36 - 14, 60, 28, 40); }                     // upper teeth
      g.fillStyle = fur; g.beginPath(); g.ellipse(0, 110 + jaw, 190, 62, 0, 0, 6.3); g.fill();                            // lower jaw
      g.fillStyle = "#efe9d2"; for (var q = -4; q <= 4; q++) { g.fillRect(q * 36 - 14, 62 + jaw, 28, 38); }               // lower teeth
      g.fillStyle = "#0b0b0b"; g.beginPath(); g.moveTo(-70, 215 + jaw); g.lineTo(0, 190 + jaw); g.lineTo(70, 215 + jaw); g.lineTo(70, 250 + jaw); g.lineTo(0, 225 + jaw); g.lineTo(-70, 250 + jaw); g.closePath(); g.fill();   // bow tie
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "rgba(255,255,255," + (Math.random() * 0.08) + ")"; for (var r = 0; r < 14; r++) g.fillRect(0, Math.random() * H, W, 2 + Math.random() * 5);   // static
      if (f < 1) requestAnimationFrame(face); else { c.hidden = true; g.clearRect(0, 0, W, H); }
    }
    face(t0); var guard = setInterval(function () { if (performance.now() - t0 >= dur) { clearInterval(guard); c.hidden = true; } else face(performance.now()); }, 60);
  }

  // ---------- chat ----------
  var log = [], filter = "all", typed = "", naming = false;
  function setName(n) {
    n = String(n).replace(/[<>&"]/g, "").trim().slice(0, 16); if (!n) return;
    you.name = n; try { localStorage.setItem("patio-name", n); } catch (e) {} msg("You are now known as " + esc(n) + ".", ""); sendState(); drawChat(); checkAfton("me", n);
  }
  function askName() { naming = true; typed = ""; msg("What is your officer's name? Type it and press Enter.", "blue"); drawChat(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function msg(html, cls, kind) { log.push({ h: html, c: cls || "", k: kind || "game" }); if (log.length > 200) log.shift(); drawChat(); }
  function drawChat() {
    var rows = log.filter(function (m) { return filter === "all" || m.k === filter; }).slice(-8);
    $("chatlog").innerHTML = rows.map(function (m) { return '<div class="' + m.c + '">' + m.h + "</div>"; }).join("");
    $("typed").textContent = typed; var nm = document.querySelector("#chatin .nm"); if (nm) nm.textContent = naming ? "Enter name:" : you.name + ":";
  }
  function say(e, text, ms) { e.say = { t: text, until: performance.now() + (ms || 3500) }; }
  function chatSend(text) {
    var m = /^::name\s+(.+)$/i.exec(text);
    if (m) { setName(m[1]); return; }
    say(you, text); msg("<b>" + esc(you.name) + ":</b> <span>" + esc(text) + "</span>", "pub", "public"); send({ t: "chat", n: you.name, x: text });
  }

  // ---------- combat ----------
  function rnd(n) { return Math.floor(Math.random() * (n + 1)); }
  function splat(e, v) { e.splats.push({ v: v, t: performance.now() }); e.lastCombat = performance.now(); }
  function faceTo(e, t) { var a = scr(e.tile.i, e.tile.j), b = scr(t.tile.i, t.tile.j); if (Math.abs(b.x - a.x) > 1) e.face = b.x > a.x ? 1 : -1; }
  function lunge(e, t) { var a = scr(e.tile.i, e.tile.j), b = scr(t.tile.i, t.tile.j), d = Math.hypot(b.x - a.x, b.y - a.y) || 1; e.anim = { t: performance.now(), dx: (b.x - a.x) / d, dy: (b.y - a.y) / d }; }
  function xpDrop(n) { if (!n) return; var d = document.createElement("div"); d.textContent = "+" + n * 4 + " xp"; $("xpdrops").appendChild(d); setTimeout(function () { d.remove(); }, 1700); }
  function hurt(target, dmg, by) {   // damage to something this client owns: yourself, or the NPC
    dmg = Math.min(dmg, target.hp); target.hp -= dmg; splat(target, dmg); by.lastCombat = performance.now();
    if (dmg) snd.hit(); else snd.miss();
    if (target.hp <= 0) die(target, by);
    return dmg;
  }
  function attackYou() {
    var w = WEAPON[you.weapon], piety = you.prayers.piety && !w.ranged, t = you.target, rolls = [], kind = you.weapon; faceTo(you, t);
    if (w.ranged) { you.cd = you.style === 1 ? 5 : 6; snd.bolt(); } else { lunge(you, t); you.cd = 4; }
    if (quest === 0) quest = 1;
    if (you.specOn && w.spec && you.spec >= w.cost) {
      you.spec -= w.cost; you.specOn = false;
      if (w.ranged) { kind = "acbspec"; snd.eye(); rolls.push(Math.random() < Math.min(0.98, (w.acc + (you.style === 0 ? 0.05 : 0)) * 2) ? 1 + rnd(w.max - 1) : 0); }
      else { snd.spec(); kind = "dds"; for (var k = 0; k < 2; k++) rolls.push(Math.random() < (piety ? 0.93 : 0.88) ? 4 + rnd((piety ? 38 : 32) - 4) : 0); }
    } else { you.specOn = false; rolls.push(Math.random() < w.acc + (piety ? 0.07 : 0) + (w.ranged && you.style === 0 ? 0.05 : 0) ? rnd(Math.round(w.max * (piety ? 1.2 : 1))) : 0); }
    you.fx = { t: performance.now(), kind: kind };
    if (t.remote) {
      // another player: they keep their own hitpoints, so tell them what landed
      if (t.prayers.melee && !w.ranged) rolls = rolls.map(function (d) { return Math.floor(d * 0.6); });
      rolls.forEach(function (d) { splat(t, d); t.hp = Math.max(0, t.hp - d); xpDrop(d); if (d) snd.hit(); else snd.miss(); });
      you.lastCombat = performance.now(); send({ t: "hit", to: t.uid, d: rolls, k: kind });
    } else {
      rolls.forEach(function (d) { if (!t.dead) xpDrop(hurt(t, d, you)); });
      if (!t.dead && !t.target) { t.target = you; say(t, ["Hey!", "Stop resisting!", "10-33! Officer needs assistance!", "On camera? Really?"][rnd(3)]); }
    }
  }
  function attackNpc() {
    var t = you; faceTo(npc, t); lunge(npc, t); npc.cd = 4; npc.fx = { t: performance.now(), kind: "whip" };
    var block = you.prayers.melee;
    if (npc.spec >= 50 && you.hp <= 40 && Math.random() < 0.6) {
      npc.spec -= 50; snd.spec(); say(npc, "Taser! Taser! Taser!"); npc.fx.kind = "dds";
      for (var k = 0; k < 2 && !t.dead; k++) hurt(t, block ? 0 : (Math.random() < 0.8 ? 3 + rnd(21) : 0), npc);
    } else hurt(t, block ? 0 : (Math.random() < 0.6 ? rnd(26) : 0), npc);
    if (!t.dead && you.autoRet && !you.target && !you.path.length) you.target = npc;
  }
  function die(e, by) {
    e.dead = true; e.deadAt = performance.now(); e.target = null; e.path = []; if (by.target === e) by.target = null; snd.die();
    if (e === you) {
      deaths++; you.respawn = 6; msg("Oh dear, you are dead!", "red"); you.specOn = false; you.prayers.melee = you.prayers.piety = false; cancelTrade(true);
      if (by === npc) say(npc, "Suspect is down."); else send({ t: "die", by: by.uid });
      addGround("bones", you.tile.i, you.tile.j); sendState();
    } else {
      kills++; npc.respawn = 12; msg("You have defeated the Officer.", "");
      if (quest < 2) { quest = 2; msg("Congratulations! Quest complete: Patio Showdown.", "blue"); }
      addGround("bones", npc.tile.i, npc.tile.j); addGround("donut", npc.tile.i, npc.tile.j);
    }
  }
  function respawn(e) {
    var slot = e.slot; placeAt(e, slot); e.dead = false; e.hp = e.max; e.spec = 100; e.cd = 0; e.target = null; e.splats = []; e.lastCombat = -1e9;
    if (e === you) { you.pray = 99; you.runE = 100; msg("You wake up back where you came in.", ""); sendState(); } else { npc.food = 3; }
  }
  function addGround(id, i, j, gid) { var g = { id: id, i: i, j: j, gid: gid || uid + ":" + (++gidN) }; ground.push(g); if (!gid) send({ t: "gadd", g: g }); return g; }
  function delGround(g, quiet) { var k = ground.indexOf(g); if (k >= 0) ground.splice(k, 1); if (!quiet) send({ t: "gdel", gid: g.gid }); }

  // ---------- one game tick ----------
  function stepEnt(e) {
    e.steps = []; e.from = scr(e.tile.i, e.tile.j); e.stepT = tickStart;
    if (e.dead) return false;
    var t = e.target;
    if (t && (t.dead || (t.remote && !others[t.uid]))) { e.target = t = null; }
    if (t) { if (!canHit(e, e.tile.i, e.tile.j, t.tile)) e.path = findPath(e.tile, function (i, j) { return canHit(e, i, j, t.tile); }); else e.path = []; }
    var n = e.run ? 2 : 1, moved = false;
    while (n-- > 0 && e.path.length) {
      var nx = e.path.shift(), a = scr(e.tile.i, e.tile.j), b = scr(nx.i, nx.j);
      if (Math.abs(b.x - a.x) > 1) e.face = b.x > a.x ? 1 : -1;
      e.tile = nx; e.steps.push(b); moved = true;
    }
    if (moved) e.offGoal = { x: 0, y: 0 };
    return moved;
  }
  function tick() {
    tickN++;
    if (tickN % 8 === 0) { you.spec = Math.min(100, you.spec + 5); npc.spec = Math.min(100, npc.spec + 5); }
    if (tickN % 20 === 0) { [you, npc].forEach(function (e) { if (!e.dead && e.hp < e.max) e.hp++; }); }
    var np = (you.prayers.melee ? 1 : 0) + (you.prayers.piety ? 1 : 0);
    if (np) { you.pray -= np * 0.75; if (you.pray <= 0) { you.pray = 0; you.prayers.melee = you.prayers.piety = false; msg("You have run out of Prayer points.", ""); } }
    [you, npc].forEach(function (e) { if (e.cd > 0) e.cd--; if (e.dead && !(e === npc && npc.gone) && --e.respawn <= 0) respawn(e); });

    // alone on the patio, the other officer is the computer: fights when attacked, eats when hurt, goes back to his spot after
    if (!npc.gone && !npc.dead) {
      if (npc.target && npc.hp <= 35 && npc.food > 0 && Math.random() < 0.7) { npc.food--; npc.hp = Math.min(npc.max, npc.hp + 20); npc.cd = Math.max(npc.cd, 2); msg("The Officer eats a donut.", ""); snd.eat(); }
      if (!npc.target) {
        if (npc.tile.i !== npc.home.i || npc.tile.j !== npc.home.j) { if (!npc.path.length) npc.path = findPath(npc.tile, function (i, j) { return i === npc.home.i && j === npc.home.j; }); }
        else { npc.offGoal = { x: npc.homeOff.x, y: npc.homeOff.y }; npc.face = npc.nativeFace; }
      }
    }
    var moved = stepEnt(you); if (!npc.gone) stepEnt(npc);
    if (you.run && moved) { you.runE -= 1.6; if (you.runE <= 0) { you.runE = 0; you.run = false; } } else you.runE = Math.min(100, you.runE + 0.5);
    if (dest && !you.path.length) dest = null;

    if (!you.dead && you.target && !you.target.dead && canHit(you, you.tile.i, you.tile.j, you.target.tile) && you.cd <= 0) attackYou();
    if (!npc.gone && !npc.dead && npc.target && !npc.target.dead && inReach(npc.tile.i, npc.tile.j, npc.target.tile) && npc.cd <= 0) attackNpc();
    if (you.pendingTake) tryTake();
    var now = performance.now(); for (var k in others) if (now - others[k].seen > 6000) dropOther(k);
    if (online && !isHost && now - lastHost > 7000) lostHost();                      // the host went quiet: someone has to take over the room
    if (isHost) for (var q in conns) if (now - conns[q].seen > 9000) { var gone = conns[q]; delete conns[q]; try { gone.c.close(); } catch (e) {} var lv = { t: "leave", id: "host", who: gone.uid }; for (var q2 in conns) { try { conns[q2].c.send(lv); } catch (e) {} } handle(lv); }
    sendState(); refresh();
  }

  // ---------- things you can do ----------
  function walkTo(x, y) {
    if (you.dead) return;
    var t = nearestWalk(tileAt(x, y), x, y); if (!t) return;
    you.target = null; you.pendingTake = null; you.path = findPath(you.tile, function (i, j) { return i === t.i && j === t.j; }); dest = t;
  }
  function attack(t) { t = t || npc; if (you.dead || t.dead || (t === npc && npc.gone)) return; you.target = t; you.pendingTake = null; dest = null; }
  function tryTake() {
    var g = you.pendingTake; if (!g || ground.indexOf(g) < 0) { you.pendingTake = null; return; }
    if (you.tile.i === g.i && you.tile.j === g.j) {
      var slot = inv.indexOf(null); if (slot < 0) msg("You don't have enough inventory space.", ""); else { inv[slot] = g.id; delGround(g); }
      you.pendingTake = null;
    }
  }
  function take(g) { if (you.dead) return; you.target = null; you.pendingTake = g; you.path = findPath(you.tile, function (i, j) { return i === g.i && j === g.j; }); dest = { i: g.i, j: g.j }; tryTake(); }
  function useItem(slot) {
    var id = inv[slot]; if (!id || you.dead) return; var it = ITEMS[id];
    if (trade) { offer(slot); return; }
    if (id === "donut") { if (you.hp >= you.max) msg("You're not hungry. You eat it anyway.", ""); you.hp = Math.min(you.max, you.hp + 20); you.cd = Math.max(you.cd, 3); inv[slot] = null; msg("You eat the donut.", ""); snd.eat(); }
    else if (id === "coffee") { you.runE = 100; you.spec = Math.min(100, you.spec + 25); inv[slot] = null; msg("You drink the coffee. You feel a rush of energy.", ""); snd.eat(); }
    else if (id === "bones") { inv[slot] = null; msg("You dig a hole in the lawn. You bury the bones.", ""); xpDrop(1); }
    else if (WEAPON[id]) { inv[slot] = you.weapon === "none" ? null : you.weapon; you.weapon = id; you.specOn = false; you.style = 0; you.cd = Math.max(you.cd, 1); snd.click(); }
    else if (it.msg) msg(it.msg, "");
    refresh();
  }
  function dropItem(slot) { var id = inv[slot]; if (!id || trade) return; addGround(id, you.tile.i, you.tile.j); inv[slot] = null; refresh(); }
  function unequip() { if (you.weapon === "none") return; var s = inv.indexOf(null); if (s < 0) { msg("You don't have enough inventory space.", ""); return; } inv[s] = you.weapon; you.weapon = "none"; you.specOn = false; you.style = 0; refresh(); }
  function toggleSpec() {
    if (!WEAPON[you.weapon].spec) return;
    if (!you.specOn && you.spec < WEAPON[you.weapon].cost) { msg("You don't have enough special attack energy left.", ""); return; }
    you.specOn = !you.specOn; snd.click(); refresh();
  }
  function togglePrayer(p) {
    if (you.dead) return;
    if (!you.prayers[p] && you.pray <= 0) { msg("You have run out of Prayer points.", ""); return; }
    you.prayers[p] = !you.prayers[p]; snd.click(); refresh();
  }
  function homeTeleport() {
    if (you.dead) return;
    if (performance.now() - you.lastCombat < 6000) { msg("You can't teleport during combat.", ""); return; }
    you.target = null; you.path = []; you.tile = { i: you.home.i, j: you.home.j }; you.steps = []; dest = null; msg("You teleport back to where you came in.", ""); refresh();
  }

  // ---------- trading ----------
  var trade = null, wantTrade = null, askedBy = {};
  function tradeWith(e) {
    if (trade || you.dead) return;
    if (askedBy[e.uid] && performance.now() - askedBy[e.uid] < 30000) { delete askedBy[e.uid]; send({ t: "tacc", to: e.uid }); openTrade(e); return; }
    wantTrade = e.uid; send({ t: "treq", to: e.uid }); msg("Sending trade offer...", "");
  }
  function openTrade(e) { trade = { uid: e.uid, name: e.name, mine: [], theirs: [], myOk: false, theirOk: false, stage: 1 }; wantTrade = null; tab = "inv"; you.target = null; you.path = []; drawTrade(); refresh(); }
  function offer(slot) { if (!trade || trade.stage !== 1) return; var k = trade.mine.indexOf(slot); if (k >= 0) trade.mine.splice(k, 1); else trade.mine.push(slot); trade.myOk = trade.theirOk = false; send({ t: "toff", to: trade.uid, items: trade.mine.map(function (s) { return inv[s]; }) }); snd.click(); drawTrade(); refresh(); }
  function tradeAccept() {
    if (!trade) return;
    var free = inv.filter(function (x) { return x === null; }).length + trade.mine.length;
    if (free < trade.theirs.length) { msg("You don't have enough inventory space for this trade.", ""); return; }
    trade.myOk = true; send({ t: "tok", to: trade.uid, stage: trade.stage }); tradeAdvance();
  }
  function tradeAdvance() {
    if (trade && trade.myOk && trade.theirOk) {
      if (trade.stage === 1) { trade.stage = 2; trade.myOk = trade.theirOk = false; }
      else { trade.mine.forEach(function (s) { inv[s] = null; }); trade.theirs.forEach(function (id) { var s = inv.indexOf(null); if (s >= 0) inv[s] = id; }); trade = null; msg("Accepted trade.", ""); }
    }
    drawTrade(); refresh();
  }
  function cancelTrade(tell) { if (!trade) return; if (tell) send({ t: "tcan", to: trade.uid }); trade = null; drawTrade(); refresh(); }
  function drawTrade() {
    var w = $("trade"); if (!trade) { w.hidden = true; return; } w.hidden = false;
    $("trade-title").textContent = (trade.stage === 1 ? "Trading With: " : "Are you sure you want to make this trade? ") + (trade.stage === 1 ? trade.name : "");
    $("trade-their-h").textContent = trade.name + "'s Offer";
    var cell = function (id, k) { return "<div" + (k !== undefined ? ' data-s="' + k + '"' : "") + ' title="' + ITEMS[id].name + '">' + IC[id] + "</div>"; };
    var mine = $("trade-mine"), theirs = $("trade-theirs");
    if (trade.stage === 1) {
      mine.className = theirs.className = "tg";
      mine.innerHTML = trade.mine.map(function (s) { return cell(inv[s], s); }).join(""); theirs.innerHTML = trade.theirs.map(function (id) { return cell(id); }).join("");
    } else {
      mine.className = theirs.className = "tg list";
      mine.innerHTML = trade.mine.length ? trade.mine.map(function (s) { return "<div>" + ITEMS[inv[s]].name + "</div>"; }).join("") : "<div>Absolutely nothing!</div>";
      theirs.innerHTML = trade.theirs.length ? trade.theirs.map(function (id) { return "<div>" + ITEMS[id].name + "</div>"; }).join("") : "<div>Absolutely nothing!</div>";
    }
    $("trade-status").textContent = trade.myOk ? "Waiting for other player..." : trade.theirOk ? "Other player has accepted." : trade.stage === 1 ? "Click items in your inventory to offer them." : "There is NO WAY to reverse a trade if you change your mind.";
    $("trade-ok").classList.toggle("sel", trade.myOk);
  }
  $("trade-ok").addEventListener("mousedown", tradeAccept);
  $("trade-no").addEventListener("mousedown", function () { cancelTrade(true); msg("You declined the trade.", ""); });
  $("trade-mine").addEventListener("mousedown", function (ev) { var d = ev.target.closest("[data-s]"); if (d) offer(+d.dataset.s); });
  $("chatlog").addEventListener("mousedown", function (ev) { var d = ev.target.closest("[data-trade]"); if (d && others[d.dataset.trade]) tradeWith(others[d.dataset.trade]); });

  // ---------- network: one shared room, whoever arrives first relays for everyone ----------
  var lastHost = 0;
  var uid = Math.random().toString(36).slice(2, 10), peer = null, isHost = false, hostConn = null, conns = {}, online = false, migrating = false, netTimer = null;
  function send(m) {
    m.id = uid;
    try { if (isHost) { for (var k in conns) if (conns[k].c.open) conns[k].c.send(m); } else if (hostConn && hostConn.open) hostConn.send(m); } catch (e) {}
  }
  function sendState() {
    if (!online) return;
    send({ t: "st", n: you.name, s: you.slot, i: you.tile.i, j: you.tile.j, hp: Math.max(0, you.hp), f: you.face, w: you.weapon, pm: you.prayers.melee ? 1 : 0, d: you.dead ? 1 : 0, ox: Math.round(you.offGoal.x * 10) / 10, oy: Math.round(you.offGoal.y * 10) / 10 });
  }
  function count() { return 1 + Object.keys(others).length; }
  function syncNpc() {
    var alone = Object.keys(others).length === 0;
    if (!alone && !npc.gone) { npc.gone = true; npc.target = null; if (you.target === npc) you.target = null; }
    else if (alone && (npc.gone || npc.slot === you.slot)) { npc.gone = false; placeAt(npc, you.slot === 1 ? 0 : 1); npc.dead = false; npc.hp = npc.max; npc.food = 3; npc.target = null; npc.splats = []; npc.lastCombat = -1e9; }
  }
  function setSlot(slot) {
    if (slot !== you.slot) { placeAt(you, slot); you.target = null; dest = null; }
    if (!/\S/.test(localName())) you.name = "Unit " + (slot + 1);
    syncNpc(); drawChat(); refresh();
  }
  function localName() { try { return localStorage.getItem("patio-name") || ""; } catch (e) { return ""; } }
  function dropOther(k, quiet) {
    var e = others[k]; if (!e) return; delete others[k];
    if (you.target === e) you.target = null; if (trade && trade.uid === k) { trade = null; drawTrade(); msg("Other player left. Trade cancelled.", ""); }
    if (!quiet) msg(esc(e.name) + " has left the patio.", ""); syncNpc(); refresh();
  }
  function otherFor(m) {
    var e = others[m.id];
    if (!e) {
      e = others[m.id] = baseEnt({ remote: true, uid: m.id, name: m.n || "Officer", level: 126 }); placeAt(e, m.s || 0); e.tile = { i: m.i, j: m.j }; e.from = scr(m.i, m.j);
      msg(esc(e.name) + " has entered the patio.", ""); syncNpc();
    }
    return e;
  }
  function handle(m) {
    if (!m || m.id === uid) return;
    var now = performance.now(), e, t;
    if (m.t === "st") {
      e = otherFor(m); e.seen = now; e.name = m.n || e.name; checkAfton(m.id, e.name);
      if (m.s !== e.slot) { e.slot = m.s; applyLook(e, m.s % 2 ? "cop2" : "cop1"); }
      if (m.i !== e.tile.i || m.j !== e.tile.j) {
        var cur = entPos(e, now), nx = scr(m.i, m.j), far = Math.abs(m.i - e.tile.i) + Math.abs(m.j - e.tile.j) > 5;
        e.from = far ? nx : { x: cur.x - e.off.x, y: cur.y - e.off.y }; e.steps = far ? [] : [nx]; e.stepT = now; e.tile = { i: m.i, j: m.j };
      }
      e.face = m.f; e.weapon = m.w; e.prayers.melee = !!m.pm; e.offGoal = { x: m.ox || 0, y: m.oy || 0 }; e.hp = m.hp;
      if (m.d && !e.dead) { e.dead = true; e.deadAt = now; } else if (!m.d && e.dead) { e.dead = false; e.steps = []; e.splats = []; e.lastCombat = -1e9; }
    } else if (m.t === "chat") { e = others[m.id]; if (e) say(e, m.x); msg("<b>" + esc(m.n) + ":</b> <span>" + esc(m.x) + "</span>", "pub", "public"); }
    else if (m.t === "hit") {
      e = others[m.id]; t = m.to === uid ? you : others[m.to]; if (!e || !t) return;
      var shot = m.k === "acb" || m.k === "acbspec"; faceTo(e, t); if (!shot) lunge(e, t); e.fx = { t: now, kind: m.k }; e.target = t; e.lastCombat = now; if (m.k === "dds") snd.spec(); else if (m.k === "acbspec") snd.eye(); else if (shot) snd.bolt();
      m.d.forEach(function (d) { if (t === you) { if (!you.dead) hurt(you, d, e); } else { splat(t, d); t.hp = Math.max(0, t.hp - d); } });
      if (t === you && !you.dead && you.autoRet && !you.target && !you.path.length && !trade) you.target = e;
    } else if (m.t === "die") { e = others[m.id]; if (e) { if (!e.dead) { e.dead = true; e.deadAt = now; } if (you.target === e) you.target = null; if (m.by === uid) { kills++; msg("You have defeated " + esc(e.name) + ".", ""); if (quest < 2) { quest = 2; msg("Congratulations! Quest complete: Patio Showdown.", "blue"); } } } }
    else if (m.t === "gadd") { if (!ground.some(function (g) { return g.gid === m.g.gid; })) addGround(m.g.id, m.g.i, m.g.j, m.g.gid); }
    else if (m.t === "gdel") { ground.filter(function (g) { return g.gid === m.gid; }).forEach(function (g) { delGround(g, true); }); }
    else if (m.t === "leave") dropOther(m.who);
    else if (m.to === uid) {
      e = others[m.id]; if (!e) return;
      if (m.t === "treq") { if (trade) return; if (wantTrade === m.id) { send({ t: "tacc", to: m.id }); openTrade(e); } else { askedBy[m.id] = now; msg('<span class="tr" data-trade="' + m.id + '">' + esc(e.name) + " wishes to trade with you.</span>", ""); } }
      else if (m.t === "tacc") { if (!trade) openTrade(e); }
      else if (trade && trade.uid === m.id) {
        if (m.t === "toff") { trade.theirs = (m.items || []).filter(function (id) { return ITEMS[id]; }).slice(0, 28); trade.myOk = trade.theirOk = false; drawTrade(); }
        else if (m.t === "tok") { if (m.stage === trade.stage) { trade.theirOk = true; tradeAdvance(); } }
        else if (m.t === "tcan") { trade = null; drawTrade(); msg("Other player declined the trade.", ""); refresh(); }
      }
    }
  }
  function freeSlot(want) { var used = {}; used[you.slot] = 1; for (var k in conns) used[conns[k].slot] = 1; if (want != null && want >= 0 && want < MAXP && !used[want]) return want; for (var s = 0; s < MAXP; s++) if (!used[s]) return s; return -1; }
  function netReset() { try { if (peer) peer.destroy(); } catch (e) {} peer = null; hostConn = null; conns = {}; isHost = false; online = false; for (var k in others) dropOther(k, true); }
  function tryHost() {
    if (!window.Peer) return;
    netReset(); var p = peer = new Peer(ROOM);
    p.on("open", function () { isHost = true; online = true; migrating = false; syncNpc(); });
    p.on("connection", function (c) {
      c.on("data", function (m) {
        if (!m) return;
        if (m.t === "hello") {
          var slot = Object.keys(conns).length >= MAXP - 1 ? -1 : freeSlot(m.slot);
          if (slot < 0) { c.send({ t: "full" }); setTimeout(function () { c.close(); }, 300); return; }
          conns[c.peer] = { c: c, uid: m.id, slot: slot, seen: performance.now() }; c.send({ t: "welcome", slot: slot }); sendState();
          ground.forEach(function (g) { c.send({ t: "gadd", id: uid, g: g }); });
        } else { if (conns[c.peer]) conns[c.peer].seen = performance.now(); for (var k in conns) if (conns[k].c !== c && conns[k].c.open) { try { conns[k].c.send(m); } catch (e) {} } handle(m); }
      });
      c.on("close", function () { var k = conns[c.peer]; if (!k) return; delete conns[c.peer]; var lv = { t: "leave", id: "host", who: k.uid }; for (var q in conns) { try { conns[q].c.send(lv); } catch (e) {} } handle(lv); });
    });
    p.on("error", function (e) { if (e.type === "unavailable-id") { try { p.destroy(); } catch (x) {} tryClient(); } else if (!online) retry(); });
    p.on("disconnected", function () { try { p.reconnect(); } catch (e) {} });
  }
  function tryClient() {
    var p = peer = new Peer(), opened = false;
    p.on("open", function () {
      var c = hostConn = p.connect(ROOM, { reliable: true });
      c.on("open", function () { opened = true; online = true; migrating = false; lastHost = performance.now(); c.send({ t: "hello", id: uid, slot: you.joined ? you.slot : null }); });
      c.on("data", function (m) {
        if (!m) return;
        lastHost = performance.now();
        if (m.t === "welcome") { you.joined = true; setSlot(m.slot); sendState(); }
        else if (m.t === "full") { msg("The patio is full: 24 officers. You're on your own out here.", ""); online = false; }
        else handle(m);
      });
      c.on("close", lostHost); c.on("error", lostHost);
      setTimeout(function () { if (!opened && peer === p) lostHost(); }, 7000);
    });
    p.on("error", function () { if (peer === p) lostHost(); });
  }
  function lostHost() { if (migrating) return; migrating = true; online = false; for (var k in others) dropOther(k, true); retry(); }
  function retry() { clearTimeout(netTimer); netTimer = setTimeout(function () { migrating = false; tryHost(); }, 400 + Math.random() * 1600); }
  addEventListener("beforeunload", function () { try { if (peer) peer.destroy(); } catch (e) {} });

  // ---------- what is under the mouse ----------
  function entPos(e, now) {
    var p;
    if (e.steps.length && started) {
      var f0 = (now - (e.stepT || tickStart)) / TICK;
      if (f0 >= 1 && e.remote) { e.steps = []; p = scr(e.tile.i, e.tile.j); e.moving = false; }
      else {
        var t = Math.min(0.9999, Math.max(0, f0)) * e.steps.length, k = Math.floor(t), a = k === 0 ? e.from : e.steps[k - 1], b = e.steps[k], f = t - k;
        p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; e.moving = true;
      }
    } else { p = scr(e.tile.i, e.tile.j); e.moving = false; }
    return { x: p.x + e.off.x, y: p.y + e.off.y };
  }
  var EXAMINE = [
    { n: "Logo", t: "Channel 5. They are getting all of this.", hit: function (x, y) { return x > 1120 && x < 1266 && y > 14 && y < 200; } },
    { n: "Pool", t: "Somebody is paying a lot to heat this.", hit: function (x, y) { return x < 330 && y > 425 + x * 0.55; } },
    { n: "Sofa", t: "Outdoor sectional. It has seen nothing and will say nothing.", hit: function (x, y) { return x > 440 && x < 990 && y < 190 && !(x < 600 && y > 30 + (x - 440) * 0.6); } },
    { n: "Bar", t: "Granite. There's a bag on it that somebody found very interesting.", hit: function (x, y) { var t = tileAt(x, y); return x > 672 && x < 1100 && y > 130 && y < 548 && !walkable(t.i, t.j); } },
    { n: "Pool house", t: "Stucco. Nobody home.", hit: function (x, y) { return x > 920 && y > 150 + (1280 - x) * 0.5; } }
  ];
  function over(e, x, y, now) { var p = entPos(e, now); return x > p.x - 34 && x < p.x + 38 && y > p.y - e.sh + 8 && y < p.y + 8; }
  function under(x, y) {
    var now = performance.now(), ops = [], hit = false;
    var list = ents().filter(function (e) { return e !== you && !e.dead && over(e, x, y, now); }).sort(function (a, b) { return entPos(b, now).y - entPos(a, now).y; });
    list.forEach(function (e) {
      var nm = '<span class="y">' + esc(e.name) + '</span> <span class="y">(level-126)</span>'; hit = true;
      ops.push({ h: "Attack " + nm, f: function () { attack(e); }, red: 1 });
      if (e.remote) ops.push({ h: "Trade with " + nm, f: function () { tradeWith(e); } });
      ops.push({ h: "Examine " + nm, f: function () { msg(e.remote ? "Another officer. Says the name is " + esc(e.name) + "." : npc.target ? "He's noticed." : "A sergeant. He hasn't looked up once.", ""); } });
    });
    ground.forEach(function (g) { var q = scr(g.i, g.j); if (Math.abs(x - q.x) < 16 && Math.abs(y - q.y) < 12) { hit = true; ops.push({ h: 'Take <span class="o">' + ITEMS[g.id].name + "</span>", f: function () { take(g); }, red: 1 }); ops.push({ h: 'Examine <span class="o">' + ITEMS[g.id].name + "</span>", f: function () { msg(ITEMS[g.id].ex, ""); } }); } });
    var walk = { h: "Walk here", f: function () { walkTo(x, y); } };
    if (hit) ops.splice(1, 0, walk); else ops.unshift(walk);
    if (!you.dead && over(you, x, y, now)) ops.push({ h: 'Rename <span class="y">' + esc(you.name) + "</span>", f: askName });
    for (var k = 0; k < EXAMINE.length; k++) if (EXAMINE[k].hit(x, y)) { (function (e) { ops.push({ h: 'Examine <span class="c">' + e.n + "</span>", f: function () { msg(e.t, ""); } }); })(EXAMINE[k]); break; }
    return ops;
  }
  function hoverText(ops) { $("hover").innerHTML = ops.length ? ops[0].h + (ops.length > 1 ? " / " + (ops.length - 1) + " more option" + (ops.length > 2 ? "s" : "") : "") : ""; }

  // ---------- input ----------
  function local(ev) { var r = stage.getBoundingClientRect(); return { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale }; }
  function closeCtx() { $("ctx").hidden = true; }
  function openCtx(x, y, ops) {
    var c = $("ctx"); c.innerHTML = '<div class="hd">Choose Option</div>' + ops.map(function (o, k) { return '<div class="op" data-k="' + k + '">' + o.h + "</div>"; }).join("") + '<div class="op" data-k="-1">Cancel</div>';
    c.hidden = false; c.style.left = Math.max(0, Math.min(x - 40, W - 230)) + "px"; c.style.top = Math.max(0, Math.min(y - 8, H - 24 - ops.length * 18 - 40)) + "px"; c._ops = ops;
  }
  $("ctx").addEventListener("mousedown", function (ev) { ev.stopPropagation(); var d = ev.target.closest(".op"); if (!d) return; var k = +d.dataset.k; var ops = $("ctx")._ops; closeCtx(); if (k >= 0) run(ops[k], $("ctx")._x, $("ctx")._y); });
  function run(op, x, y) { cross = { x: x, y: y, t: performance.now(), red: !!op.red }; op.f(); snd.click(); refresh(); }
  cv.addEventListener("mousemove", function (ev) { if (!started) return; var p = local(ev); hoverText(under(p.x, p.y)); });
  cv.addEventListener("mouseleave", function () { $("hover").innerHTML = ""; });
  cv.addEventListener("mousedown", function (ev) {
    if (!started) return; var p = local(ev), ops = under(p.x, p.y);
    if (!$("ctx").hidden) { closeCtx(); return; }
    if (ev.button === 2) { $("ctx")._x = p.x; $("ctx")._y = p.y; openCtx(p.x, p.y, ops); } else if (ev.button === 0 && ops.length) { if (trade) { cancelTrade(true); msg("You declined the trade.", ""); } run(ops[0], p.x, p.y); }
  });
  stage.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });
  $("minimap").addEventListener("mousedown", function (ev) { var r = $("minimap").getBoundingClientRect(), mx = (ev.clientX - r.left) / scale - 80, my = (ev.clientY - r.top) / scale - 80, p = entPos(you, performance.now()); walkTo(p.x + mx / MM, p.y + my / MM); cross = null; refresh(); });
  addEventListener("keydown", function (ev) {
    if (!started) { if (ev.key === " " || ev.key === "Enter") start(); return; }
    var F = { F1: "combat", F2: "skills", F3: "quests", Escape: "inv", F4: "equip", F5: "pray", F6: "magic" };
    if (F[ev.key]) { ev.preventDefault(); tab = F[ev.key]; closeCtx(); refresh(); return; }
    if (ev.key === "Enter") { if (naming) { if (typed.trim()) { naming = false; setName(typed); } } else if (typed.trim()) chatSend(typed.trim()); typed = ""; drawChat(); }
    else if (ev.key === "Backspace") { typed = typed.slice(0, -1); drawChat(); ev.preventDefault(); }
    else if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && typed.length < 80) { typed += ev.key; drawChat(); if (ev.key === " " || ev.key === "'" || ev.key === "/") ev.preventDefault(); }
  });
  $("chattabs").addEventListener("mousedown", function (ev) { var s = ev.target.closest("span[data-f]"); if (!s) return; filter = s.dataset.f; [].forEach.call($("chattabs").children, function (c) { c.classList.toggle("on", c === s); }); drawChat(); });
  $("orb-run").addEventListener("mousedown", function () { if (you.runE > 0) you.run = !you.run; refresh(); });
  $("orb-spec").addEventListener("mousedown", toggleSpec);
  $("orb-pray").addEventListener("mousedown", function () { togglePrayer("melee"); });

  // ---------- interface ----------
  function S(inner) { return '<svg viewBox="0 0 24 24">' + inner + "</svg>"; }
  var IC = {
    combat: S('<path d="M4 4l11 11M20 4L9 15" stroke="#d8d8d8" stroke-width="2.4"/><path d="M13 17l4-4 3 3-4 4zM11 17l-4-4-3 3 4 4z" fill="#8a6a3a"/>'),
    skills: S('<rect x="3" y="13" width="4" height="8" fill="#3fbf3f"/><rect x="10" y="8" width="4" height="13" fill="#ffd23f"/><rect x="17" y="3" width="4" height="18" fill="#ff5a3f"/>'),
    quests: S('<path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#3fa0ff" stroke="#0a2a55"/>'),
    inv: S('<path d="M6 8h12l2 13H4z" fill="#8a5a2a" stroke="#3a2410"/><path d="M8 8c0-6 8-6 8 0" fill="none" stroke="#3a2410" stroke-width="2"/><rect x="9" y="12" width="6" height="4" fill="#c9a25a"/>'),
    equip: S('<path d="M5 13c0-9 14-9 14 0v6h-4v-5H9v5H5z" fill="#b8b8c0" stroke="#33333a"/><rect x="11" y="4" width="2" height="6" fill="#c33"/>'),
    pray: S('<path d="M12 2l2.6 6.6L21 9l-5 4.4L17.6 20 12 16.4 6.4 20 8 13.4 3 9l6.4-.4z" fill="#fff2a8" stroke="#8a7a1a"/>'),
    magic: S('<rect x="4" y="3" width="16" height="18" rx="2" fill="#3a2a7a" stroke="#120a33"/><path d="M12 7l1.4 3.4L17 11l-2.8 2.2.9 3.6L12 15l-3.1 1.8.9-3.6L7 11l3.6-.6z" fill="#ffd23f"/>'),
    friends: S('<circle cx="12" cy="12" r="9" fill="#ffd23f" stroke="#6a5200"/><circle cx="9" cy="10" r="1.3"/><circle cx="15" cy="10" r="1.3"/><path d="M8 14c2 3 6 3 8 0" fill="none" stroke="#000" stroke-width="1.5"/>'),
    account: S('<circle cx="12" cy="8" r="4" fill="#c9a25a"/><path d="M4 21c0-8 16-8 16 0z" fill="#c9a25a"/>'),
    clan: S('<circle cx="7" cy="9" r="3" fill="#9ad"/><circle cx="17" cy="9" r="3" fill="#9ad"/><circle cx="12" cy="8" r="3.4" fill="#cde"/><path d="M3 20c0-6 18-6 18 0z" fill="#9ad"/>'),
    settings: S('<path d="M14 3a5 5 0 0 0-4 7L3 17l4 4 7-7a5 5 0 0 0 7-4l-3 2-3-3 2-3a5 5 0 0 0-3-1z" fill="#b8b8c0" stroke="#33333a"/>'),
    emotes: S('<circle cx="12" cy="5" r="3" fill="#e6d8b0"/><path d="M12 8v8M4 6l8 5 8-5M8 22l4-6 4 6" stroke="#e6d8b0" stroke-width="2.2" fill="none"/>'),
    music: S('<path d="M9 18V5l10-2v13" stroke="#e6d8b0" stroke-width="2" fill="none"/><circle cx="6.5" cy="18" r="3" fill="#e6d8b0"/><circle cx="16.5" cy="16" r="3" fill="#e6d8b0"/>'),
    logout: S('<rect x="6" y="3" width="12" height="18" fill="#7a5a34" stroke="#2a1a0a"/><circle cx="15" cy="12" r="1.3" fill="#ffd23f"/>'),
    whip: S('<path d="M5 20c0-9 5-5 7-9s-3-6 6-8" fill="none" stroke="#7a2a12" stroke-width="2.6" stroke-linecap="round"/><path d="M4 22l2-4" stroke="#caa" stroke-width="3" stroke-linecap="round"/>'),
    dds: S('<path d="M7 17L17 3l3-1-1 4L9 19z" fill="#c8242a" stroke="#4a0a0c"/><path d="M5 21l3-1-2-3z" fill="#6b4a1a"/><path d="M6 15l5 4" stroke="#caa24a" stroke-width="2"/><circle cx="17.5" cy="5.5" r="1.6" fill="#4f4"/>'),
    acb: S('<path d="M4 6c7-4 13-1 16 6" fill="none" stroke="#7a8fb8" stroke-width="2.6" stroke-linecap="round"/><path d="M4 6l16 6" stroke="#dfe6f4" stroke-width="1"/><path d="M12 4L8 21" stroke="#5a3a1a" stroke-width="3.2" stroke-linecap="round"/><path d="M11 9l5 3" stroke="#c8d4f0" stroke-width="2"/><circle cx="11.5" cy="7.5" r="1.6" fill="#ffd23f"/>'),
    bolts: S('<path d="M5 19L17 7M8 21L20 9" stroke="#a03030" stroke-width="2.2" stroke-linecap="round"/><path d="M17 7l3-3-1 4zM20 9l3-3-1 4z" fill="#e8e8e8"/><path d="M5 19l-2 2M8 21l-2 2" stroke="#ffd23f" stroke-width="2"/>'),
    donut: S('<circle cx="12" cy="12" r="8.5" fill="#d99a5a" stroke="#6a4420"/><path d="M4.5 11a7.5 7.5 0 0 1 15 0c-1.5 2-2.5-.5-4 1s-3-1-4.5 0-3-1.5-4 0-1.5 1-2.5-1z" fill="#ff7ab8"/><circle cx="12" cy="12" r="2.8" fill="#3e3529"/>'),
    coffee: S('<path d="M6 8h10v9a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" fill="#f2f2f2" stroke="#555"/><path d="M16 10h2a2 2 0 0 1 0 5h-2" fill="none" stroke="#555" stroke-width="1.6"/><rect x="7" y="9" width="8" height="2" fill="#3a2410"/><path d="M9 6c0-2 2-2 2-4M13 6c0-2 2-2 2-4" stroke="#ccc" fill="none"/>'),
    cuffs: S('<circle cx="8" cy="14" r="4.5" fill="none" stroke="#c0c0c8" stroke-width="2.2"/><circle cx="16" cy="14" r="4.5" fill="none" stroke="#c0c0c8" stroke-width="2.2"/><path d="M10 9l2-3 2 3" stroke="#c0c0c8" stroke-width="2" fill="none"/>'),
    radio: S('<rect x="7" y="8" width="10" height="13" rx="1.5" fill="#222" stroke="#000"/><rect x="9" y="10" width="6" height="4" fill="#7c7"/><path d="M9 8V2" stroke="#222" stroke-width="2"/><circle cx="12" cy="17.5" r="1.8" fill="#555"/>'),
    ticket: S('<rect x="5" y="3" width="14" height="18" fill="#f4eecf" stroke="#6a5a2a"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#6a5a2a"/>'),
    bones: S('<path d="M5 6l14 12M19 6L5 18" stroke="#eee" stroke-width="3" stroke-linecap="round"/><circle cx="5" cy="6" r="2.2" fill="#eee"/><circle cx="19" cy="18" r="2.2" fill="#eee"/><circle cx="19" cy="6" r="2.2" fill="#eee"/><circle cx="5" cy="18" r="2.2" fill="#eee"/>'),
    cap: S('<path d="M4 13c0-8 16-8 16 0z" fill="#1a2240" stroke="#000"/><path d="M3 13h18l-2 3H5z" fill="#0c1020"/><circle cx="12" cy="9.5" r="1.8" fill="#ffd23f"/>'),
    badge: S('<path d="M12 2l3 3 4-1v8c0 5-7 9-7 9s-7-4-7-9V4l4 1z" fill="#ffd23f" stroke="#6a5200"/><circle cx="12" cy="11" r="3" fill="#b8860b"/>'),
    shirt: S('<path d="M8 3l4 2 4-2 5 4-3 4-2-1.5V21H8V9.5L6 11 3 7z" fill="#1a2240" stroke="#000"/>'),
    trousers: S('<path d="M7 3h10l1 18h-5l-1-10-1 10H6z" fill="#161c36" stroke="#000"/>'),
    boots: S('<path d="M5 5h5v9l6 3v3H5zM14 5h4v8l2 2v5h-4" fill="#111" stroke="#444"/>'),
    melee: S('<circle cx="12" cy="12" r="10" fill="#f4f0d8" stroke="#8a7a1a"/><path d="M7 17L16 6l2-.5-.5 2L9 19z" fill="#888" stroke="#222"/><path d="M6 15l4 4" stroke="#6b4a1a" stroke-width="2"/>'),
    piety: S('<circle cx="12" cy="12" r="10" fill="#f4f0d8" stroke="#8a7a1a"/><path d="M12 4v16M6 9h12" stroke="#c9a21a" stroke-width="3"/>'),
    dim: S('<circle cx="12" cy="12" r="9" fill="#8a8470" stroke="#3a3628"/>'),
    home: S('<path d="M3 12l9-8 9 8v9h-6v-6H9v6H3z" fill="#7ad" stroke="#124"/>'),
    rune: S('<circle cx="12" cy="12" r="8" fill="#6a6a8a" stroke="#22223a"/><path d="M9 8l6 8M15 8l-6 8" stroke="#22223a"/>')
  };
  var TOP = ["combat", "skills", "quests", "inv", "equip", "pray", "magic"], BOT = ["friends", "account", "clan", "settings", "emotes", "music", "logout"];
  var TITLES = { combat: "Combat Options", skills: "Skills", quests: "Quest List", inv: "Inventory", equip: "Worn Equipment", pray: "Prayer", magic: "Magic", friends: "Friends List", account: "Account Management", clan: "Chat-channel", settings: "Settings", emotes: "Emotes", music: "Music Player", logout: "Logout" };
  var tab = "inv";
  function drawTabs() {
    $("tabs-top").innerHTML = TOP.map(function (t) { return '<div data-tab="' + t + '" title="' + TITLES[t] + '" class="' + (t === tab ? "sel" : "") + '">' + IC[t] + "</div>"; }).join("");
    $("tabs-bot").innerHTML = BOT.map(function (t) { return '<div class="off" title="' + TITLES[t] + '">' + IC[t] + "</div>"; }).join("");
  }
  $("tabs-top").addEventListener("mousedown", function (ev) { var d = ev.target.closest("[data-tab]"); if (d) { tab = d.dataset.tab; snd.click(); refresh(); } });
  var SKILLS = ["Attack", "Hitpoints", "Mining", "Strength", "Agility", "Smithing", "Defence", "Herblore", "Fishing", "Ranged", "Thieving", "Cooking", "Prayer", "Crafting", "Firemaking", "Magic", "Fletching", "Woodcut", "Runecraft", "Slayer", "Farming", "Construct", "Hunter"];
  var EQ = { head: [98, 0, "cap"], cape: [42, 44, null], neck: [98, 44, "badge"], ammo: [154, 44, null], weapon: [42, 88, "W"], body: [98, 88, "shirt"], shield: [154, 88, null], legs: [98, 132, "trousers"], hands: [42, 176, null], feet: [98, 176, "boots"], ring: [154, 176, null] };
  function drawPanel() {
    var w = WEAPON[you.weapon], h = "";
    if (tab === "combat") {
      h = "<h3>" + w.name + '</h3><div class="sub">Combat Lvl: 126</div><div class="grid2">' + w.styles.map(function (s, k) { return '<div class="btn ' + (k === you.style ? "sel" : "") + '" data-a="style" data-v="' + k + '">' + s + "</div>"; }).join("") + "</div>" +
        '<div class="btn ' + (you.autoRet ? "sel" : "") + '" data-a="autoret" style="margin-top:8px">Auto Retaliate<br>(' + (you.autoRet ? "On" : "Off") + ")</div>" +
        '<div id="specbar" data-a="spec" class="' + (you.specOn ? "sel " : "") + (w.spec ? "" : "off") + '"><i style="width:' + you.spec + '%"></i><span>Special Attack: ' + Math.floor(you.spec) + "%</span></div>";
    } else if (tab === "skills") {
      h = '<div class="skills">' + SKILLS.map(function (s) { return "<div>" + s + "<b>99</b></div>"; }).join("") + "<div>Total<b>2277</b></div></div>";
    } else if (tab === "quests") {
      h = '<h3>Quest List</h3><div class="sub">Quest Points: ' + (quest === 2 ? 1 : 0) + ' / 1</div><div class="quests"><div class="' + ["no", "prog", "done"][quest] + '">Patio Showdown</div></div><div class="foot">Kills: ' + kills + " &nbsp; Deaths: " + deaths + " &nbsp; Officers here: " + count() + "</div>";
    } else if (tab === "inv") {
      h = '<div class="inv">' + inv.map(function (id, k) { return '<div data-a="item" data-v="' + k + '" class="' + (trade && trade.mine.indexOf(k) >= 0 ? "offered" : "") + '" title="' + (id ? ITEMS[id].name : "") + '">' + (id ? IC[id] : "") + "</div>"; }).join("") + "</div>";
    } else if (tab === "equip") {
      h = '<div class="eq">' + Object.keys(EQ).map(function (s) { var e = EQ[s], id = s === "ammo" ? (you.weapon === "acb" ? "bolts" : null) : e[2] === "W" ? (you.weapon === "none" ? null : you.weapon) : e[2]; return '<div data-a="eq" data-v="' + s + '" style="left:' + e[0] + "px;top:" + e[1] + 'px" title="' + (id ? ITEMS[id].name : "") + '">' + (id ? IC[id] : "") + "</div>"; }).join("") + "</div>";
    } else if (tab === "pray") {
      var cells = []; for (var k = 0; k < 29; k++) cells.push(k === 16 ? '<div data-a="pray" data-v="melee" title="Protect from Melee" class="' + (you.prayers.melee ? "sel" : "") + '">' + IC.melee + "</div>" : k === 26 ? '<div data-a="pray" data-v="piety" title="Piety" class="' + (you.prayers.piety ? "sel" : "") + '">' + IC.piety + "</div>" : '<div class="off">' + IC.dim + "</div>");
      h = '<div class="pray">' + cells.join("") + '</div><div class="foot">Prayer: ' + Math.ceil(you.pray) + " / 99</div>";
    } else if (tab === "magic") {
      var m = ['<div data-a="tele" title="Home Teleport">' + IC.home + "</div>"]; for (var q = 0; q < 34; q++) m.push('<div class="off">' + IC.rune + "</div>");
      h = '<div class="mage">' + m.join("") + "</div>";
    }
    $("panel").innerHTML = h;
  }
  $("panel").addEventListener("mousedown", function (ev) {
    var d = ev.target.closest("[data-a]"); if (!d) return; var a = d.dataset.a, v = d.dataset.v; closeCtx();
    if (a === "item") {
      var id = inv[+v]; if (!id) return;
      if (ev.button === 2 && !trade) { var p = local(ev), it = ITEMS[id], nm = '<span class="o">' + it.name + "</span>"; openCtx(p.x, p.y, [{ h: it.act + " " + nm, f: function () { useItem(+v); } }, { h: "Drop " + nm, f: function () { dropItem(+v); } }, { h: "Examine " + nm, f: function () { msg(it.ex, ""); } }]); $("ctx")._x = -99; $("ctx")._y = -99; }
      else useItem(+v);
      return;
    }
    if (a === "style") you.style = +v;
    else if (a === "autoret") you.autoRet = !you.autoRet;
    else if (a === "spec") { toggleSpec(); return; }
    else if (a === "pray") { togglePrayer(v); return; }
    else if (a === "tele") { homeTeleport(); return; }
    else if (a === "eq") { if (v === "weapon") unequip(); else if (EQ[v][2]) msg("You can't take that off. This is live television.", ""); return; }
    snd.click(); refresh();
  });
  function refresh() {
    if (!started) return;
    drawTabs(); drawPanel();
    $("orb-hp").querySelector("b").textContent = Math.max(0, you.hp); $("orb-hp").querySelector("b").style.color = you.hp > 50 ? "#00ff00" : you.hp > 25 ? "#ffff00" : "#ff3030";
    $("orb-pray").querySelector("b").textContent = Math.ceil(you.pray); $("orb-pray").classList.toggle("active", you.prayers.melee || you.prayers.piety);
    $("orb-run").querySelector("b").textContent = Math.floor(you.runE); $("orb-run").classList.toggle("active", you.run);
    $("orb-spec").querySelector("b").textContent = Math.floor(you.spec); $("orb-spec").classList.toggle("active", you.specOn); $("orb-spec").classList.toggle("off", !WEAPON[you.weapon].spec);
  }

  // ---------- drawing ----------
  var MM = 0.3;
  function drawEnt(e, now) {
    var p = entPos(e, now), im = img[e.img]; if (!im.complete) return;
    e.off.x += (e.offGoal.x - e.off.x) * 0.15; e.off.y += (e.offGoal.y - e.off.y) * 0.15;
    var bob = 0, rot = 0, lx = 0, ly = 0, alpha = 1;
    if (e.moving) { var ph = now / 95; bob = -Math.abs(Math.sin(ph)) * 3; rot = Math.sin(ph) * 0.035; }
    if (e.anim) { var f = (now - e.anim.t) / 340; if (f >= 1) e.anim = null; else { var s = Math.sin(Math.PI * f) * 13; lx = e.anim.dx * s; ly = e.anim.dy * s; rot += Math.sin(Math.PI * f) * 0.12 * e.face; } }
    if (e.dead) { var df = Math.min(1, (now - e.deadAt) / 1100); rot = df * 1.45 * e.face; alpha = 1 - df * 0.85; }
    // soft cast shadow, up and to the right like the one in the frame
    cx.save(); cx.globalAlpha = 0.13 * alpha; cx.filter = "blur(7px)"; cx.fillStyle = "#000"; cx.beginPath(); cx.ellipse(p.x + 62, p.y - 66, 78, 24, -0.72, 0, 6.3); cx.fill(); cx.restore();
    cx.save(); cx.globalAlpha = alpha; cx.translate(p.x + lx, p.y + ly + bob); cx.rotate(rot); if (e.face !== e.nativeFace) cx.scale(-1, 1); cx.drawImage(im, -e.ax, -e.ay); cx.restore();
    e.scr = p;
  }
  function drawOver(e, now) {
    var p = e.scr; if (!p) return; var top = p.y - e.sh + 6;
    if (e.fx && (e.fx.kind === "acb" || e.fx.kind === "acbspec")) {
      var bf = (now - e.fx.t) / 320, bt = e.target, bq = bt && bt.scr;
      if (bf >= 1 || !bq) e.fx = null; else {
        var eye = e.fx.kind === "acbspec", x0 = p.x + e.face * 18, y0 = p.y - e.sh * 0.62, x1 = bq.x, y1 = bq.y - bt.sh * 0.55, bx = x0 + (x1 - x0) * bf, by = y0 + (y1 - y0) * bf - Math.sin(Math.PI * bf) * 14, ang = Math.atan2(y1 - y0, x1 - x0);
        cx.save(); cx.lineCap = "round";
        if (eye) { cx.strokeStyle = "rgba(140,220,255,.55)"; cx.lineWidth = 7; cx.shadowColor = "#9fe8ff"; cx.shadowBlur = 16; cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(bx, by); cx.stroke(); cx.fillStyle = "#eaffff"; cx.beginPath(); cx.arc(bx, by, 6, 0, 6.3); cx.fill(); cx.shadowBlur = 0; }
        cx.translate(bx, by); cx.rotate(ang); cx.strokeStyle = eye ? "#ffffff" : "#b8242a"; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(-14, 0); cx.lineTo(6, 0); cx.stroke(); cx.fillStyle = eye ? "#9fe8ff" : "#d8d8d8"; cx.beginPath(); cx.moveTo(10, 0); cx.lineTo(3, -4); cx.lineTo(3, 4); cx.closePath(); cx.fill(); cx.restore();
      }
    }
    if (e.fx) { var f = (now - e.fx.t) / 300; if (f >= 1) e.fx = null; else { var t = e.target, q = (t && t.scr) || p; cx.save(); cx.globalAlpha = 1 - f; cx.lineCap = "round"; if (e.fx.kind === "dds") { cx.strokeStyle = "#ff2a2a"; cx.lineWidth = 4; for (var k = 0; k < 2; k++) { cx.beginPath(); cx.moveTo(q.x - 26 + k * 16, q.y - 150 + f * 20); cx.lineTo(q.x + 6 + k * 16, q.y - 90 + f * 20); cx.stroke(); } } else { cx.strokeStyle = e.fx.kind === "whip" ? "#e8d0a0" : "#fff"; cx.lineWidth = 3; cx.beginPath(); cx.arc(q.x, q.y - 110, 34, -2.4 + f * 2, -1.2 + f * 2); cx.stroke(); } cx.restore(); } }
    if (!e.dead && now - e.lastCombat < 6000) { cx.fillStyle = "#c00000"; cx.fillRect(p.x - 20, top - 10, 40, 6); cx.fillStyle = "#00c000"; cx.fillRect(p.x - 20, top - 10, 40 * Math.max(0, e.hp) / e.max, 6); cx.strokeStyle = "#000"; cx.lineWidth = 1; cx.strokeRect(p.x - 20.5, top - 10.5, 41, 7); }
    if (!e.dead) { cx.font = "bold 11px Arial"; cx.textAlign = "center"; cx.textBaseline = "alphabetic"; cx.fillStyle = "#000"; cx.fillText(e.name, p.x + 1, top - 13); cx.fillStyle = e === you ? "#ffffff" : e.remote ? "#00ffff" : "#ffff00"; cx.fillText(e.name, p.x, top - 14); }
    if (e.prayers.melee && !e.dead) { cx.save(); cx.translate(p.x, top - 52); cx.fillStyle = "#f4f0d8"; cx.strokeStyle = "#000"; cx.beginPath(); cx.arc(0, 0, 10, 0, 6.3); cx.fill(); cx.stroke(); cx.strokeStyle = "#555"; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(-5, 6); cx.lineTo(5, -6); cx.stroke(); cx.restore(); }
    e.splats = e.splats.filter(function (s) { return now - s.t < 900; });
    e.splats.forEach(function (s, k) {
      var x = p.x - 12 + (k % 2) * 26, y = p.y - e.sh * 0.55 + Math.floor(k / 2) * 26;
      cx.save(); cx.translate(x, y); cx.fillStyle = s.v ? "#b30000" : "#2a55c8"; cx.strokeStyle = "#000"; cx.lineWidth = 1; cx.beginPath();
      for (var a = 0; a < 16; a++) { var r = a % 2 ? 10 : 14, an = a / 16 * 6.283; cx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } cx.closePath(); cx.fill(); cx.stroke();
      cx.fillStyle = "#fff"; cx.font = "bold 13px Arial"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText(s.v, 0, 1); cx.restore();
    });
    if (e.say && now < e.say.until) { cx.font = "bold 14px Arial"; cx.textAlign = "center"; cx.textBaseline = "alphabetic"; cx.fillStyle = "#000"; cx.fillText(e.say.t, p.x + 1, top - 27); cx.fillStyle = "#ffff00"; cx.fillText(e.say.t, p.x, top - 28); }
  }
  function drawGround() {
    ground.forEach(function (g) {
      var p = scr(g.i, g.j); cx.save(); cx.translate(p.x + (g.id === "bones" ? -7 : 8), p.y);
      if (g.id === "bones") { cx.strokeStyle = "#f0f0e8"; cx.lineWidth = 3; cx.lineCap = "round"; cx.beginPath(); cx.moveTo(-8, -3); cx.lineTo(8, 3); cx.moveTo(8, -3); cx.lineTo(-8, 3); cx.stroke(); }
      else if (g.id === "donut") { cx.fillStyle = "#ff7ab8"; cx.strokeStyle = "#6a4420"; cx.beginPath(); cx.ellipse(0, 0, 8, 5, 0, 0, 6.3); cx.fill(); cx.stroke(); cx.fillStyle = "#cfc6a8"; cx.beginPath(); cx.ellipse(0, 0, 2.5, 1.5, 0, 0, 6.3); cx.fill(); }
      else { cx.fillStyle = "#8a5a2a"; cx.strokeStyle = "#2a1a0a"; cx.fillRect(-6, -5, 12, 9); cx.strokeRect(-6, -5, 12, 9); }
      cx.restore();
    });
  }
  function drawMinimap(now) {
    var c = $("minimap").getContext("2d"), p = entPos(you, now); c.save(); c.clearRect(0, 0, 152, 152); c.beginPath(); c.arc(76, 76, 76, 0, 6.3); c.clip();
    c.fillStyle = "#1a1a1a"; c.fillRect(0, 0, 152, 152);
    if (img.bg.complete) c.drawImage(img.bg, p.x - 76 / MM, p.y - 76 / MM, 152 / MM, 152 / MM, 0, 0, 152, 152);
    function dot(x, y, col) { c.fillStyle = "#000"; c.fillRect(76 + (x - p.x) * MM - 2, 76 + (y - p.y) * MM - 2, 5, 5); c.fillStyle = col; c.fillRect(76 + (x - p.x) * MM - 1.5, 76 + (y - p.y) * MM - 1.5, 4, 4); }
    ground.forEach(function (g) { var q = scr(g.i, g.j); dot(q.x, q.y, "#ff2020"); });
    ents().forEach(function (e) { if (e === you || e.dead) return; var n = entPos(e, now); dot(n.x, n.y, e.remote ? "#ffffff" : "#ffff00"); });
    if (dest) { var d = scr(dest.i, dest.j), fx = 76 + (d.x - p.x) * MM, fy = 76 + (d.y - p.y) * MM; c.strokeStyle = "#3a2a10"; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 9); c.stroke(); c.fillStyle = "#ff2020"; c.fillRect(fx, fy - 9, 6, 4); }
    dot(p.x, p.y, "#ffffff"); c.restore();
  }
  function render(now) {
    cx.clearRect(0, 0, W, H);
    if (!started) { if (img.frame.complete) cx.drawImage(img.frame, 0, 0, W, H); return; }
    if (img.bg.complete) cx.drawImage(img.bg, 0, 0);
    drawGround();
    if (cross) { var f = (now - cross.t) / 420; if (f >= 1) cross = null; else { var r = 9 * (1 - f) + 2; cx.strokeStyle = cross.red ? "#ff1a1a" : "#ffff00"; cx.lineWidth = 2.5; cx.beginPath(); cx.moveTo(cross.x - r, cross.y - r); cx.lineTo(cross.x + r, cross.y + r); cx.moveTo(cross.x + r, cross.y - r); cx.lineTo(cross.x - r, cross.y + r); cx.stroke(); } }
    var es = ents().sort(function (a, b) { return entPos(a, now).y - entPos(b, now).y; });
    es.forEach(function (e) { drawEnt(e, now); }); es.forEach(function (e) { drawOver(e, now); });
    drawMinimap(now);
  }

  // ---------- run ----------
  function pump() { var now = performance.now(); if (started) { var guard = 0; while (now - tickStart >= TICK && guard++ < 5) { tickStart += TICK; tick(); } if (now - tickStart >= TICK) tickStart = now; } render(now); }
  function frame() { pump(); requestAnimationFrame(frame); }
  requestAnimationFrame(frame); setInterval(pump, 250);
  function start() {
    if (started) return; started = true; tickStart = performance.now(); $("clip").style.display = "none"; ui.hidden = false;
    var n = localName(); if (n) you.name = n;
    msg("Welcome to the patio.", ""); msg("A news helicopter is overhead. Act natural.", ""); msg("Type to talk. Right-click another officer to fight or trade, or yourself to rename.", "");
    if (!n) askName(); else checkAfton("me", n);
    refresh(); drawChat(); snd.click();
    if (!/[?&]solo\b/.test(location.search)) tryHost();
  }
  $("clip").addEventListener("mousedown", start);
  window.__cops = {
    you: you, npc: npc, inv: inv, ground: ground, others: others, start: start, tick: tick, render: function () { render(performance.now()); }, attack: attack, walkTo: walkTo, useItem: useItem, toggleSpec: toggleSpec,
    tradeWith: tradeWith, tradeAccept: tradeAccept, chat: chatSend, screamer: screamer,
    state: function () { return { tick: tickN, online: online, host: isHost, uid: uid, slot: you.slot, name: you.name, you: [you.tile.i, you.tile.j, you.hp, you.spec, you.weapon, you.dead], npc: npc.gone ? "gone" : [npc.tile.i, npc.tile.j, npc.hp, npc.food, npc.dead, !!npc.target], others: Object.keys(others).map(function (k) { var e = others[k]; return [e.name, e.slot, e.tile.i, e.tile.j, e.hp, e.dead]; }), kills: kills, deaths: deaths, ground: ground.length, trade: trade && { stage: trade.stage, mine: trade.mine.length, theirs: trade.theirs.length, myOk: trade.myOk, theirOk: trade.theirOk }, inv: inv.filter(Boolean).length }; }
  };
})();
