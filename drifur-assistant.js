/* DRIFUR voice shopping assistant \u2014 drop-in widget
 * Add before </body>:
 *   <script src="/drifur-assistant.js" defer></script>
 * Optional attributes: data-endpoint="..." data-amazon="..."
 */
(function () {
  if (window.__drifurAssistant) return;
  window.__drifurAssistant = true;

  var script = document.currentScript;
  var ENDPOINT = (script && script.dataset.endpoint) || "/.netlify/functions/drifur-assistant";
  var AMAZON_URL = (script && script.dataset.amazon) || "https://a.co/d/0fYlR7fh";
  var GREETING = "Hi, I'm the DRIFUR assistant. Tap the circle and ask me anything about the 3-in-1 pet hair kit for cats and dogs.";

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var canSpeak = "speechSynthesis" in window;
  var voiceOn = canSpeak;
  var unlocked = false;
  var history = [];
  var state = "idle"; // idle | listening | thinking | speaking
  var recog = null;
  var gotResult = false;

  // ---------- styles (black + gold, matches DRIFUR brand) ----------
  var css = [
    ".dfa,.dfa *{box-sizing:border-box;margin:0;font-family:'Crimson Pro',Georgia,serif}",
    ".dfa-launch{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:10px;padding:12px 20px;border-radius:999px;border:1px solid #c4a35a;background:#0d0d0d;color:#c4a35a;font-size:17px;letter-spacing:.04em;cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,.35)}",
    ".dfa-launch:hover{background:#151515}",
    ".dfa-launch .dfa-pulse{width:10px;height:10px;border-radius:50%;background:#c4a35a;animation:dfa-p 1.8s infinite}",
    "@keyframes dfa-p{0%{box-shadow:0 0 0 0 rgba(196,163,90,.6)}70%{box-shadow:0 0 0 10px rgba(196,163,90,0)}100%{box-shadow:0 0 0 0 rgba(196,163,90,0)}}",
    ".dfa-panel{position:fixed;right:20px;bottom:20px;z-index:2147483001;width:340px;max-width:calc(100vw - 32px);max-height:calc(100vh - 40px);display:flex;flex-direction:column;background:#0d0d0d;color:#eee;border:1px solid #3a3122;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.5);overflow:hidden}",
    ".dfa-panel[hidden]{display:none}",
    ".dfa-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #2a2418}",
    ".dfa-title{font-family:'Italiana','Crimson Pro',Georgia,serif;color:#c4a35a;font-size:22px;letter-spacing:.18em}",
    ".dfa-icon{background:none;border:0;color:#999;font-size:15px;cursor:pointer;padding:4px 6px}",
    ".dfa-icon:hover{color:#c4a35a}",
    ".dfa-stage{display:flex;flex-direction:column;align-items:center;padding:22px 18px 10px}",
    ".dfa-orb{position:relative;width:118px;height:118px;border-radius:50%;border:1px solid #c4a35a;background:radial-gradient(circle at 40% 35%,#2b2416,#0d0d0d 70%);cursor:pointer;display:flex;align-items:center;justify-content:center}",
    ".dfa-orb:focus-visible{outline:2px solid #c4a35a;outline-offset:4px}",
    ".dfa-core{width:46px;height:46px;border-radius:50%;background:#c4a35a;transition:transform .2s}",
    ".dfa-ring{position:absolute;inset:-8px;border-radius:50%;border:1px solid rgba(196,163,90,.35);opacity:0}",
    ".dfa[data-state=listening] .dfa-ring{opacity:1;animation:dfa-r 1.2s ease-out infinite}",
    ".dfa[data-state=listening] .dfa-core{transform:scale(.8);background:#e0c27a}",
    ".dfa[data-state=thinking] .dfa-core{animation:dfa-t 1s ease-in-out infinite}",
    ".dfa[data-state=speaking] .dfa-core{animation:dfa-s .5s ease-in-out infinite alternate}",
    "@keyframes dfa-r{from{transform:scale(.9);opacity:1}to{transform:scale(1.25);opacity:0}}",
    "@keyframes dfa-t{0%,100%{opacity:1}50%{opacity:.35}}",
    "@keyframes dfa-s{from{transform:scale(.85)}to{transform:scale(1.08)}}",
    ".dfa-status{margin-top:14px;font-size:15px;color:#b9a77d;min-height:20px;text-align:center}",
    ".dfa-log{flex:1;overflow-y:auto;padding:6px 18px 10px;display:flex;flex-direction:column;gap:8px;max-height:220px}",
    ".dfa-msg{font-size:16px;line-height:1.4;padding:9px 12px;border-radius:12px;max-width:90%}",
    ".dfa-msg.u{align-self:flex-end;background:#2a2418;color:#f0e6cf}",
    ".dfa-msg.a{align-self:flex-start;background:#171717;color:#eee;border:1px solid #2a2418}",
    ".dfa-type{display:flex;gap:8px;padding:0 18px 10px}",
    ".dfa-type[hidden]{display:none}",
    ".dfa-type input{flex:1;min-width:0;padding:10px 12px;border-radius:10px;border:1px solid #3a3122;background:#141414;color:#eee;font-size:16px}",
    ".dfa-type button{padding:10px 14px;border-radius:10px;border:0;background:#c4a35a;color:#0d0d0d;font-size:15px;cursor:pointer}",
    ".dfa-buy{display:block;margin:4px 18px 18px;padding:13px;text-align:center;border-radius:12px;background:#c4a35a;color:#0d0d0d!important;text-decoration:none!important;font-size:17px;letter-spacing:.05em}",
    ".dfa-buy:hover{background:#d4b46a}",
    "@media (max-width:480px){.dfa-panel{right:16px;left:16px;bottom:16px;width:auto}.dfa-launch{right:16px;bottom:16px}}",
    "@media (prefers-reduced-motion:reduce){.dfa *{animation:none!important}}"
  ].join("\n");

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---------- markup ----------
  var root = document.createElement("div");
  root.className = "dfa";
  root.setAttribute("data-state", "idle");
  root.innerHTML =
    '<button class="dfa-launch" type="button" aria-label="Open DRIFUR voice assistant"><span class="dfa-pulse"></span>Ask DRIFUR</button>' +
    '<div class="dfa-panel" role="dialog" aria-label="DRIFUR voice assistant" hidden>' +
      '<div class="dfa-head"><span class="dfa-title">DRIFUR</span><span>' +
        '<button class="dfa-icon dfa-mute" type="button"></button>' +
        '<button class="dfa-icon dfa-close" type="button" aria-label="Close">\u2715</button></span></div>' +
      '<div class="dfa-stage"><button class="dfa-orb" type="button" aria-label="Tap to talk"><span class="dfa-ring"></span><span class="dfa-core"></span></button>' +
      '<div class="dfa-status" aria-live="polite"></div></div>' +
      '<div class="dfa-log" aria-live="polite"></div>' +
      '<form class="dfa-type" hidden><input type="text" maxlength="300" placeholder="Type your question" aria-label="Type your question"><button type="submit">Ask</button></form>' +
      '<a class="dfa-buy" target="_blank" rel="noopener">Buy on Amazon</a>' +
    "</div>";
  document.body.appendChild(root);

  var $ = function (s) { return root.querySelector(s); };
  var launch = $(".dfa-launch"), panel = $(".dfa-panel"), orb = $(".dfa-orb");
  var statusEl = $(".dfa-status"), log = $(".dfa-log"), form = $(".dfa-type");
  var input = form.querySelector("input"), muteBtn = $(".dfa-mute"), buy = $(".dfa-buy");
  buy.href = AMAZON_URL;

  var STATUS = {
    idle: SR ? "Tap the circle to talk" : "Type your question below",
    listening: "Listening\u2026",
    thinking: "Thinking\u2026",
    speaking: "Speaking\u2026 tap to interrupt"
  };

  function setState(s) {
    state = s;
    root.setAttribute("data-state", s);
    statusEl.textContent = STATUS[s];
  }

  function renderMute() {
    muteBtn.hidden = !canSpeak;
    muteBtn.textContent = voiceOn ? "\uD83D\uDD0A" : "\uD83D\uDD07";
    muteBtn.setAttribute("aria-label", voiceOn ? "Turn voice replies off" : "Turn voice replies on");
  }

  function addMsg(role, text) {
    var d = document.createElement("div");
    d.className = "dfa-msg " + (role === "user" ? "u" : "a");
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  // ---------- speech out ----------
  function pickVoice() {
    var vs = window.speechSynthesis.getVoices() || [];
    var prefs = ["Samantha", "Google US English", "Microsoft Aria", "Microsoft Jenny", "Karen", "Daniel"];
    for (var i = 0; i < prefs.length; i++) {
      for (var j = 0; j < vs.length; j++) if (vs[j].name.indexOf(prefs[i]) === 0) return vs[j];
    }
    for (var k = 0; k < vs.length; k++) if (/^en(-|_)US/i.test(vs[k].lang)) return vs[k];
    return null;
  }

  function unlockSpeech() {
    // iOS Safari only allows speech that starts from a tap; prime it once.
    if (unlocked || !canSpeak) return;
    try { window.speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch (e) {}
    unlocked = true;
  }

  function speak(text) {
    if (!voiceOn || !canSpeak) { setState("idle"); return; }
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text.replace(/https?:\/\/\S+/g, ""));
      var v = pickVoice();
      if (v) u.voice = v;
      u.lang = "en-US";
      u.rate = 1.02;
      u.onend = u.onerror = function () { if (state === "speaking") setState("idle"); };
      setState("speaking");
      window.speechSynthesis.speak(u);
    } catch (e) { setState("idle"); }
  }

  function stopSpeaking() {
    if (canSpeak) try { window.speechSynthesis.cancel(); } catch (e) {}
  }

  // ---------- speech in ----------
  function listen() {
    if (!SR) { form.hidden = false; input.focus(); return; }
    stopSpeaking();
    try {
      recog = new SR();
      recog.lang = "en-US";
      recog.interimResults = true;
      recog.maxAlternatives = 1;
      gotResult = false;
      var live = null;

      recog.onresult = function (e) {
        var text = "", final = false;
        for (var i = e.resultIndex; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
          if (e.results[i].isFinal) final = true;
        }
        if (!live) live = addMsg("user", text); else live.textContent = text;
        if (final && text.trim()) {
          gotResult = true;
          live.remove();
          try { recog.stop(); } catch (x) {}
          ask(text.trim());
        }
      };
      recog.onerror = function (e) {
        if (live) live.remove();
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          statusEl.textContent = "Microphone is blocked \u2014 type instead";
          form.hidden = false;
          state = "idle"; root.setAttribute("data-state", "idle");
          return;
        }
        if (state === "listening") setState("idle");
      };
      recog.onend = function () {
        if (!gotResult && state === "listening") {
          if (live) live.remove();
          setState("idle");
        }
      };
      setState("listening");
      recog.start();
    } catch (e) {
      form.hidden = false;
      setState("idle");
    }
  }

  // ---------- talk to the assistant ----------
  function ask(text) {
    addMsg("user", text);
    history.push({ role: "user", content: text });
    setState("thinking");

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-10) })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var reply = (data && data.reply) || "Sorry, I didn't catch that. Could you try again?";
        history.push({ role: "assistant", content: reply });
        addMsg("assistant", reply);
        speak(reply);
      })
      .catch(function () {
        var msg = "I'm having trouble connecting. Tap Buy on Amazon for full details.";
        addMsg("assistant", msg);
        setState("idle");
      });
  }

  // ---------- events ----------
  launch.addEventListener("click", function () {
    unlockSpeech();
    panel.hidden = false;
    launch.hidden = true;
    if (!log.children.length) {
      addMsg("assistant", GREETING);
      history.push({ role: "assistant", content: GREETING });
    }
    if (!SR) form.hidden = false;
    setState(state);
    orb.focus();
  });

  $(".dfa-close").addEventListener("click", function () {
    stopSpeaking();
    if (recog) try { recog.abort(); } catch (e) {}
    panel.hidden = true;
    launch.hidden = false;
    setState("idle");
  });

  orb.addEventListener("click", function () {
    unlockSpeech();
    if (state === "thinking") return;
    if (state === "listening") { try { recog.stop(); } catch (e) {} return; }
    listen();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var t = input.value.trim();
    if (!t || state === "thinking") return;
    input.value = "";
    unlockSpeech();
    stopSpeaking();
    ask(t);
  });

  muteBtn.addEventListener("click", function () {
    voiceOn = !voiceOn;
    if (!voiceOn) { stopSpeaking(); if (state === "speaking") setState("idle"); }
    renderMute();
  });

  if (canSpeak && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = function () {};
  }

  renderMute();
  setState("idle");
})();
