/**
 * translate-widget.js — Tradução via API MyMemory (gratuita, sem reload, sem login)
 * Traduz todos os textos do DOM sem sair da página nem acionar o auth-guard.
 */
(function () {
  "use strict";

  // ── CSS ──────────────────────────────────────────────────────────────────────
  var style = document.createElement("style");
  style.textContent = [
    ".gt-btn {",
    "  display:inline-flex; align-items:center; gap:7px;",
    "  padding:9px 16px; border-radius:12px;",
    "  border:1px solid rgba(34,211,238,0.25);",
    "  background:rgba(34,211,238,0.05);",
    "  color:rgba(125,211,232,0.85);",
    "  font-family:'Poppins',sans-serif;",
    "  font-size:13px; font-weight:500;",
    "  cursor:pointer; transition:all .25s;",
    "  white-space:nowrap; position:relative;",
    "}",
    ".gt-btn:hover { background:rgba(34,211,238,0.12); border-color:rgba(34,211,238,0.5); color:#fff; }",
    ".gt-btn.loading { opacity:0.6; pointer-events:none; }",
    ".gt-dropdown {",
    "  display:none; position:absolute;",
    "  top:calc(100% + 8px); right:0;",
    "  background:rgba(2,13,26,0.97);",
    "  border:1px solid rgba(34,211,238,0.25);",
    "  border-radius:12px; overflow:hidden;",
    "  box-shadow:0 12px 32px rgba(0,0,0,0.5);",
    "  z-index:9999; min-width:160px;",
    "}",
    ".gt-btn.open .gt-dropdown { display:block; }",
    ".gt-option {",
    "  display:flex; align-items:center; gap:10px;",
    "  padding:11px 16px;",
    "  font-family:'Poppins',sans-serif; font-size:13px;",
    "  color:rgba(125,211,232,0.85);",
    "  cursor:pointer; transition:background .2s;",
    "  border:none; background:none; width:100%; text-align:left;",
    "}",
    ".gt-option:hover { background:rgba(34,211,238,0.1); color:#fff; }",
    ".gt-option.active { color:#22d3ee; font-weight:600; }",
    ".gt-spinner {",
    "  display:inline-block; width:11px; height:11px;",
    "  border:2px solid rgba(34,211,238,0.3); border-top-color:#22d3ee;",
    "  border-radius:50%; animation:gt-spin .7s linear infinite;",
    "}",
    "@keyframes gt-spin { to { transform:rotate(360deg); } }",
  ].join("\n");
  document.head.appendChild(style);

  // ── Estado ────────────────────────────────────────────────────────────────────
  var currentLang = "pt";
  var originalTexts = new Map(); // nó → texto original
  var labelEl = null;

  // ── Coleta todos os nós de texto relevantes ────────────────────────────────────
  var SKIP_TAGS = new Set([
    "SCRIPT","STYLE","NOSCRIPT","IFRAME","INPUT","TEXTAREA","SELECT","CODE","PRE"
  ]);

  function collectTextNodes(root) {
    var nodes = [];
    var walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          var p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
          if (p.closest("#google_translate_element")) return NodeFilter.FILTER_REJECT;
          if (p.closest(".gt-btn")) return NodeFilter.FILTER_REJECT;
          var t = node.textContent.trim();
          if (!t || t.length < 2) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  // ── Traduz um lote de textos via MyMemory API ──────────────────────────────────
  // MyMemory é gratuita, sem key, suporta pt→es
  function translateBatch(texts, targetLang) {
    // Junta tudo com separador único para minimizar requests
    // Limite da MyMemory: 500 chars por request — quebramos em chunks
    var CHUNK = 450;
    var SEP = " ||| ";
    var chunks = [];
    var current = [];
    var currentLen = 0;

    texts.forEach(function (t) {
      var clean = t.trim();
      if (currentLen + clean.length + SEP.length > CHUNK) {
        if (current.length) chunks.push(current);
        current = [clean];
        currentLen = clean.length;
      } else {
        current.push(clean);
        currentLen += clean.length + SEP.length;
      }
    });
    if (current.length) chunks.push(current);

    // Traduz todos os chunks em paralelo
    var promises = chunks.map(function (chunk) {
      var q = encodeURIComponent(chunk.join(SEP));
      var url = "https://api.mymemory.translated.net/get?q=" + q + "&langpair=pt|" + targetLang;
      return fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var translated = (data.responseData && data.responseData.translatedText) || chunk.join(SEP);
          return translated.split(SEP);
        })
        .catch(function () { return chunk; }); // fallback: original
    });

    return Promise.all(promises).then(function (results) {
      return [].concat.apply([], results);
    });
  }

  // ── Aplica tradução no DOM ─────────────────────────────────────────────────────
  async function applyTranslation(lang) {
    var btn = document.querySelector(".gt-btn");
    if (btn) btn.classList.add("loading");
    if (labelEl) labelEl.innerHTML = '<span class="gt-spinner"></span>';

    var nodes = collectTextNodes(document.body);

    if (lang === "pt") {
      // Restaura originais
      nodes.forEach(function (node) {
        if (originalTexts.has(node)) {
          node.textContent = originalTexts.get(node);
        }
      });
      currentLang = "pt";
      if (labelEl) labelEl.textContent = "🌐 Idioma";
      if (btn) btn.classList.remove("loading");
      updateActiveOptions();
      return;
    }

    // Salva originais se ainda não salvou
    nodes.forEach(function (node) {
      if (!originalTexts.has(node)) {
        originalTexts.set(node, node.textContent);
      }
    });

    // Coleta textos para traduzir (usa original se já traduzido antes)
    var texts = nodes.map(function (node) {
      return originalTexts.get(node) || node.textContent;
    });

    try {
      var translated = await translateBatch(texts, lang);
      nodes.forEach(function (node, i) {
        if (translated[i] && translated[i].trim()) {
          node.textContent = translated[i];
        }
      });
    } catch (e) {
      console.warn("[translate-widget] Erro na tradução:", e);
    }

    currentLang = lang;
    if (labelEl) labelEl.textContent = lang === "es" ? "🌐 Español" : "🌐 Idioma";
    if (btn) btn.classList.remove("loading");
    updateActiveOptions();
  }

  function updateActiveOptions() {
    document.querySelectorAll(".gt-option").forEach(function (opt) {
      opt.classList.toggle("active", opt.getAttribute("data-lang") === currentLang);
    });
  }

  // ── Constrói botão ────────────────────────────────────────────────────────────
  function buildButton() {
    var btn = document.createElement("div");
    btn.className = "gt-btn";
    btn.setAttribute("tabindex", "0");
    btn.innerHTML =
      '<span id="gt-label-inner">🌐 Idioma</span>' +
      '<svg width="10" height="6" viewBox="0 0 10 6" fill="none" style="opacity:0.6">' +
        '<path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>' +
      '<div class="gt-dropdown">' +
        '<button class="gt-option active" data-lang="pt">🇧🇷 Português</button>' +
        '<button class="gt-option" data-lang="es">🇵🇾 Español</button>' +
      '</div>';

    labelEl = btn.querySelector("#gt-label-inner");

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      btn.classList.toggle("open");
    });

    btn.querySelectorAll(".gt-option").forEach(function (opt) {
      opt.addEventListener("click", function (e) {
        e.stopPropagation();
        btn.classList.remove("open");
        var lang = opt.getAttribute("data-lang");
        if (lang !== currentLang) applyTranslation(lang);
      });
    });

    document.addEventListener("click", function () {
      btn.classList.remove("open");
    });

    return btn;
  }

  // ── Injeta ────────────────────────────────────────────────────────────────────
  function inject() {
    var btn = buildButton();
    var anchor = document.getElementById("translateAnchor");
    if (anchor) {
      anchor.appendChild(btn);
    } else {
      var wrapper = document.createElement("div");
      wrapper.style.cssText = "position:fixed;top:16px;right:20px;z-index:8999;";
      wrapper.appendChild(btn);
      document.body.appendChild(wrapper);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
