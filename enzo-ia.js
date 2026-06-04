/**
 * enzo-ia.js — Widget flutuante do Enzo IA
 * Injeta automaticamente em qualquer página do Resumos do Enzo.
 * 
 * Como usar: adicionar ANTES do </body> em cada HTML:
 *   <script src="enzo-ia.js"></script>
 *
 * Páginas sem PAGE_KEY = modo livre (dashboard)
 * Páginas com PAGE_KEY = modo contextual (resumo específico)
 */
(function () {
  "use strict";

  // ── CONFIGURAÇÃO ────────────────────────────────────────────────────────
  var SUPABASE_URL     = "https://chqhdmjqnjjdatowfyif.supabase.co";
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNocWhkbWpxbmpqZGF0b3dmeWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDc0MDAsImV4cCI6MjA5NTgyMzQwMH0.v_7y0YD9R1LvFJkz9Vr_zJX0_CE2lo8OY5xX-KtVcFk";

  // Mapa de PAGE_KEY → nome legível para o contexto da IA
  var CONTEXTOS = {
    "biofisica":                "Biofísica Médica",
    "bioquimica_p1":            "Bioquímica P1 — Aminoácidos, Enzimas e Proteínas",
    "bioquimica_p2":            "Bioquímica P2 — Enzimas Clínicas, Carboidratos, Lipídios e Bases Nitrogenadas",
    "fisiologia_p2":            "Fisiologia Médica P2 — Sistema Cardíaco e Renal",
    "genetica_p2":              "Genética Médica P2",
    "imunologia_p2":            "Imunologia Médica P2",
    "microbiologia_p2":         "Microbiologia Teórica P2",
    "micro_pratica":            "Microbiologia Prática",
    "microbiologia_gram_negativos": "Microbiologia — Bactérias Gram-Negativas",
  };

  var pageKey     = window.PAGE_KEY || null;
  var contexto    = pageKey ? (CONTEXTOS[pageKey] || pageKey) : null;
  var historico   = [];
  var isOpen      = false;
  var isAnimating = false;

  // ── NÃO mostrar em login/admin/reset ───────────────────────────────────
  var pagina = window.location.pathname.split("/").pop();
  if (["login.html","admin.html","reset-password.html","index.html",""].indexOf(pagina) !== -1) return;

  // ── CSS ─────────────────────────────────────────────────────────────────
  var css = `
    /* ── VARIÁVEIS ── */
    :root {
      --ez-bg: #080c14;
      --ez-surface: #0d1421;
      --ez-surface2: #111827;
      --ez-border: rgba(255,255,255,0.06);
      --ez-glow: rgba(52,211,153,0.25);
      --ez-green: #34d399;
      --ez-teal: #2dd4bf;
      --ez-text: #e2e8f0;
      --ez-muted: #64748b;
      --ez-dim: #94a3b8;
    }

    /* ── BOTÃO FLUTUANTE ── */
    #ez-fab {
      position: fixed;
      bottom: 90px;
      right: 20px;
      z-index: 9998;
      width: 52px; height: 52px;
      border-radius: 16px;
      background: linear-gradient(135deg, #059669, #0d9488);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 24px rgba(52,211,153,0.35), 0 0 0 0 rgba(52,211,153,0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      animation: ez-fab-pulse 3s ease infinite;
      font-family: 'Poppins', 'Sora', sans-serif;
    }
    #ez-fab:hover { transform: scale(1.08); box-shadow: 0 8px 32px rgba(52,211,153,0.45); animation: none; }
    #ez-fab:active { transform: scale(0.96); }
    @keyframes ez-fab-pulse {
      0%, 100% { box-shadow: 0 4px 24px rgba(52,211,153,0.35), 0 0 0 0 rgba(52,211,153,0.3); }
      50% { box-shadow: 0 4px 24px rgba(52,211,153,0.35), 0 0 0 8px rgba(52,211,153,0); }
    }
    #ez-fab-icon-open  { width: 22px; height: 22px; transition: opacity 0.2s, transform 0.2s; }
    #ez-fab-icon-close { width: 20px; height: 20px; transition: opacity 0.2s, transform 0.2s; position: absolute; opacity: 0; transform: rotate(-90deg); }
    #ez-fab.open #ez-fab-icon-open  { opacity: 0; transform: rotate(90deg); }
    #ez-fab.open #ez-fab-icon-close { opacity: 1; transform: rotate(0deg); }

    /* Badge no FAB */
    #ez-fab-badge {
      position: absolute; top: -5px; right: -5px;
      width: 16px; height: 16px;
      background: var(--ez-green);
      border: 2px solid #080c14;
      border-radius: 50%;
      animation: ez-badge-pulse 2s ease infinite;
      display: block;
    }
    @keyframes ez-badge-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.7; }
    }

    /* ── PAINEL CHAT ── */
    #ez-panel {
      position: fixed;
      bottom: 155px;
      right: 20px;
      z-index: 9997;
      width: 360px;
      height: 520px;
      display: flex;
      flex-direction: column;
      background: var(--ez-surface);
      border: 1px solid var(--ez-border);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 0 0 1px rgba(52,211,153,0.06), 0 24px 64px rgba(0,0,0,0.7), 0 0 40px rgba(52,211,153,0.04);
      transform: translateY(20px) scale(0.96);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease;
    }
    #ez-panel.open {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: all;
    }

    /* Grade de fundo */
    #ez-panel::before {
      content: '';
      position: absolute; inset: 0;
      background-image:
        radial-gradient(circle at 50% 0%, rgba(52,211,153,0.04) 0%, transparent 60%),
        linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
      background-size: 100% 100%, 28px 28px, 28px 28px;
      pointer-events: none; z-index: 0;
    }

    /* ── HEADER DO PAINEL ── */
    #ez-header {
      position: relative; z-index: 2;
      padding: 14px 16px;
      border-bottom: 1px solid var(--ez-border);
      background: rgba(8,12,20,0.85);
      backdrop-filter: blur(12px);
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
    }
    .ez-identity { display: flex; align-items: center; gap: 10px; }
    .ez-avatar {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #059669, #0d9488);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 13px; color: #fff;
      box-shadow: 0 0 16px rgba(52,211,153,0.2);
      position: relative; flex-shrink: 0;
    }
    .ez-avatar::after {
      content: ''; position: absolute; bottom: -2px; right: -2px;
      width: 9px; height: 9px;
      background: var(--ez-green); border: 2px solid var(--ez-surface);
      border-radius: 50%; animation: ez-dot 2s infinite;
    }
    @keyframes ez-dot {
      0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.4); }
      50% { box-shadow: 0 0 0 3px rgba(52,211,153,0); }
    }
    .ez-name { font-weight: 700; font-size: 13px; color: #fff; font-family: 'Poppins', sans-serif; }
    .ez-status {
      font-size: 10px; color: var(--ez-green);
      display: flex; align-items: center; gap: 4px;
      font-family: 'JetBrains Mono', monospace;
    }
    .ez-ctx-badge {
      font-size: 9.5px; color: var(--ez-teal);
      background: rgba(45,212,191,0.08);
      border: 1px solid rgba(45,212,191,0.2);
      border-radius: 999px; padding: 1px 7px;
      margin-top: 2px; display: inline-block;
      max-width: 160px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .ez-btn-clear {
      background: none; border: none; cursor: pointer;
      color: var(--ez-muted); padding: 6px; border-radius: 8px;
      transition: all 0.2s; display: flex; align-items: center;
    }
    .ez-btn-clear:hover { color: var(--ez-text); background: rgba(255,255,255,0.05); }
    .ez-btn-clear svg { width: 15px; height: 15px; }

    /* ── CHAT BOX ── */
    #ez-chatbox {
      position: relative; z-index: 1;
      flex: 1; overflow-y: auto;
      padding: 16px 14px;
      display: flex; flex-direction: column; gap: 14px;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
    }
    #ez-chatbox::-webkit-scrollbar { width: 3px; }
    #ez-chatbox::-webkit-scrollbar-track { background: transparent; }
    #ez-chatbox::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
    #ez-chatbox::-webkit-scrollbar-thumb:hover { background: rgba(52,211,153,0.3); }

    /* ── MENSAGENS ── */
    .ez-msg { display: flex; gap: 8px; animation: ez-fadeUp 0.28s ease forwards; }
    .ez-msg.user { flex-direction: row-reverse; }
    @keyframes ez-fadeUp {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .ez-msg-icon {
      width: 26px; height: 26px; border-radius: 8px;
      background: linear-gradient(135deg, #059669, #0d9488);
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 700; color: #fff;
      flex-shrink: 0; margin-top: 2px;
      box-shadow: 0 0 8px rgba(52,211,153,0.12);
      font-family: 'Poppins', sans-serif;
    }
    .ez-bubble {
      max-width: 84%; padding: 10px 13px;
      border-radius: 14px; font-size: 13px; line-height: 1.6;
      font-family: 'Poppins', sans-serif;
    }
    .ez-msg.enzo .ez-bubble {
      background: rgba(17,24,39,0.85);
      border: 1px solid var(--ez-border);
      border-top-left-radius: 4px; color: var(--ez-text);
    }
    .ez-msg.user .ez-bubble {
      background: linear-gradient(135deg, #059669, #0d9488);
      border-top-right-radius: 4px; color: #fff; font-weight: 500;
    }

    /* Bloco PubMed */
    .ez-pubmed {
      margin-top: 8px;
      background: rgba(8,12,20,0.95);
      border: 1px solid rgba(52,211,153,0.12);
      border-radius: 9px; padding: 9px 11px;
      font-size: 10.5px;
    }
    .ez-pubmed-label {
      display: flex; align-items: center; gap: 5px;
      color: var(--ez-green); font-weight: 700;
      font-size: 9.5px; text-transform: uppercase;
      letter-spacing: 0.08em; margin-bottom: 5px;
    }
    .ez-pubmed-item {
      padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.03);
      color: var(--ez-dim); line-height: 1.5;
    }
    .ez-pubmed-item:last-child { border-bottom: none; padding-bottom: 0; }
    .ez-pubmed-item a { color: var(--ez-teal); text-decoration: none; font-weight: 600; }
    .ez-pubmed-item a:hover { text-decoration: underline; }

    /* ── LOADER ── */
    #ez-loader { display: none; }
    #ez-loader.show { display: flex; gap: 8px; }
    .ez-loader-bubble {
      background: rgba(17,24,39,0.8); border: 1px solid var(--ez-border);
      border-radius: 14px; border-top-left-radius: 4px;
      padding: 10px 14px; display: flex; align-items: center; gap: 8px;
      font-size: 11.5px; color: var(--ez-muted); font-family: 'Poppins', sans-serif;
    }
    .ez-dots { display: flex; gap: 4px; }
    .ez-dot {
      width: 5px; height: 5px; background: var(--ez-green);
      border-radius: 50%; animation: ez-bounce 1.2s infinite;
    }
    .ez-dot:nth-child(2) { animation-delay: 0.2s; }
    .ez-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes ez-bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
      40% { transform: translateY(-4px); opacity: 1; }
    }

    /* ── CHIPS ── */
    #ez-chips {
      position: relative; z-index: 2;
      display: flex; gap: 5px;
      overflow-x: auto; overflow-y: hidden;
      padding: 10px 14px 0;
      flex-shrink: 0;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
    }
    #ez-chips::-webkit-scrollbar { display: none; }
    .ez-chip {
      flex-shrink: 0;
      padding: 5px 11px; border-radius: 999px;
      background: rgba(17,24,39,0.8);
      border: 1px solid var(--ez-border);
      color: var(--ez-dim); font-size: 11px;
      cursor: pointer; transition: all 0.2s;
      white-space: nowrap; font-family: 'Poppins', sans-serif;
    }
    .ez-chip:hover {
      border-color: var(--ez-glow); color: var(--ez-green);
      background: rgba(52,211,153,0.05);
    }

    /* ── INPUT ── */
    #ez-input-area {
      position: relative; z-index: 2;
      padding: 10px 14px 14px; flex-shrink: 0;
    }
    .ez-input-wrap {
      display: flex; align-items: center; gap: 8px;
      background: rgba(8,12,20,0.95);
      border: 1px solid var(--ez-border);
      border-radius: 14px; padding: 5px 5px 5px 12px;
      transition: border-color 0.2s;
    }
    .ez-input-wrap:focus-within {
      border-color: var(--ez-glow);
      box-shadow: 0 0 0 3px rgba(52,211,153,0.05);
    }
    #ez-input {
      flex: 1; background: none; border: none; outline: none;
      color: var(--ez-text); font-family: 'Poppins', sans-serif;
      font-size: 13px; padding: 5px 0;
    }
    #ez-input::placeholder { color: var(--ez-muted); }
    #ez-send {
      width: 34px; height: 34px; border-radius: 9px;
      background: linear-gradient(135deg, #059669, #0d9488);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; flex-shrink: 0;
      box-shadow: 0 0 12px rgba(52,211,153,0.15);
    }
    #ez-send:hover { transform: scale(1.06); box-shadow: 0 0 20px rgba(52,211,153,0.25); }
    #ez-send:active { transform: scale(0.96); }
    #ez-send svg { width: 15px; height: 15px; color: #fff; }

    /* ── MOBILE ── */
    @media (max-width: 480px) {
      #ez-panel {
        bottom: 0; right: 0; left: 0;
        width: 100%; height: 70vh;
        border-radius: 20px 20px 0 0;
        border-bottom: none;
      }
      #ez-panel.open { transform: translateY(0) scale(1); }
      #ez-panel:not(.open) { transform: translateY(100%); }
      #ez-fab { bottom: 24px; right: 20px; }
    }
  `;

  // Injeta CSS
  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── HTML ──────────────────────────────────────────────────────────────────
  function buildHTML() {
    // FAB
    var fab = document.createElement("button");
    fab.id = "ez-fab";
    fab.title = "Enzo IA — Assistente de Estudos";
    fab.innerHTML = `
      <span id="ez-fab-badge"></span>
      <svg id="ez-fab-icon-open" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg id="ez-fab-icon-close" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    `;

    // Chips baseados no contexto
    var chipsHTML = contexto
      ? `
        <button class="ez-chip" onclick="ezUseChip('Qual a fisiopatologia básica?')">🧬 Fisiopatologia</button>
        <button class="ez-chip" onclick="ezUseChip('Quais os fármacos e mecanismos de ação?')">💊 Farmacologia</button>
        <button class="ez-chip" onclick="ezUseChip('Quais os critérios diagnósticos?')">📋 Diagnóstico</button>
        <button class="ez-chip" onclick="ezUseChip('Resumo rápido do conteúdo deste resumo')">⚡ Resumo Rápido</button>
      `
      : `
        <button class="ez-chip" onclick="ezUseChip('O que é síndrome nefrótica?')">🫘 Nefrologia</button>
        <button class="ez-chip" onclick="ezUseChip('Como funciona o ciclo de Krebs?')">🧬 Bioquímica</button>
        <button class="ez-chip" onclick="ezUseChip('Explique o potencial de ação cardíaco')">❤️ Fisiologia</button>
        <button class="ez-chip" onclick="ezUseChip('Quais os antibióticos beta-lactâmicos?')">💊 Farmacologia</button>
        <button class="ez-chip" onclick="ezUseChip('Diferença entre imunidade inata e adaptativa')">🛡️ Imunologia</button>
      `;

    // Painel
    var panel = document.createElement("div");
    panel.id = "ez-panel";
    panel.innerHTML = `
      <div id="ez-header">
        <div class="ez-identity">
          <div class="ez-avatar">Ez</div>
          <div>
            <div class="ez-name">Enzo IA</div>
            <div class="ez-status">● Gemini · PubMed</div>
            ${contexto ? `<div class="ez-ctx-badge">📖 ${contexto}</div>` : ''}
          </div>
        </div>
        <button class="ez-btn-clear" onclick="ezLimpar()" title="Limpar conversa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.36"/>
          </svg>
        </button>
      </div>

      <div id="ez-chatbox">
        <div class="ez-msg enzo">
          <div class="ez-msg-icon">Ez</div>
          <div class="ez-bubble">
            Olá! Sou o <strong>Enzo IA</strong>, seu assistente de estudos médicos. 🩺<br><br>
            O que você precisa agora, Dr(a)?<br><br>
            Enquanto você digita, já estou tomando um café para irmos com tudo! ☕
          </div>
        </div>
        <div id="ez-dynamic"></div>
        <div id="ez-loader">
          <div class="ez-msg-icon">Ez</div>
          <div class="ez-loader-bubble">
            <span id="ez-loader-text">Consultando PubMed</span>
            <div class="ez-dots">
              <div class="ez-dot"></div>
              <div class="ez-dot"></div>
              <div class="ez-dot"></div>
            </div>
          </div>
        </div>
      </div>

      <div id="ez-chips">${chipsHTML}</div>

      <div id="ez-input-area">
        <div class="ez-input-wrap">
          <input type="text" id="ez-input" placeholder="${contexto ? 'Pergunte sobre ' + contexto.split('—')[0].trim() + '…' : 'Pergunte qualquer coisa de medicina…'}" autocomplete="off" />
          <button id="ez-send" onclick="ezEnviar()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    // Evento do FAB
    fab.addEventListener("click", ezToggle);
  }

  // ── TOGGLE ────────────────────────────────────────────────────────────────
  window.ezToggle = function () {
    if (isAnimating) return;
    isAnimating = true;
    isOpen = !isOpen;
    var panel = document.getElementById("ez-panel");
    var fab   = document.getElementById("ez-fab");
    var badge = document.getElementById("ez-fab-badge");
    panel.classList.toggle("open", isOpen);
    fab.classList.toggle("open", isOpen);
    if (badge) badge.style.display = isOpen ? "none" : "block";
    if (isOpen) {
      setTimeout(function () {
        var input = document.getElementById("ez-input");
        if (input) input.focus();
        ezScroll();
      }, 250);
    }
    setTimeout(function () { isAnimating = false; }, 300);
  };

  // ── LIMPAR ────────────────────────────────────────────────────────────────
  window.ezLimpar = function () {
    historico = [];
    var dyn = document.getElementById("ez-dynamic");
    if (dyn) dyn.innerHTML = "";
  };

  // ── CHIP ──────────────────────────────────────────────────────────────────
  window.ezUseChip = function (texto) {
    var input = document.getElementById("ez-input");
    if (input) { input.value = texto; input.focus(); }
  };

  // ── SCROLL ───────────────────────────────────────────────────────────────
  function ezScroll() {
    var box = document.getElementById("ez-chatbox");
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }

  // ── ADICIONAR MENSAGEM ────────────────────────────────────────────────────
  function ezAddMsg(role, html) {
    var dyn = document.getElementById("ez-dynamic");
    if (!dyn) return;
    var isUser = role === "user";
    var div = document.createElement("div");
    div.className = "ez-msg " + (isUser ? "user" : "enzo");
    div.innerHTML = isUser
      ? `<div class="ez-bubble">${html}</div>`
      : `<div class="ez-msg-icon">Ez</div><div class="ez-bubble">${html}</div>`;
    dyn.appendChild(div);
    ezScroll();
  }

  // ── PUBMED ────────────────────────────────────────────────────────────────
  async function ezPubMed(query) {
    try {
      var url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term="
        + encodeURIComponent(query) + "&retmax=3&retmode=json&sort=relevance";
      var r1 = await fetch(url);
      var d1 = await r1.json();
      var ids = (d1.esearchresult && d1.esearchresult.idlist) || [];
      if (!ids.length) return [];

      var url2 = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id="
        + ids.join(",") + "&retmode=json";
      var r2 = await fetch(url2);
      var d2 = await r2.json();

      return ids.map(function (id) {
        var item = d2.result && d2.result[id];
        return {
          pmid: id,
          title: (item && item.title) || "Título indisponível",
          year: (item && item.pubdate) ? item.pubdate.split(" ")[0] : "",
          journal: (item && (item.fulljournalname || item.source)) || "",
        };
      }).filter(function (a) { return a.title !== "Título indisponível"; });
    } catch (e) { return []; }
  }

  // ── FORMATA TEXTO ─────────────────────────────────────────────────────────
  function ezFormat(texto) {
    return "<p>" + texto
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code style='font-family:monospace;background:rgba(0,0,0,0.4);padding:1px 5px;border-radius:4px;font-size:11.5px'>$1</code>")
      .replace(/\n\n/g, "</p><p style='margin-top:7px'>")
      .replace(/\n/g, "<br>") + "</p>";
  }

  // ── ENVIAR ────────────────────────────────────────────────────────────────
  window.ezEnviar = async function () {
    var inputEl = document.getElementById("ez-input");
    var loader  = document.getElementById("ez-loader");
    var loaderText = document.getElementById("ez-loader-text");
    if (!inputEl) return;

    var texto = inputEl.value.trim();
    if (!texto) return;

    inputEl.value = "";
    inputEl.disabled = true;

    ezAddMsg("user", texto);
    historico.push({ role: "user", content: texto });

    loader.classList.add("show");
    if (loaderText) loaderText.textContent = "Consultando PubMed";
    ezScroll();

    // Busca PubMed
    var termoBusca = contexto ? contexto + " " + texto : texto;
    var artigos = await ezPubMed(termoBusca);

    if (loaderText) loaderText.textContent = "Enzo está sintetizando";

    // Monta contexto
    var extra = "";
    if (artigos.length) {
      extra = "\n\nArtigos PubMed encontrados:\n" + artigos.map(function (a) {
        return "- PMID " + a.pmid + ': "' + a.title + '" (' + a.journal + ", " + a.year + ")";
      }).join("\n");
    }

    var msgContexto = contexto
      ? "[Contexto: estudando " + contexto + "]\n" + texto + extra
      : texto + extra;

    var msgs = historico.slice(0, -1).concat([{ role: "user", content: msgContexto }]);

    try {
      var res = await fetch(SUPABASE_URL + "/functions/v1/enzo-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ messages: msgs })
      });

      var data = await res.json();
      loader.classList.remove("show");

      if (data.reply) {
        historico.push({ role: "assistant", content: data.reply });
        var html = ezFormat(data.reply);

        if (artigos.length) {
          html += '<div class="ez-pubmed">'
            + '<div class="ez-pubmed-label">📚 Evidências PubMed</div>'
            + artigos.map(function (a) {
              return '<div class="ez-pubmed-item">'
                + '<a href="https://pubmed.ncbi.nlm.nih.gov/' + a.pmid + '/" target="_blank">PMID ' + a.pmid + '</a>'
                + ' — ' + (a.title.length > 70 ? a.title.substring(0, 70) + "…" : a.title)
                + ' <span style="color:#475569">· ' + a.year + '</span>'
                + '</div>';
            }).join("")
            + '</div>';
        }

        ezAddMsg("enzo", html);
      } else {
        ezAddMsg("enzo", '<span style="color:#ef4444">Erro: ' + (data.error || "resposta inválida") + '</span>');
      }
    } catch (e) {
      loader.classList.remove("show");
      ezAddMsg("enzo", '<span style="color:#ef4444">Erro de conexão. Tenta novamente.</span>');
    }

    inputEl.disabled = false;
    inputEl.focus();
  };

  // ── ENTER ─────────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    buildHTML();
    var inputEl = document.getElementById("ez-input");
    if (inputEl) {
      inputEl.addEventListener("keypress", function (e) {
        if (e.key === "Enter" && !e.shiftKey) ezEnviar();
      });
    }

    // Drag scroll nos chips
    var chips = document.getElementById("ez-chips");
    if (chips) {
      var drag = false, sx = 0, sl = 0;
      chips.addEventListener("mousedown", function (e) { drag = true; sx = e.pageX - chips.offsetLeft; sl = chips.scrollLeft; });
      chips.addEventListener("mouseleave", function () { drag = false; });
      chips.addEventListener("mouseup", function () { drag = false; });
      chips.addEventListener("mousemove", function (e) {
        if (!drag) return;
        e.preventDefault();
        chips.scrollLeft = sl - (e.pageX - chips.offsetLeft - sx) * 1.2;
      });
    }
  });

})();
