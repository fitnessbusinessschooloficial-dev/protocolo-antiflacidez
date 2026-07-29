const CHECKOUT_URL = "https://pay.kiwify.com.br/z5U6HnE";
const UNLOCK_KEY = "gamarra:vsl-antiflacidez:complete:v1";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function notifyTracking(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(`paf:${name}`, { detail }));
}

function setCheckoutLinks() {
  document.querySelectorAll("[data-checkout-link]").forEach((link) => {
    link.href = CHECKOUT_URL;
    link.rel = "noopener";
  });
}

function getStoredCompletion() {
  try {
    return window.localStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function storeCompletion() {
  try {
    window.localStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    // The reveal still works when storage is unavailable.
  }
}

function setupVslReveal() {
  const video = document.querySelector("[data-vsl-video]");
  const cover = document.querySelector("[data-vsl-cover]");
  const progress = document.querySelector("[data-vsl-progress]");
  const postVsl = document.querySelector("[data-post-vsl]");

  if (!video || !postVsl) return;

  let unlocked = false;
  let furthestPoint = 0;

  function unlockContent({ persist = true, scroll = true } = {}) {
    if (unlocked) return;

    unlocked = true;
    document.documentElement.classList.remove("vsl-locked");
    document.documentElement.classList.add("vsl-complete");

    postVsl.hidden = false;
    postVsl.inert = false;
    postVsl.setAttribute("aria-hidden", "false");

    window.requestAnimationFrame(() => {
      postVsl.classList.add("is-revealed");
    });

    if (persist) storeCompletion();

    notifyTracking("vsl-offer-revealed", {
      source: persist ? "video_complete" : "stored_completion",
    });

    if (scroll) {
      window.setTimeout(() => {
        postVsl.scrollIntoView({
          behavior: reduceMotion.matches ? "auto" : "smooth",
          block: "start",
        });
      }, 280);
    }
  }

  function updateProgress() {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;

    furthestPoint = Math.max(furthestPoint, video.currentTime);

    const percent = Math.min(100, (video.currentTime / video.duration) * 100);
    progress?.style.setProperty("--progress", `${percent}%`);
    progress?.setAttribute("aria-valuenow", String(Math.round(percent)));
  }

  cover?.addEventListener("click", async () => {
    cover.classList.add("is-hidden");

    try {
      await video.play();
    } catch {
      cover.classList.remove("is-hidden");
    }
  });

  video.addEventListener("play", () => {
    cover?.classList.add("is-hidden");
  });

  video.addEventListener("timeupdate", updateProgress, { passive: true });

  video.addEventListener("seeking", () => {
    if (unlocked || video.currentTime <= furthestPoint + 2.5) return;
    video.currentTime = furthestPoint;
  });

  video.addEventListener("ended", () => {
    progress?.style.setProperty("--progress", "100%");
    progress?.setAttribute("aria-valuenow", "100");
    unlockContent();
  });

  if (getStoredCompletion()) {
    unlockContent({ persist: false, scroll: false });
  }
}

function setupFaq() {
  const items = [...document.querySelectorAll(".faq-item")];

  items.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;

      items.forEach((otherItem) => {
        if (otherItem !== item) otherItem.open = false;
      });
    });
  });
}

function setupMobileOffer() {
  const mobileOffer = document.querySelector("[data-mobile-offer]");
  const firstOffer = document.querySelector("[data-first-offer]");
  const finalOffer = document.querySelector(".final-card");

  if (!mobileOffer || !firstOffer || !finalOffer || !("IntersectionObserver" in window)) return;

  let firstOfferAbove = false;
  let finalOfferVisible = false;

  function updateVisibility() {
    const visible = firstOfferAbove && !finalOfferVisible;
    mobileOffer.classList.toggle("is-visible", visible);
    mobileOffer.setAttribute("aria-hidden", String(!visible));
    mobileOffer.inert = !visible;
  }

  const firstObserver = new IntersectionObserver(([entry]) => {
    firstOfferAbove = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    updateVisibility();
  });

  const finalObserver = new IntersectionObserver(([entry]) => {
    finalOfferVisible = entry.isIntersecting;
    updateVisibility();
  });

  firstObserver.observe(firstOffer);
  finalObserver.observe(finalOffer);
}

function init() {
  setCheckoutLinks();
  setupVslReveal();
  setupFaq();
  setupMobileOffer();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
