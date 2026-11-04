/* The Bullet That Never Fires: two men, one revolver, and a trigger you can pull forever.
   Started by the Black Book page when the hidden text is revealed. */
window.roulette = function (box, render) {
  var pulls = 0, turn = 0, men = ["The first man", "The second man"];
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function line(t) { render([t], box); trim(); }
  function lines(a) { render(a, box); trim(); }
  function trim() { var ps = box.querySelectorAll("p:not(.acts)"); for (var i = 0; i < ps.length - 60; i++) ps[i].remove(); }

  var slides = ["Slide.", "The iron rasps across the velvet.", "He slides it over without looking.", "The revolver crosses the table. Neither man touches the cards.", "Slide. The dealer's chair is still empty."];
  var spins = ["Spin.", "The cylinder sings.", "He spins it with his thumb. It takes a long time to stop.", "Spin. The chamber settles where it settles.", "He doesn't spin it this time. Then he does."];
  var clicks = ["Click.", "Click. Nothing.", "The hammer falls on nothing at all.", "Click. He lets out the breath he was holding.", "Click. He doesn't bother holding his breath anymore.", "Click. He laughs. It isn't a good laugh."];
  var sixth = ["After the 6th click, something odd happens.", "Six chambers. Six clicks. One round, somewhere.", "He opens the cylinder and counts. Six. He closes it again.", "Neither of them says it. They keep playing."];
  function milestone(n) {
    if (n === 6) return sixth;
    if (n === 12) return ["A full dozen. The round has had every chance.", "- Maybe it's a dud.", "- Maybe."];
    if (n === 20) return ["The chips haven't moved since the gun came out. Nobody is counting them anyway."];
    if (n === 30) return ["The dealer came back once, saw the table, and left again. She didn't say anything either."];
    if (n === 50) return ["Fifty. The green velvet has a groove in it now, revolver-wide, running from one man to the other."];
    if (n === 100) return ["One hundred.", "- Do you want to stop?", "- No.", "- Me neither."];
    if (n === 200) return ["Dawn comes up grey through the one window. Neither man looks at it. The casino never closes anyway."];
    if (n === 365) return ["A year, if you count a click as a day. Nobody is counting."];
    if (n === 500) return ["Five hundred. Their hands know the weight of it now. They could do this asleep. Maybe they are."];
    if (n === 1000) return ["One thousand clicks.", "The first man finally asks the question.", "- What happens if it fires?", "The second man thinks about it for a long time.", "- One of us gets to leave.", "He slides it back."];
    if (n % 1000 === 0) return [n + ". The Book keeps the count. The men don't."];
    return null;
  }
  function pull() {
    pulls++;
    var who = men[turn]; turn = 1 - turn;
    var out = [];
    if (pulls > 1) { out.push(pick(slides)); if (Math.random() < 0.7) out.push(pick(spins)); }
    out.push(who + (pulls === 1 ? " puts the barrel to his temple." : pick([" raises it.", " puts it to his temple.", " doesn't hesitate.", " hesitates, then doesn't.", " closes his eyes.", " keeps his eyes open this time."])));
    out.push(pick(clicks));
    var m = milestone(pulls); if (m) out = out.concat([""], m);
    lines(out);
    offer();
  }
  function offer() {
    var row = document.createElement("p"); row.className = "acts";
    row.appendChild(document.createTextNode("Pull " + (pulls + 1) + ". "));
    var a = document.createElement("a"); a.href = "#"; a.textContent = "pull the trigger";
    a.addEventListener("click", function (e) { e.preventDefault(); row.remove(); pull(); });
    row.appendChild(a);
    box.appendChild(row); row.scrollIntoView({ block: "end" });
  }
  lines(["The revolver is loaded. One round, six chambers.", "The first man picks it up."]);
  offer();
};
