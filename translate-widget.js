/**
 * translate-widget.js — Botão de tradução para Resumos do Enzo
 * Usa Google Translate via URL — funciona em qualquer hospedagem
 */
(function () {
  "use strict";

  var style = document.createElement("style");
  style.textContent = [
    /* Esconde banner do Google Translate */
    ".goog-te-banner-frame, #goog-te-banner-frame { display:none !important; }",
    "body { top: 0 !important; }",
    ".skiptranslate { display:none !important; }",

    /* Botão */
    ".gt-btn {",
    "  display:inline-flex; align-items:center; gap:7px;",
    "  padding:9px 16px; border-radius:12px;",
    "  border:1px solid rgba(34,211,238,0.25);",
    "  background:rgba(34,211,238,0.05);",
    "  color:rgba(125,211,232,0.85);",
    "  font-family:'Poppins',sans-serif;",
    "  font-size:13px; font-weight:500;",
    "  cursor:pointer; transition:all .25s;",
    "  white-space:nowrap;",
    "  position:relative;",
    "}",
    ".gt-btn:hover {",
    "  background:rgba(34,211,238,0.12);",
    "  border-color:rgba(34,211,238,0.5);",
    "  color:#fff;",
    "}",

    /* Dropdown */
    ".gt-dropdown {",
    "  display:none;",
    "  position:absolute; top:calc(100% + 8px); right:0;",
    "  background:rgba(2,13,26,0.97);",
    "  border:1px solid rgba(34,211,238,0.25);",
    "  border-radius:12px;",
    "  overflow:hidden;",
    "  box-shadow:0 12px 32px rgba(0,0,0,0.5);",
    "  z-index:9999; min-width:160px;",
    "}",
    ".gt-btn.open .gt-dropdown { display:block; }",
    ".gt-option {",
    "  display:flex; align-items:center; gap:10px;",
    "  padding:11px 16px;",
    "  font-family:'Poppins',sans-serif;",
    "  font-size:13px; color:rgba(125,211,232,0.85);",
    "  cursor:pointer; transition:background .2s;",
    "  border:none; background:none; width:100%; text-align:left;",
    "}",
    ".gt-option:hover { background:rgba(34,211,238,0.1); color:#fff; }",
    ".gt-option.active { color:#22d3ee; font-weight:600; }",
  ].join("\n");
  document.head.appendChild(style);

  function getCurrentLang() {
    var hl = new URLSearchParams(window.location.search).get("hl");
    return hl || "pt";
  }

  function buildButton() {
    var lang = getCurrentLang();
    var label = lang === "es" ? "🌐 Español" : "🌐 Idioma";

    var btn = document.createElement("div");
    btn.className = "gt-btn";
    btn.setAttribute("tabindex", "0");
    btn.innerHTML =
      '<span>' + label + '</span>' +
      '<svg width="10" height="6" viewBox="0 0 10 6" fill="none" style="opacity:0.6">' +
        '<path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>' +
      '<div class="gt-dropdown">' +
        '<button class="gt-option' + (lang === "pt" ? " active" : "") + '" data-lang="pt">🇧🇷 Português</button>' +
        '<button class="gt-option' + (lang === "es" ? " active" : "") + '" data-lang="es">🇵🇾 Español</button>' +
      '</div>';

    // Abre/fecha dropdown
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      btn.classList.toggle("open");
    });

    // Clique nas opções
    btn.querySelectorAll(".gt-option").forEach(function (opt) {
      opt.addEventListener("click", function (e) {
        e.stopPropagation();
        var targetLang = opt.getAttribute("data-lang");
        btn.classList.remove("open");

        if (targetLang === "pt") {
          // Remove tradução: recarrega sem parâmetro
          var url = new URL(window.location.href);
          url.searchParams.delete("hl");
          // Se página foi traduzida pelo Google Translate via iframe, recarrega limpa
          if (window.location.hostname.includes("translate.goog")) {
            // Está dentro do frame do Google Translate — volta para original
            window.location.href = window.location.href
              .replace(/translate\.goog.*?\//, "")
              .replace(/\?.*$/, "");
          } else {
            window.location.reload();
          }
        } else {
          // Abre no Google Translate
          var pageUrl = encodeURIComponent(window.location.href.split("?")[0]);
          var translateUrl =
            "https://translate.google.com/translate?sl=pt&tl=" +
            targetLang +
            "&u=" + pageUrl;
          window.location.href = translateUrl;
        }
      });
    });

    // Fecha ao clicar fora
    document.addEventListener("click", function () {
      btn.classList.remove("open");
    });

    return btn;
  }

  function inject() {
    var btn = buildButton();
    var anchor = document.getElementById("translateAnchor");

    if (anchor) {
      anchor.appendChild(btn);
    } else {
      // Fallback: flutuante no topo direito
      var wrapper = document.createElement("div");
      wrapper.style.cssText =
        "position:fixed;top:16px;right:20px;z-index:8999;";
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
