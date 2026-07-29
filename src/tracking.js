(() => {
  "use strict";

  const CONFIG = Object.freeze({
    productName: "Protocolo Antiflacidez",
    price: 47,
    currency: "BRL",
    ga4Id: "G-STBMVXHXJX",
    gtmId: "GTM-M4J7H7W8",
    metaPixelId: "1346135320973972",
    clarityId: "xu4xfl1ckz",
  });

  // As conversões financeiras permanecem exclusivamente na Kiwify:
  // purchase: AW-10899379805/tvaRCLmsxtgcEN2snc0o
  // begin_checkout: AW-10899379805/bK1UCO361dgcEN2snc0o
  const CONSENT_KEY = "paf:tracking-consent:v1";
  const ATTRIBUTION_KEY = "paf:attribution:v1";
  const ALLOWED_ATTRIBUTION_PARAM =
    /^(utm_(source|medium|campaign|content|term|id)|gclid|gbraid|wbraid|fbclid|ttclid|src|sck)$/i;
  const CHECKOUT_SELECTOR = "[data-checkout-link], [data-checkout]";
  const DEBUG = new URLSearchParams(window.location.search).get("tracking_debug") === "1";

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };

  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500,
  });
  window.gtag("set", "ads_data_redaction", true);

  const state = {
    consent: readStorage(CONSENT_KEY),
    trackersLoaded: false,
    pageVariant: document.body?.dataset.pageVariant || "unknown",
    sentScrollDepths: new Set(),
    sentEngagementTimes: new Set(),
    sentVideoMilestones: new Set(),
    recheckers: new Set(),
  };

  function debug(message, payload) {
    if (!DEBUG) return;
    console.info(`[PAF Tracking] ${message}`, payload || "");
  }

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function removeStorage(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage is optional; the page continues to work without it.
    }
  }

  function loadScript(src, id) {
    if (document.getElementById(id)) return;

    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  }

  function updateGoogleConsent(value) {
    window.gtag("consent", "update", {
      ad_storage: value,
      ad_user_data: value,
      ad_personalization: value,
      analytics_storage: value,
    });
  }

  function loadGoogleMeasurement() {
    window.gtag("js", new Date());
    window.gtag("config", CONFIG.ga4Id, {
      send_page_view: true,
      page_title: document.title,
      page_location: window.location.href,
      page_path: `${window.location.pathname}${window.location.search}`,
      page_variant: state.pageVariant,
      product_name: CONFIG.productName,
    });

    loadScript(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(CONFIG.ga4Id)}`,
      "paf-ga4",
    );

    window.dataLayer.push({
      "gtm.start": Date.now(),
      event: "gtm.js",
    });
    loadScript(
      `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(CONFIG.gtmId)}`,
      "paf-gtm",
    );
  }

  function loadMetaPixel() {
    if (!window.fbq) {
      const fbq = function fbq() {
        fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
      };

      window.fbq = fbq;
      window._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
    }

    loadScript("https://connect.facebook.net/en_US/fbevents.js", "paf-meta-pixel");
    window.fbq("init", CONFIG.metaPixelId);
    window.fbq("track", "PageView");
    window.fbq("track", "ViewContent", {
      content_name: CONFIG.productName,
      content_category: `sales_page_${state.pageVariant}`,
      content_type: "product",
      value: CONFIG.price,
      currency: CONFIG.currency,
    });
  }

  function loadClarity() {
    window.clarity =
      window.clarity ||
      function clarity() {
        (window.clarity.q = window.clarity.q || []).push(arguments);
      };

    loadScript(
      `https://www.clarity.ms/tag/${encodeURIComponent(CONFIG.clarityId)}`,
      "paf-clarity",
    );
    window.clarity("set", "page_variant", state.pageVariant);
    window.clarity("set", "product", "protocolo_antiflacidez");
  }

  function startTrackers() {
    if (state.trackersLoaded || state.consent !== "granted") return;

    state.trackersLoaded = true;
    updateGoogleConsent("granted");
    persistCurrentAttribution();
    loadGoogleMeasurement();
    loadMetaPixel();
    loadClarity();

    window.setTimeout(() => {
      trackEvent("tracking_ready", {
        consent_status: "granted",
      });
      state.recheckers.forEach((recheck) => recheck());
    }, 0);

    debug("Trackers carregados", CONFIG);
  }

  function cleanEventParams(params = {}) {
    return Object.fromEntries(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => {
          if (typeof value === "string") return [key, value.slice(0, 100)];
          return [key, value];
        }),
    );
  }

  function createEventId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function trackEvent(name, params = {}) {
    if (state.consent !== "granted" || !state.trackersLoaded) return false;

    const payload = cleanEventParams({
      event_id: createEventId(),
      page_variant: state.pageVariant,
      product_name: CONFIG.productName,
      ...params,
    });

    window.dataLayer.push({
      event: `paf_${name}`,
      paf_event_name: name,
      ...payload,
    });

    window.gtag("event", name, {
      ...payload,
      send_to: CONFIG.ga4Id,
      transport_type: "beacon",
    });

    if (window.fbq) {
      window.fbq("trackCustom", toMetaEventName(name), payload);
    }

    if (window.clarity) {
      window.clarity("event", `paf_${name}`);
    }

    debug(`Evento: ${name}`, payload);
    return true;
  }

  function toMetaEventName(name) {
    return name
      .split("_")
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join("")
      .slice(0, 50);
  }

  function currentAttribution() {
    const attribution = {};

    new URLSearchParams(window.location.search).forEach((value, key) => {
      if (ALLOWED_ATTRIBUTION_PARAM.test(key) && value) {
        attribution[key.toLowerCase()] = value.slice(0, 200);
      }
    });

    return attribution;
  }

  function storedAttribution() {
    try {
      return JSON.parse(readStorage(ATTRIBUTION_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function persistCurrentAttribution() {
    if (state.consent !== "granted") return;

    const attribution = currentAttribution();
    if (!Object.keys(attribution).length) return;

    writeStorage(
      ATTRIBUTION_KEY,
      JSON.stringify({
        ...storedAttribution(),
        ...attribution,
      }),
    );
  }

  function isKiwifyCheckout(url) {
    return url.hostname === "pay.kiwify.com.br" || url.hostname.endsWith(".kiwify.com.br");
  }

  function decorateCheckoutUrl(href) {
    try {
      const url = new URL(href, window.location.href);
      if (!isKiwifyCheckout(url)) return href;

      const attribution = {
        ...(state.consent === "granted" ? storedAttribution() : {}),
        ...currentAttribution(),
      };

      Object.entries(attribution).forEach(([key, value]) => {
        if (!url.searchParams.has(key)) url.searchParams.set(key, value);
      });

      return url.toString();
    } catch {
      return href;
    }
  }

  function decorateCheckoutLinks() {
    document.querySelectorAll(CHECKOUT_SELECTOR).forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      link.href = decorateCheckoutUrl(href);
      link.rel = "noopener";
    });
  }

  function safeLinkDestination(href) {
    try {
      const url = new URL(href, window.location.href);
      return `${url.origin}${url.pathname}`;
    } catch {
      return "unknown";
    }
  }

  function checkoutPosition(link) {
    const links = [...document.querySelectorAll(CHECKOUT_SELECTOR)];
    return Math.max(1, links.indexOf(link) + 1);
  }

  function setupCheckoutTracking() {
    decorateCheckoutLinks();

    document.addEventListener("click", (event) => {
      const link = event.target.closest(CHECKOUT_SELECTOR);
      if (!link) return;

      const href = link.getAttribute("href") || "";
      link.href = decorateCheckoutUrl(href);

      trackEvent("checkout_click", {
        link_position: checkoutPosition(link),
        link_text: link.textContent.trim().replace(/\s+/g, " ").slice(0, 80),
        link_url: safeLinkDestination(link.href),
        value: CONFIG.price,
        currency: CONFIG.currency,
      });
    });
  }

  function getScrollPercent() {
    const root = document.documentElement;
    const scrollable = Math.max(1, root.scrollHeight - window.innerHeight);
    return Math.min(100, Math.round((window.scrollY / scrollable) * 100));
  }

  function measureScrollDepth() {
    const percent = getScrollPercent();

    [25, 50, 75, 90].forEach((threshold) => {
      if (percent < threshold || state.sentScrollDepths.has(threshold)) return;

      if (trackEvent("scroll_depth", { percent_scrolled: threshold })) {
        state.sentScrollDepths.add(threshold);
      }
    });
  }

  function setupScrollTracking() {
    let frame = 0;

    window.addEventListener(
      "scroll",
      () => {
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          measureScrollDepth();
          frame = 0;
        });
      },
      { passive: true },
    );

    state.recheckers.add(measureScrollDepth);
  }

  function setupEngagementTracking() {
    let engagedSeconds = 0;
    const milestones = [15, 30, 60, 120];

    window.setInterval(() => {
      if (document.hidden || state.consent !== "granted") return;
      engagedSeconds += 1;

      milestones.forEach((seconds) => {
        if (engagedSeconds < seconds || state.sentEngagementTimes.has(seconds)) return;

        if (trackEvent("engagement_time", { engaged_seconds: seconds })) {
          state.sentEngagementTimes.add(seconds);
        }
      });
    }, 1000);
  }

  function setupOfferTracking() {
    const candidates = [
      ...document.querySelectorAll(
        "#oferta, #offer-price, [data-first-offer], [data-first-price]",
      ),
    ];
    const seen = new WeakSet();

    if (!candidates.length || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || seen.has(entry.target)) return;

          const tracked = trackEvent("offer_view", {
            offer_id: entry.target.id || "primary_offer",
          });

          if (tracked) {
            seen.add(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 },
    );

    candidates.forEach((candidate) => observer.observe(candidate));
  }

  function setupFaqTracking() {
    document.querySelectorAll("details.faq-item").forEach((item) => {
      item.addEventListener("toggle", () => {
        if (!item.open) return;
        trackEvent("faq_open", {
          faq_question:
            item.querySelector("summary")?.textContent.trim().replace(/\s+/g, " ").slice(0, 90) ||
            "unknown",
        });
      });
    });
  }

  function setupProofTracking() {
    let tracked = false;

    document.addEventListener("click", (event) => {
      if (
        tracked ||
        !event.target.closest(
          "[data-carousel-prev], [data-carousel-next], [data-carousel-dots], .proof-carousel",
        )
      ) {
        return;
      }

      tracked = trackEvent("proof_engagement", {
        interaction_type: "carousel",
      });
    });
  }

  function setupVslTracking() {
    const video = document.querySelector("[data-vsl-video]");
    if (!video) return;

    let started = false;
    let offerRevealTracked = false;
    const postVsl = document.querySelector("[data-post-vsl]");

    const trackOfferReveal = (source = "dom_state") => {
      if (offerRevealTracked || postVsl?.hidden) return;

      offerRevealTracked = trackEvent("vsl_offer_revealed", {
        reveal_source: source,
      });
    };

    video.addEventListener("play", () => {
      if (started) return;
      started = trackEvent("vsl_start", {
        video_title: "VSL Antiflacidez",
      });
    });

    video.addEventListener(
      "timeupdate",
      () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) return;
        const percent = Math.floor((video.currentTime / video.duration) * 100);

        [25, 50, 75, 90].forEach((milestone) => {
          if (percent < milestone || state.sentVideoMilestones.has(milestone)) return;

          if (
            trackEvent("vsl_progress", {
              video_percent: milestone,
              video_title: "VSL Antiflacidez",
            })
          ) {
            state.sentVideoMilestones.add(milestone);
          }
        });
      },
      { passive: true },
    );

    video.addEventListener("ended", () => {
      trackEvent("vsl_complete", {
        video_percent: 100,
        video_title: "VSL Antiflacidez",
      });
    });

    window.addEventListener("paf:vsl-offer-revealed", (event) => {
      trackOfferReveal(event.detail?.source || "video_complete");
    });

    state.recheckers.add(() => trackOfferReveal("stored_completion"));
  }

  function setupQuizTracking() {
    window.addEventListener("paf:quiz-step", (event) => {
      const step = String(event.detail?.step || "");

      if (step === "q1") {
        trackEvent("quiz_start", { quiz_name: "avaliacao_antiflacidez" });
        return;
      }

      if (/^q[2-7]$/.test(step)) {
        trackEvent("quiz_progress", {
          quiz_name: "avaliacao_antiflacidez",
          question_number: Number(step.slice(1)),
        });
        return;
      }

      if (step === "result") {
        trackEvent("quiz_complete", {
          quiz_name: "avaliacao_antiflacidez",
          questions_completed: 7,
        });
      }
    });

    window.addEventListener("paf:quiz-answer", (event) => {
      const question = String(event.detail?.question || "");
      trackEvent("quiz_answer", {
        quiz_name: "avaliacao_antiflacidez",
        question_number: Number(question.replace(/\D/g, "")) || 0,
      });
    });

    window.addEventListener("paf:quiz-offer-revealed", () => {
      trackEvent("quiz_offer_revealed", {
        quiz_name: "avaliacao_antiflacidez",
      });
    });
  }

  function clearOptionalCookies() {
    const optionalCookiePattern = /^(_ga|_gid|_gat|_fbp|_fbc|_clck|_clsk)/;

    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0]?.trim();
      if (!name || !optionalCookiePattern.test(name)) return;
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    });
  }

  function applyConsent(choice) {
    const wasLoaded = state.trackersLoaded;
    state.consent = choice;
    writeStorage(CONSENT_KEY, choice);

    if (choice === "granted") {
      updateGoogleConsent("granted");
      startTrackers();
      return;
    }

    updateGoogleConsent("denied");
    removeStorage(ATTRIBUTION_KEY);
    clearOptionalCookies();

    if (wasLoaded) {
      window.setTimeout(() => window.location.reload(), 120);
    }
  }

  function createConsentUi() {
    const panel = document.createElement("aside");
    panel.className = "paf-consent";
    panel.dataset.consentPanel = "";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "paf-consent-title");
    panel.hidden = true;
    panel.innerHTML = `
      <div class="paf-consent__copy">
        <strong id="paf-consent-title">Sua privacidade importa</strong>
        <p>
          Usamos cookies opcionais para medir visitas e melhorar esta página com Google Analytics,
          Google Tag Manager, Meta Pixel e Microsoft Clarity. A Kiwify processa o checkout e as compras.
        </p>
        <details>
          <summary>Como os dados são usados</summary>
          <p>
            Medimos navegação, rolagem, tempo, cliques, reprodução da VSL e avanço no quiz. Não
            enviamos às plataformas as respostas individuais do quiz, nome, e-mail ou telefone.
            Você pode mudar sua escolha a qualquer momento em “Privacidade”.
          </p>
        </details>
      </div>
      <div class="paf-consent__actions">
        <button type="button" class="paf-consent__reject" data-consent-reject>
          Recusar opcionais
        </button>
        <button type="button" class="paf-consent__accept" data-consent-accept>
          Aceitar e continuar
        </button>
      </div>
    `;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "paf-privacy-trigger";
    trigger.dataset.consentSettings = "";
    trigger.textContent = "Privacidade";
    trigger.hidden = true;

    document.body.append(panel, trigger);

    const showPanel = () => {
      panel.hidden = false;
      trigger.hidden = true;
      window.requestAnimationFrame(() => panel.classList.add("is-visible"));
    };

    const hidePanel = () => {
      panel.classList.remove("is-visible");
      window.setTimeout(() => {
        panel.hidden = true;
        trigger.hidden = false;
      }, 180);
    };

    panel.querySelector("[data-consent-accept]").addEventListener("click", () => {
      applyConsent("granted");
      hidePanel();
    });

    panel.querySelector("[data-consent-reject]").addEventListener("click", () => {
      applyConsent("denied");
      hidePanel();
    });

    trigger.addEventListener("click", showPanel);

    if (state.consent === "granted" || state.consent === "denied") {
      trigger.hidden = false;
    } else {
      showPanel();
    }
  }

  function init() {
    createConsentUi();
    setupCheckoutTracking();
    setupScrollTracking();
    setupEngagementTracking();
    setupOfferTracking();
    setupFaqTracking();
    setupProofTracking();
    setupVslTracking();
    setupQuizTracking();

    if (state.consent === "granted") {
      startTrackers();
    } else {
      updateGoogleConsent("denied");
    }
  }

  window.PAFTracking = Object.freeze({
    track: trackEvent,
    decorateCheckoutLinks,
    getConsent: () => state.consent,
    getConfig: () => ({ ...CONFIG, pageVariant: state.pageVariant }),
  });

  init();
})();
