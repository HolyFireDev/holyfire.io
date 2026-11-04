/* Sin City: a hand of Texas Hold'em against four souls, told a line at a time.
   Started by the Black Book page when the hidden text is revealed. */
window.holdem = function (box, render) {
  var RANKS = ["Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King", "Ace"];
  var SUITS = ["Spades", "Hearts", "Clubs", "Diamonds"];
  var HANDS = ["high card", "a pair", "two pair", "three of a kind", "a straight", "a flush", "a full house", "four of a kind", "a straight flush"];

  function card(r, s) { return { r: r, s: s, name: RANKS[r] + " of " + SUITS[s] }; }
  function deck() { var d = []; for (var s = 0; s < 4; s++) for (var r = 0; r < 13; r++) d.push(card(r, s)); for (var i = d.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = d[i]; d[i] = d[j]; d[j] = t; } return d; }

  // Best five of up to seven cards. Returns [category, kicker ranks...] comparable element by element.
  function evaluate(cards) {
    var counts = {}, suits = {}, i;
    for (i = 0; i < cards.length; i++) { counts[cards[i].r] = (counts[cards[i].r] || 0) + 1; (suits[cards[i].s] = suits[cards[i].s] || []).push(cards[i].r); }
    var ranks = Object.keys(counts).map(Number).sort(function (a, b) { return b - a; });
    function straightHigh(rs) { var set = {}; rs.forEach(function (r) { set[r] = 1; }); if (set[12]) set[-1] = 1; for (var h = 12; h >= 3; h--) { var ok = true; for (var k = 0; k < 5; k++) if (!set[h - k]) { ok = false; break; } if (ok) return h; } return -1; }
    var flushSuit = null; for (var s in suits) if (suits[s].length >= 5) flushSuit = s;
    if (flushSuit !== null) { var sh = straightHigh(suits[flushSuit]); if (sh >= 0) return [8, sh]; }
    var groups = ranks.slice().sort(function (a, b) { return counts[b] - counts[a] || b - a; });
    if (counts[groups[0]] === 4) return [7, groups[0], ranks.filter(function (r) { return r !== groups[0]; })[0]];
    if (counts[groups[0]] === 3 && counts[groups[1]] >= 2) return [6, groups[0], groups[1]];
    if (flushSuit !== null) return [5].concat(suits[flushSuit].sort(function (a, b) { return b - a; }).slice(0, 5));
    var st = straightHigh(ranks); if (st >= 0) return [4, st];
    if (counts[groups[0]] === 3) return [3, groups[0]].concat(ranks.filter(function (r) { return r !== groups[0]; }).slice(0, 2));
    if (counts[groups[0]] === 2 && counts[groups[1]] === 2) return [2, groups[0], groups[1], ranks.filter(function (r) { return r !== groups[0] && r !== groups[1]; })[0]];
    if (counts[groups[0]] === 2) return [1, groups[0]].concat(ranks.filter(function (r) { return r !== groups[0]; }).slice(0, 3));
    return [0].concat(ranks.slice(0, 5));
  }
  function compare(a, b) { for (var i = 0; i < Math.max(a.length, b.length); i++) { var x = a[i] || 0, y = b[i] || 0; if (x !== y) return x - y; } return 0; }
  function pl(r) { return RANKS[r] + (RANKS[r] === "Six" ? "es" : "s"); }
  function describe(ev) {
    var c = ev[0];
    if (c === 8) return ev[1] === 12 ? "a royal flush" : "a straight flush, " + RANKS[ev[1]] + " high";
    if (c === 7) return "four " + pl(ev[1]);
    if (c === 6) return pl(ev[1]) + " full of " + pl(ev[2]);
    if (c === 5) return "a flush, " + RANKS[ev[1]] + " high";
    if (c === 4) return "a straight, " + (ev[1] === 3 ? "Five" : RANKS[ev[1]]) + " high";
    if (c === 3) return "three " + pl(ev[1]);
    if (c === 2) return "two pair, " + pl(ev[1]) + " and " + pl(ev[2]);
    if (c === 1) return "a pair of " + pl(ev[1]);
    return RANKS[ev[1]] + " high";
  }

  // The table.
  var you = { name: "You", chips: 100, you: true };
  var souls = [
    { name: "Hollow", chips: 100, tight: 0.75, bluff: 0.05, say: {
      fold: ["Hollow lets the cards go without looking up. He is staring at the candle in the middle of the table.", "He slides them back. The hood doesn't move.", "- No."],
      call: ["Hollow pushes the coins in with two fingers.", "He calls. He hasn't blinked since you sat down.", "The hood nods once. The coins follow."],
      raise: ["Hollow lays a nail across the top of his stack and pushes the whole lot of it forward.", "- More.", "Without a word, he raises. The rifle on his back is humming something."],
      check: ["Hollow taps the felt once.", "He checks. The candle flickers."],
      win: ["Hollow gathers the coins like a man gathering kindling. Nothing in his face.", "- Thank you.", "He takes the pot and goes back to staring at the flame."]
    } },
    { name: "Wrath", chips: 100, tight: 0.35, bluff: 0.3, say: {
      fold: ["- Rotten. Take it, you bastards.", "Wrath throws the cards down hard enough to spill his beer.", "- I'm out. Somebody get me another."],
      call: ["- Fine. Fine! I'll see it.", "Wrath calls and starts another story about a Tar Man and a wheelbarrow.", "He pushes the coins in with the butt of the shotgun."],
      raise: ["- Eat this.", "Wrath shoves a fistful of coins into the middle. A few roll off the table and nobody picks them up.", "- RAISE. You heard me."],
      check: ["- Check. Keep it moving, I'm thirsty.", "Wrath knocks twice on the table with a knuckle the size of a walnut."],
      win: ["- BOOYAH.", "Wrath drags the pot in with both arms, laughing like a drain.", "- That's for the lads. Drinks are on the pot."]
    } },
    { name: "Jack", chips: 100, tight: 0.55, bluff: 0.1, say: {
      fold: ["Jack sets the cards down neatly, squared to the edge of the table.", "- Not this one.", "He sighs and folds. The chains of ammunition shift on his shoulders."],
      call: ["Jack counts out the coins exactly and calls.", "- I'll work for it.", "He calls. He looks tired. He always looks tired."],
      raise: ["- I've got quotas.", "Jack raises, slow and deliberate, like a man feeding a machine.", "He pushes a stack in and wipes tar from his brow."],
      check: ["Jack checks and looks at the clock on the wall. There is no clock on the wall.", "- Check."],
      win: ["Jack takes the pot and stacks it in neat columns of ten.", "- Sevenfold. One down.", "He pulls the coins in. He doesn't smile, but something in his shoulders lets go."]
    } },
    { name: "Witch", chips: 100, tight: 0.5, bluff: 0.25, say: {
      fold: ["Witch closes her Book and folds. She was never going to play that one.", "- Pass.", "She folds, and watches you instead of the cards."],
      call: ["Witch whispers something to the Book before she calls.", "- I'll see it. For the story.", "She calls, and the Book scratches something down."],
      raise: ["The Book scratches. Witch raises, and smiles at nobody in particular.", "- Let's make it interesting.", "She raises without looking at her cards. She hasn't looked at them yet."],
      check: ["- Check.", "Witch checks and performs a small seal under the table. You pretend not to see it."],
      win: ["Witch takes the pot and recites the act of gratitude.", "- The Book said you'd do that.", "She gathers the coins. The Book is still scratching."]
    } }
  ];
  var players = [you].concat(souls), button = Math.floor(Math.random() * 5), pot = 0, board = [], d, handNo = 0, over = false;
  var SMALL = 1, BIG = 2;

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  // Pacing between actions; hidden tabs throttle timers, and tests set window.__holdem.fast to skip them.
  function later(fn, ms) { if (window.__holdem && window.__holdem.fast) fn(); else setTimeout(fn, ms); }
  function line(t) { render([t], box); }
  function lines(a) { render(a, box); }
  function alive() { return players.filter(function (p) { return p.chips > 0 || p.inPot; }); }
  function inHand() { return players.filter(function (p) { return p.inHand; }); }
  function named(c) { return "the " + c.name; }

  function youHand() { return describe(evaluate(you.cards.concat(board))); }

  function startHand() {
    if (over) return;
    var seated = players.filter(function (p) { return p.chips > 0; });
    if (you.chips <= 0) return bust();
    if (seated.length === 1) return tableIsYours();
    handNo++; d = deck(); board = []; pot = 0;
    players.forEach(function (p) { p.inHand = p.chips > 0; p.bet = 0; p.put = 0; p.allIn = false; p.cards = p.inHand ? [d.pop(), d.pop()] : null; });
    do { button = (button + 1) % 5; } while (!players[button].inHand);
    lines(["", "Hand " + handNo + ". The dealer shuffles without looking at the deck. The cards know where to go."]);
    var order = seatOrder(button + 1);
    var sb = order[0], bb = order[1];
    post(sb, SMALL); post(bb, BIG);
    line(sb.name + (sb.you ? " put" : " puts") + " in the small blind. " + bb.name + (bb.you ? " put" : " puts") + " in the big blind.");
    lines(["The dealer slides two cards across the felt, face down.", "You peek. " + you.cards[0].name + ". " + you.cards[1].name + "."]);
    if (Math.random() < 0.4) radio();
    betting(seatOrder(button + 3)[0], function () { street(3, "The flop. The dealer burns one and turns three."); });
  }
  function seatOrder(from) { var o = []; for (var i = 0; i < 5; i++) { var p = players[(from + i) % 5]; if (p.inHand) o.push(p); } return o; }
  function post(p, amt) { amt = Math.min(amt, p.chips); p.chips -= amt; p.bet += amt; p.put += amt; pot += amt; if (p.chips === 0) p.allIn = true; }

  function radio() {
    var ev = evaluate(you.cards), tips;
    if (ev[0] >= 1 || (you.cards[0].r >= 10 && you.cards[1].r >= 10)) tips = ["The man on your left leans over.", "- That's a hand. Don't let them see you know it."];
    else if (you.cards[0].r <= 6 && you.cards[1].r <= 6 && you.cards[0].s !== you.cards[1].s) tips = ["The man on your left leans over.", "- Throw it away. Nobody ever got rich on hope."];
    else tips = [pick(["The man on your left leans over.", "The radio man taps the table next to your coins."]), pick(["- Play the man, not the cards.", "- The Adversary always wins. But he'll let you win a few first.", "- Watch the woman with the Book. She already knows what you've got.", "- The angry one bets with his mouth. Let him."])];
    lines(tips);
  }

  // One betting round. `first` acts first. Ends when everyone still in has matched the highest bet.
  function betting(first, done) {
    var hi = Math.max.apply(null, players.map(function (p) { return p.bet; }));
    var order = seatOrder(players.indexOf(first)), idx = 0, raises = 0, acted = {};
    function next() {
      var live = inHand();
      if (live.length === 1) return finishHand();
      var needs = live.filter(function (p) { return !p.allIn && (p.bet < hi || !acted[p.name]); });
      if (!needs.length) { players.forEach(function (p) { p.bet = 0; }); return done(); }
      var p = order[idx % order.length]; idx++;
      if (!p.inHand || p.allIn || (p.bet === hi && acted[p.name])) return next();
      if (p.you) return youAct(p);
      botAct(p); later(next, 500);
    }
    function raiseSize() { return board.length ? Math.min(20, Math.max(BIG * 2, Math.round(pot / 2))) : BIG * 2; }
    function doCall(p) { var need = hi - p.bet; post(p, need); acted[p.name] = 1; }
    function doRaise(p) { doCall(p); var r = Math.min(raiseSize(), p.chips); post(p, r); hi = p.bet; raises++; acted = {}; acted[p.name] = 1; }
    function youAct(p) {
      var need = hi - p.bet;
      var acts = [];
      if (need === 0) acts.push(["check", function () { acted[p.name] = 1; line("You check."); }]);
      else acts.push(["call " + Math.min(need, p.chips), function () { doCall(p); line(p.chips === 0 ? "You push in everything you have." : "You call."); }]);
      if (raises < 3 && p.chips > need) acts.push([(need ? "raise " : "bet ") + Math.min(raiseSize(), p.chips - need), function () { doRaise(p); line(need ? "You raise." : "You bet. The coins ring on the wood."); }]);
      acts.push(["fold", function () { p.inHand = false; line("You fold. The dealer takes the cards without a word."); }]);
      var row = document.createElement("p"); row.className = "acts";
      row.appendChild(document.createTextNode("Pot " + pot + ". You have " + p.chips + ". "));
      acts.forEach(function (a) { var el = document.createElement("a"); el.href = "#"; el.textContent = a[0]; el.addEventListener("click", function (e) { e.preventDefault(); row.remove(); a[1](); later(next, 300); }); row.appendChild(el); });
      box.appendChild(row); row.scrollIntoView({ block: "end" });
    }
    function botAct(p) {
      var ev = evaluate(p.cards.concat(board)), strength;
      if (!board.length) { var a = p.cards[0].r, b = p.cards[1].r; strength = (a === b ? 0.6 + a / 30 : (a + b) / 30 + (p.cards[0].s === p.cards[1].s ? 0.08 : 0) + (Math.abs(a - b) <= 2 ? 0.04 : 0)); }
      else strength = Math.min(1, ev[0] / 6 + (ev[1] || 0) / 60 + (ev[0] === 0 ? -0.15 : 0));
      var need = hi - p.bet, roll = Math.random(), bluffing = roll < p.bluff;
      var want = bluffing ? "raise" : strength > p.tight + 0.15 ? "raise" : strength > p.tight - 0.25 || need === 0 ? "call" : "fold";
      if (want === "raise" && (raises >= 3 || p.chips <= need)) want = "call";
      if (want === "call" && need === 0) { acted[p.name] = 1; return line(pick(p.say.check)); }
      if (want === "fold") { p.inHand = false; return line(pick(p.say.fold)); }
      if (want === "call") { doCall(p); return line(pick(p.say.call) + (p.allIn ? " That's all of it." : "")); }
      doRaise(p); line(pick(p.say.raise) + (p.allIn ? " Everything he has is in the middle." : ""));
    }
    next();
  }

  function street(n, intro) {
    while (board.length < n) board.push(d.pop());
    var shown = board.slice(board.length === 3 ? 0 : board.length - 1).map(function (c) { return c.name; }).join(". ");
    lines([intro, shown + ".", you.inHand ? "You're holding " + youHand() + "." : "You're out of this one. The others play on."]);
    var live = inHand();
    if (live.filter(function (p) { return !p.allIn; }).length <= 1) return later(runOut, 400);
    betting(seatOrder(button + 1)[0], function () {
      if (n === 3) street(4, "The turn.");
      else if (n === 4) street(5, "The river. Last card.");
      else finishHand();
    });
  }
  function runOut() { if (board.length < 5) { while (board.length < 5) board.push(d.pop()); lines(["Nobody has anything left to bet. The dealer runs it out.", board.map(function (c) { return c.name; }).join(". ") + "."]); } finishHand(); }

  function finishHand() {
    var live = inHand();
    if (live.length === 1) { var w = live[0]; w.chips += pot - 1; pot = 0; lines([w.you ? "Everyone folds. You take the pot without showing a thing." : pick(w.say.win), "One coin slides into the slot in the middle of the table. The Adversary always wins."]); return after(); }
    if (board.length < 5) return runOut();
    // Side pots: each player can only win what they matched.
    var contribs = live.map(function (p) { return p.put; }).sort(function (a, b) { return a - b; });
    var levels = []; contribs.forEach(function (c) { if (levels.indexOf(c) < 0) levels.push(c); });
    var out = ["Showdown."], prev = 0, won = {};
    function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
    live.forEach(function (p) { p.ev = evaluate(p.cards.concat(board)); out.push((p.you ? "You turn over " : p.name + " turns over ") + p.cards[0].name + " and " + p.cards[1].name + ". " + cap(describe(p.ev)) + "."); });
    levels.forEach(function (lv) {
      var size = 0; players.forEach(function (p) { size += Math.max(0, Math.min(p.put, lv) - prev); });
      var elig = live.filter(function (p) { return p.put >= lv; });
      var best = null; elig.forEach(function (p) { if (!best || compare(p.ev, best.ev) > 0) best = p; });
      var winners = elig.filter(function (p) { return compare(p.ev, best.ev) === 0; });
      var share = Math.floor((size - (prev === 0 ? 1 : 0)) / winners.length);
      winners.forEach(function (w) { w.chips += share; won[w.name] = (won[w.name] || 0) + share; });
      if (winners.length > 1) out.push("Split pot. " + winners.map(function (w) { return w.name; }).join(" and ") + " share " + size + ".");
      else if (levels.length > 1) out.push((best.you ? "You take" : best.name + " takes") + (prev ? " the side pot, " : " the main pot, ") + size + ".");
      prev = lv;
    });
    players.forEach(function (p) { if (won[p.name]) out.push(p.you ? "The pot is yours. " + won[p.name] + " coins, less the house." : pick(p.say.win)); });
    out.push("One coin slides into the slot in the middle of the table. The Adversary always wins.");
    pot = 0; lines(out); after();
  }
  function after() {
    players.forEach(function (p) { p.inHand = false; if (!p.you && p.chips <= 0 && !p.gone) { p.gone = true; lines([pick({ Hollow: ["Hollow stands, shoulders the rifle, and walks out into the dark without a word.", "- Even Steven.", "Hollow is out. He leaves a nail on the table and takes nothing else."], Wrath: ["- Rotbags. The lot of you.", "Wrath finishes the beer, and the one next to it, and goes looking for a fight he can win.", "Wrath is out. The shotgun goes with him. The stories stay."], Jack: ["Jack stands up like a man at the end of a shift.", "- Back to the factory, then.", "Jack is out. He squares his chair to the table before he goes."], Witch: ["Witch closes the Book. The Book keeps writing anyway.", "- It wasn't my night. It was never going to be.", "Witch is out. She leaves the way she came, through a door you didn't see."] }[p.name])]); } });
    if (you.chips <= 0) return bust();
    if (players.filter(function (p) { return p.chips > 0; }).length === 1) return tableIsYours();
    var row = document.createElement("p"); row.className = "acts";
    row.appendChild(document.createTextNode("You have " + you.chips + ". "));
    var a = document.createElement("a"); a.href = "#"; a.textContent = "next hand"; a.addEventListener("click", function (e) { e.preventDefault(); row.remove(); startHand(); }); row.appendChild(a);
    var b = document.createElement("a"); b.href = "#"; b.textContent = "walk away"; b.addEventListener("click", function (e) { e.preventDefault(); row.remove(); walk(); }); row.appendChild(b);
    box.appendChild(row); row.scrollIntoView({ block: "end" });
  }
  function bust() { over = true; lines(["", "The dealer takes your last coin without looking at you.", "- Come back when you've got something to lose.", "The man on your left is gone. The radio is still playing.", "", "I wake up in the trench."]); }
  function walk() { over = true; lines(["", "You stand up with " + you.chips + " coins and your Book, and nobody stops you.", you.chips > 100 ? "The dealer watches you go. She writes something in a ledger. The house will have it back." : "The radio man doesn't look up.", "- The Adversary always wins.", "", "I wake up in the trench."]); }
  function tableIsYours() { over = true; lines(["", "The table is yours. Four empty chairs, four cold drinks.", "The dealer stacks every coin on the table, counts them twice, and slides them into the slot one at a time.", "- House money. You were playing with house money.", "- The Adversary always wins.", "", "I wake up in the trench."]); }

  window.__holdem = { players: players, state: function () { return { pot: pot, board: board.map(function (c) { return c.name; }), hand: handNo, over: over, p: players.map(function (p) { return [p.name, p.chips, p.inHand, p.allIn, p.bet, p.put]; }) }; } };
  lines(["You buy in for 100 silver coins. They came out of the Tar and they're going back to it.", "Blinds are 1 and 2. No limit, no mercy."]);
  startHand();
};
