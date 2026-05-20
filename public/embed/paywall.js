/**
 * BASEUSDP Paywall — embeddable content gate.
 *
 * Usage on the writer's HTML page (anywhere they can paste raw script):
 *
 *   <p>Free preview paragraph readers always see.</p>
 *   <div class="baseusdp-paywall">
 *     <p>The rest of the article — hidden until paid.</p>
 *     ...
 *   </div>
 *
 *   <script src="https://baseusdp.com/embed/paywall.js"
 *           data-wallet="0xRecipient"
 *           data-price="5"
 *           data-token="USDC"
 *           data-article-id="optional-stable-id"></script>
 *
 * On load this script:
 *   1. Finds every `.baseusdp-paywall` element.
 *   2. If a valid unlock record is in localStorage for this article id, reveals.
 *   3. Otherwise hides the content and renders a "Pay $X USDC" button overlay.
 *   4. Clicking opens a popup to baseusdp.com/embed/pay with the same params.
 *   5. Listens for a "baseusdp.paywall.unlocked" postMessage from that popup
 *      carrying the article id + tx hash, persists the unlock, reveals content.
 *
 * No backend roundtrip per page view — unlock state lives in the reader's
 * localStorage. The "tamper-resistance" is the on-chain payment + receipt of
 * tx hash; sophisticated users could forge a localStorage entry to read free,
 * just like every other paywall on the web. The point is friction for honest
 * readers, not DRM.
 */
(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;

  // The currentScript reference is the literal <script> tag that loaded us;
  // we read its data-* attrs to learn what to gate.
  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();
  if (!script) return;

  var wallet = (script.getAttribute("data-wallet") || "").trim();
  var price = (script.getAttribute("data-price") || "").trim();
  var token = (script.getAttribute("data-token") || "USDC").trim().toUpperCase();
  var articleIdAttr = (script.getAttribute("data-article-id") || "").trim();
  var origin = (script.getAttribute("data-origin") || "https://baseusdp.com").replace(/\/$/, "");

  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    console.warn("[BASEUSDP paywall] data-wallet missing or invalid; not gating.");
    return;
  }
  if (!price || !isFinite(Number(price)) || Number(price) <= 0) {
    console.warn("[BASEUSDP paywall] data-price missing or invalid; not gating.");
    return;
  }
  if (token !== "USDC" && token !== "USDT") {
    console.warn("[BASEUSDP paywall] data-token must be USDC or USDT.");
    return;
  }

  // Article id: stable across visits. If writer specified one we trust it.
  // Otherwise we derive from wallet + page pathname + price + token.
  var articleId = articleIdAttr || cheapHash(
    wallet.toLowerCase() + ":" + window.location.pathname + ":" + price + ":" + token
  );
  var storageKey = "baseusdp_paywall_unlocked_" + articleId;

  function cheapHash(input) {
    // FNV-1a 32-bit, hex-encoded. Not cryptographic — just stable + short.
    var h = 0x811c9dc5;
    for (var i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ("00000000" + h.toString(16)).slice(-8);
  }

  function isUnlocked() {
    try {
      var raw = localStorage.getItem(storageKey);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.articleId !== articleId) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function persistUnlock(txHash) {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        articleId: articleId,
        txHash: txHash || null,
        at: Date.now(),
      }));
    } catch (e) {
      /* localStorage full / disabled — best-effort. */
    }
  }

  var gatedBlocks = document.querySelectorAll(".baseusdp-paywall");
  if (gatedBlocks.length === 0) return;

  function reveal() {
    for (var i = 0; i < gatedBlocks.length; i++) {
      var block = gatedBlocks[i];
      var overlay = block.querySelector(".baseusdp-paywall-overlay");
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      block.style.position = "";
      block.style.overflow = "";
      // Restore original content from data-original if we replaced it.
      var inner = block.querySelector(".baseusdp-paywall-inner");
      if (inner) {
        var children = [];
        while (inner.firstChild) children.push(inner.removeChild(inner.firstChild));
        inner.parentNode.removeChild(inner);
        for (var j = 0; j < children.length; j++) block.appendChild(children[j]);
      }
    }
  }

  function hideAndShowGate() {
    for (var i = 0; i < gatedBlocks.length; i++) {
      var block = gatedBlocks[i];

      // Wrap existing content in an "inner" div with display:none, so we can
      // bring it back when unlocked without re-fetching the HTML.
      var inner = document.createElement("div");
      inner.className = "baseusdp-paywall-inner";
      inner.style.display = "none";
      while (block.firstChild) inner.appendChild(block.firstChild);
      block.appendChild(inner);

      // Only the first block gets the visible overlay; subsequent blocks are
      // just collapsed (avoids stacking many pay buttons on a long article).
      if (i === 0) {
        block.appendChild(buildOverlay());
      }
    }
  }

  function buildOverlay() {
    var overlay = document.createElement("div");
    overlay.className = "baseusdp-paywall-overlay";
    overlay.setAttribute("style", [
      "max-width:480px",
      "margin:24px auto",
      "padding:24px",
      "border-radius:16px",
      "border:1px solid rgba(0,0,0,0.1)",
      "background:#fff",
      "box-shadow:0 4px 24px rgba(0,0,0,0.06)",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      "color:#111",
      "text-align:center",
    ].join(";"));

    var title = document.createElement("div");
    title.textContent = "Continue reading";
    title.setAttribute("style", "font-size:20px;font-weight:600;margin-bottom:8px;");
    overlay.appendChild(title);

    var sub = document.createElement("div");
    sub.textContent = "Pay $" + Number(price) + " " + token + " to unlock the rest of this post.";
    sub.setAttribute("style", "font-size:14px;color:#444;margin-bottom:20px;");
    overlay.appendChild(sub);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Pay $" + Number(price) + " " + token + " with BASEUSDP";
    btn.setAttribute("style", [
      "display:inline-block",
      "padding:12px 20px",
      "border-radius:9999px",
      "border:none",
      "background:#0052FF",
      "color:#fff",
      "font-size:15px",
      "font-weight:600",
      "cursor:pointer",
    ].join(";"));
    btn.onclick = openPopup;
    overlay.appendChild(btn);

    var footer = document.createElement("div");
    footer.innerHTML =
      "Powered by " +
      "<a href=\"https://baseusdp.com\" target=\"_blank\" rel=\"noopener\" style=\"color:#0052FF;text-decoration:none;font-weight:500;\">BASEUSDP</a>" +
      " — payments on Base. No account needed.";
    footer.setAttribute("style", "font-size:12px;color:#666;margin-top:16px;");
    overlay.appendChild(footer);

    return overlay;
  }

  var popupHandle = null;

  function openPopup() {
    var url =
      origin + "/embed/pay" +
      "?to=" + encodeURIComponent(wallet) +
      "&amount=" + encodeURIComponent(price) +
      "&token=" + encodeURIComponent(token) +
      "&article=" + encodeURIComponent(articleId) +
      "&from=" + encodeURIComponent(window.location.origin);
    var w = 460;
    var h = 720;
    var y = window.outerHeight / 2 + window.screenY - h / 2;
    var x = window.outerWidth / 2 + window.screenX - w / 2;
    if (popupHandle && !popupHandle.closed) {
      try { popupHandle.focus(); } catch (e) { /* noop */ }
      return;
    }
    popupHandle = window.open(
      url,
      "baseusdp-paywall-popup",
      "width=" + w + ",height=" + h + ",left=" + x + ",top=" + y + ",noopener=no"
    );
  }

  function onMessage(event) {
    // Only trust the configured origin to send unlock messages.
    if (event.origin !== origin) return;
    var data = event.data;
    if (!data || data.type !== "baseusdp.paywall.unlocked") return;
    if (data.articleId !== articleId) return;
    persistUnlock(data.txHash);
    reveal();
    try { if (popupHandle && !popupHandle.closed) popupHandle.close(); } catch (e) { /* noop */ }
  }

  if (isUnlocked()) {
    // Nothing to do — content stays visible.
    return;
  }

  hideAndShowGate();
  window.addEventListener("message", onMessage);
})();
