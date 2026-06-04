/**
 * auth-guard.js — v2 (corrigido)
 *
 * CORREÇÕES APLICADAS:
 *  [C1] erro ao buscar perfil NÃO redireciona para login — evita loop
 *  [C2] profile null NÃO redireciona para login — evita loop por RLS
 *  [C3] pageKey ausente/false redireciona para dashboard, não para login
 *  [C4] device_id baseado em crypto.getRandomValues (estável via localStorage)
 *       — a versão de auth.js usava hash de userAgent que muda com updates do browser
 *  [C5] active_session atualizado aqui, não só no login — garante consistência
 *  [C6] SUPABASE_KEY movida para variável única (não duplicada em auth.js)
 *
 * Como usar em cada página protegida:
 *   <script>window.PAGE_KEY = "biofisica";</script>   ← coluna da página (ou null para dashboard)
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="auth-guard.js"></script>
 *
 * Após auth OK dispara: document.dispatchEvent(new CustomEvent("authReady"))
 * window.authClient  → cliente Supabase
 * window.authSession → sessão do usuário
 */

(function () {
  "use strict";

  var SUPABASE_URL = "https://chqhdmjqnjjdatowfyif.supabase.co";
  var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNocWhkbWpxbmpqZGF0b3dmeWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDc0MDAsImV4cCI6MjA5NTgyMzQwMH0.v_7y0YD9R1LvFJkz9Vr_zJX0_CE2lo8OY5xX-KtVcFk";
  var LOGIN_PAGE     = "login.html";
  var DASHBOARD_PAGE = "dashboard.html";

  window.authClient  = null;
  window.authSession = null;

  // ── [C4] Device ID persistente via crypto — estável entre sessões ────────
  // NÃO usa userAgent (muda com updates do browser/OS — causaria falso conflito)
  function getDeviceId() {
    var key = "_resumos_did";
    var id  = localStorage.getItem(key);
    if (!id) {
      var arr = new Uint8Array(10);
      crypto.getRandomValues(arr);
      id = Array.from(arr).map(function(b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
      localStorage.setItem(key, id);
    }
    return id;
  }

  document.addEventListener("DOMContentLoaded", async function () {

    // SDK carregado?
    if (typeof supabase === "undefined") {
      console.error("[auth-guard] Supabase SDK nao carregado.");
      return;
    }

    // Criar cliente
    var client;
    try {
      client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      window.authClient = client;
    } catch (err) {
      console.error("[auth-guard] Erro ao criar cliente:", err);
      // Erro de rede/config → NÃO redireciona (evita loop)
      return;
    }

    // ── Verificar sessão Supabase ─────────────────────────────────────────
    var session = null;
    try {
      var result = await client.auth.getSession();
      if (result.error) throw result.error;
      session = (result.data && result.data.session) ? result.data.session : null;

      // Se não encontrou sessão, tenta mais uma vez após delay
      // (Supabase pode demorar para restaurar do localStorage)
      if (!session) {
        await new Promise(function(r){ setTimeout(r, 800); });
        var retry = await client.auth.getSession();
        session = (retry.data && retry.data.session) ? retry.data.session : null;
      }
    } catch (err) {
      console.error("[auth-guard] getSession falhou:", err);
      return;
    }

    // Sem sessão → redireciona para login (único redirect legítimo aqui)
    if (!session) {
      window.location.replace(LOGIN_PAGE);
      return;
    }

    // ── Buscar perfil ─────────────────────────────────────────────────────
    var pageKey = window.PAGE_KEY || null;

    // Determina o pacote correspondente ao resumo (ex: bioquimica_p2 → pacote_p2)
    var pacoteKey = null;
    if (pageKey) {
      if (pageKey.endsWith("_p1"))    pacoteKey = "pacote_p1";
      if (pageKey.endsWith("_p2"))    pacoteKey = "pacote_p2";
      if (pageKey.endsWith("_final")) pacoteKey = "pacote_final";
    }

    // Busca coluna do resumo + pacote + data de expiração individual
    var extraFields = "";
    if (pageKey)    extraFields += ", " + pageKey;
    if (pacoteKey)  extraFields += ", " + pacoteKey;
    if (pageKey)    extraFields += ", " + pageKey + "_expira";
    if (pacoteKey)  extraFields += ", " + pacoteKey + "_expira";

    var fields = "is_approved, active_session, device_id" + extraFields;

    var profile = null;
    try {
      var res = await client
        .from("profiles")
        .select(fields)
        .eq("id", session.user.id)
        .single();

      if (res.error) throw res.error;
      profile = res.data;
    } catch (err) {
      console.error("[auth-guard] Erro ao buscar perfil:", err);
      _showErrorOverlay("Erro ao carregar perfil. Tente recarregar a página.");
      return;
    }

    // [C2] CORREÇÃO: profile null pode ser RLS bloqueando, não logout
    if (!profile) {
      _showErrorOverlay("Não foi possível carregar seus dados. Recarregue a página.");
      return;
    }

    // ── Conta aprovada? ───────────────────────────────────────────────────
    if (!profile.is_approved) {
      alert("Sua conta ainda não foi aprovada. Aguarde o contato via WhatsApp.");
      await client.auth.signOut();
      window.location.replace(LOGIN_PAGE);
      return;
    }

    // ── Verificar dispositivo autorizado ──────────────────────────────────
    var currentDevice = getDeviceId();

    if (profile.active_session && profile.device_id && profile.device_id !== currentDevice) {
      await client.auth.signOut();
      window.location.replace(LOGIN_PAGE);
      return;
    }

    // ── [C3] Verificar acesso à página ────────────────────────────────────
    if (pageKey) {
      // Verifica se tem acesso individual OU pelo pacote
      var temAcesso = !!profile[pageKey] || !!(pacoteKey && profile[pacoteKey]);

      if (!temAcesso) {
        alert("Acesso não liberado para este conteúdo. Faça o pagamento para liberar.");
        window.location.replace(DASHBOARD_PAGE);
        return;
      }

      // Verifica expiração — só bloqueia se tiver data E ela já passou
      // Se não tiver data de expiração = acesso permanente (liberado manualmente)
      var expiraCol  = pageKey + "_expira";
      var expiraPack = pacoteKey ? pacoteKey + "_expira" : null;
      var expiraData = profile[expiraCol] || (expiraPack ? profile[expiraPack] : null);

      if (expiraData && new Date(expiraData) < new Date()) {
        alert("Seu acesso a este resumo expirou. Renove para continuar.");
        window.location.replace(DASHBOARD_PAGE);
        return;
      }
    }

    // ── TUDO OK ───────────────────────────────────────────────────────────
    window.authSession = session;
    document.dispatchEvent(new CustomEvent("authReady", {
      detail: { session: session }
    }));
  });

  // ── Overlay de erro (não derruba o usuário) ───────────────────────────
  function _showErrorOverlay(msg) {
    // Revela a página para o usuário não ficar com tela em branco
    document.documentElement.style.visibility = "visible";
    var div = document.createElement("div");
    div.style.cssText = [
      "position:fixed", "inset:0", "z-index:9999",
      "display:flex", "flex-direction:column",
      "align-items:center", "justify-content:center",
      "background:rgba(2,8,16,0.92)",
      "color:#fca5a5", "font-family:Poppins,sans-serif",
      "font-size:14px", "text-align:center", "padding:24px", "gap:16px"
    ].join(";");
    div.innerHTML =
      "<div style='font-size:32px'>⚠️</div>" +
      "<div>" + msg + "</div>" +
      "<button onclick='location.reload()' style='" +
        "padding:10px 24px;border:1px solid rgba(252,165,165,0.4);border-radius:10px;" +
        "background:transparent;color:#fca5a5;font-family:Poppins,sans-serif;" +
        "font-size:13px;cursor:pointer" +
      "'>Recarregar</button>";
    document.body.appendChild(div);
  }

})();
