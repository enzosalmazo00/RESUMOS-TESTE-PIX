/**
 * study-timer.js — Timer de estudo flutuante com:
 *  • Cronômetro normal (conta tempo enquanto estuda)
 *  • Modo Pomodoro/regressivo (programa X minutos, conta de trás)
 *  • Persistência no Supabase (tabela estudo_diario)
 *  • Cálculo de streak automático
 *
 * Inclua em todas as páginas de resumo APÓS o auth-guard.js
 */
(function () {
"use strict";

// ── Estado ────────────────────────────────────────────────────────────────────
var startTime      = null;       // timestamp do início da sessão
var elapsedAtStart = 0;          // segundos já estudados hoje antes desta sessão
var timerInterval  = null;
var saveInterval   = null;

// Modo regressivo
var isCountdown    = false;
var countdownGoal  = 0;          // meta em segundos
var countdownDone  = false;

// Notificações de pausa
var notificacoes = [
  { min: 30,  shown: false, msg: "💧 Ei! Você está estudando há <strong>30 minutos</strong> seguidos. Não se esqueça de beber água e dar uma respirada!" },
  { min: 60,  shown: false, msg: "🦵 <strong>1 hora</strong> de estudo intenso! Hora de esticar as pernas, se hidratar e descansar os olhos por 5 minutinhos." },
  { min: 90,  shown: false, msg: "🧠 <strong>1h30 de foco total!</strong> Seu cérebro agradece uma pausa. Levante, respire fundo — você merece!" },
  { min: 120, shown: false, msg: "🏆 <strong>2 horas estudando!</strong> Isso é dedicação de verdade. Faça uma pausa maior — você está indo muito bem!" },
  { min: 180, shown: false, msg: "⭐ <strong>3 horas!</strong> Você é incrível. Mas agora é obrigação: pare, coma algo e volte renovado(a)!" },
];

// ── CSS ───────────────────────────────────────────────────────────────────────
var css = [
  ".st-widget{position:fixed;bottom:20px;right:20px;z-index:9000;display:flex;flex-direction:column;align-items:flex-end;gap:10px;font-family:Poppins,sans-serif;}",
  ".st-timer{display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:50px;background:rgba(2,8,16,0.88);border:1px solid rgba(34,211,238,0.25);backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,0.4);cursor:pointer;transition:all .25s;user-select:none;}",
  ".st-timer:hover{border-color:rgba(34,211,238,0.5);background:rgba(2,12,24,0.95);}",
  ".st-timer.countdown{border-color:rgba(251,191,36,0.4);}",
  ".st-timer.done{border-color:rgba(74,222,128,0.5);background:rgba(20,40,20,0.92);}",
  ".st-dot{width:7px;height:7px;border-radius:50%;background:#22d3ee;animation:st-pulse 1.5s ease infinite;}",
  ".st-timer.countdown .st-dot{background:#fbbf24;}",
  ".st-timer.done .st-dot{background:#4ade80;animation:none;}",
  "@keyframes st-pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.5;transform:scale(0.8);}}",
  ".st-time{font-size:13px;font-weight:700;color:#e2f8fc;letter-spacing:0.05em;min-width:54px;}",
  ".st-label{font-size:10px;color:rgba(125,211,232,0.5);font-weight:500;}",
  ".st-timer.countdown .st-label{color:rgba(251,191,36,0.7);}",
  ".st-cog{width:24px;height:24px;border-radius:50%;border:none;background:rgba(34,211,238,0.12);color:#7dd3e8;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}",
  ".st-cog:hover{background:rgba(34,211,238,0.25);color:#fff;transform:rotate(45deg);}",

  // Modal de configuração
  ".st-modal{position:fixed;inset:0;z-index:9100;background:rgba(2,8,16,0.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;pointer-events:none;transition:opacity .3s;font-family:Poppins,sans-serif;}",
  ".st-modal.open{opacity:1;pointer-events:all;}",
  ".st-modal-card{width:100%;max-width:380px;background:linear-gradient(160deg,#020d1a,#010812);border:1px solid rgba(34,211,238,0.25);border-radius:22px;padding:28px 24px;box-shadow:0 24px 60px rgba(0,0,0,0.6);transform:translateY(20px);transition:transform .3s;}",
  ".st-modal.open .st-modal-card{transform:translateY(0);}",
  ".st-modal-title{font-size:17px;font-weight:700;color:#e2f8fc;margin-bottom:6px;}",
  ".st-modal-sub{font-size:12.5px;color:rgba(125,211,232,0.55);margin-bottom:20px;line-height:1.5;}",
  ".st-mode-row{display:flex;gap:6px;background:rgba(255,255,255,0.03);padding:4px;border-radius:12px;margin-bottom:18px;}",
  ".st-mode-btn{flex:1;padding:9px;border:none;background:transparent;color:rgba(125,211,232,0.5);font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;border-radius:9px;transition:all .2s;}",
  ".st-mode-btn.on{background:rgba(34,211,238,0.15);color:#fff;}",
  ".st-presets{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:16px;}",
  ".st-preset{padding:10px 4px;border-radius:10px;border:1px solid rgba(34,211,238,0.18);background:rgba(34,211,238,0.04);color:#7dd3e8;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;}",
  ".st-preset:hover{background:rgba(34,211,238,0.12);border-color:rgba(34,211,238,0.45);color:#fff;}",
  ".st-preset.on{background:rgba(34,211,238,0.18);border-color:#22d3ee;color:#fff;}",
  ".st-custom{display:flex;gap:8px;align-items:center;margin-bottom:18px;}",
  ".st-custom label{font-size:11px;color:rgba(125,211,232,0.55);}",
  ".st-custom input{flex:1;padding:11px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(34,211,238,0.18);color:#fff;font-family:inherit;font-size:13px;outline:none;}",
  ".st-custom input:focus{border-color:rgba(34,211,238,0.5);}",
  ".st-actions{display:flex;gap:8px;}",
  ".st-act-primary{flex:1;padding:12px;border:none;border-radius:11px;background:linear-gradient(135deg,#22d3ee,#0891b2);color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;}",
  ".st-act-primary:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(34,211,238,0.4);}",
  ".st-act-ghost{padding:12px 18px;border:1px solid rgba(34,211,238,0.18);border-radius:11px;background:transparent;color:rgba(125,211,232,0.7);font-family:inherit;font-size:13px;cursor:pointer;transition:all .2s;}",
  ".st-act-ghost:hover{color:#fff;border-color:rgba(34,211,238,0.5);}",

  // Toast
  ".st-toast{position:fixed;bottom:80px;right:20px;z-index:9001;max-width:320px;padding:16px 18px;border-radius:16px;background:linear-gradient(135deg,rgba(2,13,26,0.97),rgba(1,8,18,0.97));border:1px solid rgba(34,211,238,0.25);box-shadow:0 12px 40px rgba(0,0,0,0.5);font-family:Poppins,sans-serif;font-size:13px;color:#c0f0f8;line-height:1.6;transform:translateX(120%);transition:transform .4s cubic-bezier(.34,1.56,.64,1);display:flex;flex-direction:column;gap:10px;}",
  ".st-toast.show{transform:translateX(0);}",
  ".st-toast.success{border-color:rgba(74,222,128,0.4);}",
  ".st-toast-close{align-self:flex-end;padding:5px 12px;border-radius:20px;border:1px solid rgba(34,211,238,0.2);background:transparent;color:#7dd3e8;font-size:11px;font-family:Poppins,sans-serif;cursor:pointer;transition:all .2s;}",
  ".st-toast-close:hover{background:rgba(34,211,238,0.1);color:#fff;}",
].join("");

var styleEl = document.createElement("style");
styleEl.textContent = css;
document.head.appendChild(styleEl);

// ── Build widget ──────────────────────────────────────────────────────────────
function buildWidget() {
  var wrap = document.createElement("div");
  wrap.className = "st-widget";
  wrap.id = "stWidget";
  wrap.innerHTML =
    '<div class="st-timer" id="stTimer" title="Clique na engrenagem para programar um tempo">' +
      '<span class="st-dot"></span>' +
      '<div>' +
        '<div class="st-time" id="stTime">00:00</div>' +
        '<div class="st-label" id="stLabel">estudando</div>' +
      '</div>' +
      '<button class="st-cog" id="stCog" title="Configurar timer">⚙</button>' +
    '</div>';
  document.body.appendChild(wrap);

  document.getElementById("stCog").addEventListener("click", function(e){
    e.stopPropagation();
    openModal();
  });

  buildModal();
}

// ── Modal de configuração ─────────────────────────────────────────────────────
function buildModal() {
  var m = document.createElement("div");
  m.className = "st-modal";
  m.id = "stModal";
  m.innerHTML =
    '<div class="st-modal-card">' +
      '<div class="st-modal-title">⏱️ Timer de estudo</div>' +
      '<div class="st-modal-sub">Programe um tempo de foco. O cronômetro vai contar de trás para frente e te avisar quando terminar.</div>' +

      '<div class="st-mode-row">' +
        '<button class="st-mode-btn on" data-mode="normal" id="stModeNormal">🎯 Cronômetro</button>' +
        '<button class="st-mode-btn" data-mode="countdown" id="stModeCountdown">⏳ Timer programado</button>' +
      '</div>' +

      '<div id="stCountdownConfig" style="display:none">' +
        '<div style="font-size:11px;color:rgba(125,211,232,0.55);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">Escolha um tempo:</div>' +
        '<div class="st-presets">' +
          '<button class="st-preset" data-min="25">25min<br><span style="font-size:9px;opacity:0.6">Pomodoro</span></button>' +
          '<button class="st-preset" data-min="45">45min</button>' +
          '<button class="st-preset" data-min="60">1h</button>' +
          '<button class="st-preset" data-min="90">1h30</button>' +
          '<button class="st-preset" data-min="120">2h</button>' +
          '<button class="st-preset" data-min="180">3h</button>' +
          '<button class="st-preset" data-min="240">4h</button>' +
          '<button class="st-preset" data-min="custom" id="stPresetCustom">Outro</button>' +
        '</div>' +
        '<div class="st-custom" id="stCustomRow" style="display:none">' +
          '<label>Minutos:</label>' +
          '<input type="number" id="stCustomMin" min="1" max="600" placeholder="Ex: 75" value="75">' +
        '</div>' +
      '</div>' +

      '<div class="st-actions">' +
        '<button class="st-act-ghost" onclick="window.stCloseModal()">Cancelar</button>' +
        '<button class="st-act-primary" id="stStartBtn">Começar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(m);

  // Eventos
  m.addEventListener("click", function(e){
    if(e.target === m) closeModal();
  });

  var modeNormal = document.getElementById("stModeNormal");
  var modeCount = document.getElementById("stModeCountdown");
  var cfg = document.getElementById("stCountdownConfig");
  modeNormal.addEventListener("click", function(){
    modeNormal.classList.add("on"); modeCount.classList.remove("on");
    cfg.style.display = "none";
  });
  modeCount.addEventListener("click", function(){
    modeCount.classList.add("on"); modeNormal.classList.remove("on");
    cfg.style.display = "block";
  });

  document.querySelectorAll(".st-preset").forEach(function(p){
    p.addEventListener("click", function(){
      document.querySelectorAll(".st-preset").forEach(function(x){x.classList.remove("on");});
      p.classList.add("on");
      if (p.getAttribute("data-min") === "custom") {
        document.getElementById("stCustomRow").style.display = "flex";
      } else {
        document.getElementById("stCustomRow").style.display = "none";
      }
    });
  });

  document.getElementById("stStartBtn").addEventListener("click", function(){
    var mode = modeCount.classList.contains("on") ? "countdown" : "normal";
    if (mode === "normal") {
      // Volta para cronômetro normal
      stopCountdown();
      closeModal();
      return;
    }
    // Timer programado
    var sel = document.querySelector(".st-preset.on");
    var min;
    if (sel && sel.getAttribute("data-min") === "custom") {
      min = parseInt(document.getElementById("stCustomMin").value) || 25;
    } else if (sel) {
      min = parseInt(sel.getAttribute("data-min")) || 25;
    } else {
      min = 25;
    }
    startCountdown(min);
    closeModal();
  });
}

window.stCloseModal = function(){ closeModal(); };
function openModal()  { document.getElementById("stModal").classList.add("open"); }
function closeModal() { document.getElementById("stModal").classList.remove("open"); }

// ── Cronômetro normal ─────────────────────────────────────────────────────────
function formatTime(sec) {
  var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  if (h > 0) return h + "h " + String(m).padStart(2,"0") + "min";
  return String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0");
}

function elapsedSec() {
  return elapsedAtStart + Math.floor((Date.now() - startTime) / 1000);
}

function tick() {
  var t = document.getElementById("stTime");
  if (!t) return;

  if (isCountdown) {
    var goalReached = elapsedSec() >= countdownGoal;
    if (goalReached && !countdownDone) {
      countdownDone = true;
      document.getElementById("stTimer").classList.remove("countdown");
      document.getElementById("stTimer").classList.add("done");
      document.getElementById("stLabel").textContent = "concluído!";
      t.textContent = "✓ feito";
      playDoneSound();
      showToast("🎉 <strong>Timer concluído!</strong> Você completou os " + Math.round(countdownGoal/60) + " minutos programados. Pode fazer uma pausa merecida!", "success");
    } else if (!goalReached) {
      var remaining = countdownGoal - elapsedSec();
      t.textContent = formatTime(remaining);
    }
  } else {
    t.textContent = formatTime(elapsedSec());
  }

  // Notificações de pausa (sempre baseadas em tempo decorrido)
  var min = elapsedSec() / 60;
  notificacoes.forEach(function(n){
    if (!n.shown && min >= n.min) {
      n.shown = true;
      showToast(n.msg);
    }
  });
}

function startCountdown(min) {
  isCountdown   = true;
  countdownGoal = min * 60;
  countdownDone = false;
  var timer = document.getElementById("stTimer");
  if (timer) {
    timer.classList.add("countdown");
    timer.classList.remove("done");
  }
  var lbl = document.getElementById("stLabel");
  if (lbl) lbl.textContent = "restantes (" + min + "min)";
  tick();
}

function stopCountdown() {
  isCountdown   = false;
  countdownDone = false;
  var timer = document.getElementById("stTimer");
  if (timer) timer.classList.remove("countdown", "done");
  var lbl = document.getElementById("stLabel");
  if (lbl) lbl.textContent = "estudando";
  tick();
}

function playDoneSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784].forEach(function(freq, i){
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + i*0.15);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i*0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*0.15 + 0.4);
      osc.start(ctx.currentTime + i*0.15);
      osc.stop(ctx.currentTime + i*0.15 + 0.4);
    });
  } catch(e) {}
}

// ── Toast ─────────────────────────────────────────────────────────────────────
var toastQueue = [], toastActive = false;
function showToast(msg, kind) {
  toastQueue.push({ msg: msg, kind: kind || "" });
  if (!toastActive) processQueue();
}
function processQueue() {
  if (toastQueue.length === 0) { toastActive = false; return; }
  toastActive = true;
  var item = toastQueue.shift();
  var t = document.createElement("div");
  t.className = "st-toast " + item.kind;
  t.innerHTML = '<div>' + item.msg + '</div>' +
    '<button class="st-toast-close">OK ✓</button>';
  t.querySelector(".st-toast-close").addEventListener("click", function(){
    t.classList.remove("show");
    setTimeout(function(){ if(t.parentElement) t.remove(); processQueue(); }, 400);
  });
  document.body.appendChild(t);
  setTimeout(function(){ t.classList.add("show"); }, 50);
  setTimeout(function(){
    if (t.parentElement) {
      t.classList.remove("show");
      setTimeout(function(){ if(t.parentElement) t.remove(); setTimeout(processQueue, 500); }, 400);
    }
  }, 12000);
}

// ── Persistência no Supabase ──────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0,10); }

// Carrega minutos já estudados hoje (de sessões anteriores)
async function loadTodayMinutes() {
  try {
    var client = window.authClient;
    var session = window.authSession;
    if (!client || !session) return 0;
    var res = await client.from("estudo_diario")
      .select("minutos,ultima_materia,streak_dias")
      .eq("user_id", session.user.id)
      .eq("data", todayStr())
      .maybeSingle();
    if (res.data) return res.data.minutos || 0;
    return 0;
  } catch(e) { return 0; }
}

// Calcula streak considerando o dia anterior
async function computeStreak() {
  try {
    var client = window.authClient;
    var session = window.authSession;
    if (!client || !session) return 1;
    // Busca o registro mais recente antes de hoje
    var yest = new Date(); yest.setDate(yest.getDate()-1);
    var yestStr = yest.toISOString().slice(0,10);
    var res = await client.from("estudo_diario")
      .select("data,streak_dias")
      .eq("user_id", session.user.id)
      .lt("data", todayStr())
      .order("data", { ascending: false })
      .limit(1);
    if (res.data && res.data.length > 0) {
      var last = res.data[0];
      if (last.data === yestStr) return (last.streak_dias || 0) + 1;
    }
    return 1;
  } catch(e) { return 1; }
}

// Salva os minutos atuais (upsert)
async function saveToSupabase() {
  try {
    var client = window.authClient;
    var session = window.authSession;
    if (!client || !session) return;
    var totalMin = Math.floor(elapsedSec() / 60);
    if (totalMin < 1) return;

    // Detecta matéria pela URL (ex: imunologia_p2.html → "imunologia_p2")
    var materia = "";
    try {
      var path = window.location.pathname;
      var fname = path.substring(path.lastIndexOf("/")+1).replace(".html","");
      if (fname && fname !== "dashboard" && fname !== "login" && fname !== "admin") {
        materia = fname;
      }
    } catch(e) {}

    var streak = await computeStreak();

    var payload = {
      user_id: session.user.id,
      data: todayStr(),
      minutos: totalMin,
      streak_dias: streak
    };
    if (materia) payload.ultima_materia = materia;

    await client.from("estudo_diario").upsert(payload, { onConflict: "user_id,data" });
  } catch(e) { console.warn("[study-timer] save error:", e); }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener("authReady", async function() {
  buildWidget();
  // Carrega minutos já estudados hoje (não zera ao recarregar a página)
  elapsedAtStart = (await loadTodayMinutes()) * 60;
  startTime = Date.now();
  timerInterval = setInterval(tick, 1000);
  tick();

  // Salva no Supabase a cada 30s
  saveInterval = setInterval(saveToSupabase, 30000);

  // Salva imediatamente após 60s (pega quem fecha rápido a aba)
  setTimeout(saveToSupabase, 60000);
});

// Para o timer + salva quando fecha a página
window.addEventListener("beforeunload", function() {
  if (timerInterval) clearInterval(timerInterval);
  if (saveInterval) clearInterval(saveInterval);
  // Salva síncrono via sendBeacon (única forma confiável no unload)
  try {
    var session = window.authSession;
    if (session && elapsedSec() >= 60) {
      var totalMin = Math.floor(elapsedSec() / 60);
      var payload = {
        user_id: session.user.id,
        data: todayStr(),
        minutos: totalMin
      };
      // Tentativa final - pode não chegar, mas tentamos
      navigator.sendBeacon &&
        navigator.sendBeacon("/study-timer-save", JSON.stringify(payload));
    }
  } catch(e) {}
});

// Salva ao trocar de aba (visibility change) - mais confiável que beforeunload
document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") {
    saveToSupabase();
  }
});

})();
