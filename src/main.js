const CHECKOUT_URL = "https://pay.kiwify.com.br/z5U6HnE";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function getScrollBehavior() {
  return reduceMotion.matches ? "auto" : "smooth";
}

function setCheckoutLinks() {
  document.querySelectorAll("[data-checkout-link]").forEach((link) => {
    link.href = CHECKOUT_URL;
    link.rel = "noopener";
  });
}

function setupStickyButton() {
  const sticky = document.querySelector("[data-mobile-sticky]");
  const trigger = document.querySelector("#oferta");

  if (!sticky || !trigger) return;

  const setVisibility = (visible) => {
    sticky.classList.toggle("is-visible", visible);
    sticky.setAttribute("aria-hidden", String(!visible));
    sticky.inert = !visible;
  };

  setVisibility(false);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        const passedOffer = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setVisibility(passedOffer);
      },
      { threshold: 0 },
    );

    observer.observe(trigger);
    return;
  }

  let frame = 0;

  const update = () => {
    setVisibility(trigger.getBoundingClientRect().bottom < 0);
    frame = 0;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    },
    { passive: true },
  );
}

function setupCarousel() {
  const carousel = document.querySelector("[data-carousel]");

  if (!carousel) return;

  const track = carousel.querySelector("[data-carousel-track]");
  const previous = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");
  const dots = carousel.querySelector("[data-carousel-dots]");

  if (!track || !previous || !next || !dots) return;

  const slides = [...track.querySelectorAll(".testimonial-card")];

  if (!slides.length) return;

  track.id ||= "provas-sociais";
  track.tabIndex = 0;
  track.setAttribute("aria-label", "Resultados de alunas");

  let positions = [];
  let dotButtons = [];
  let scrollFrame = 0;

  function calculatePositions() {
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const candidates = slides.map((slide) => Math.min(slide.offsetLeft, maxScroll));

    positions = candidates.filter(
      (position, index) => index === 0 || Math.abs(position - candidates[index - 1]) > 2,
    );

    dots.replaceChildren();
    dotButtons = positions.map((position, index) => {
      const dot = document.createElement("button");

      dot.type = "button";
      dot.className = "carousel-dot";
      dot.setAttribute("aria-label", `Ver resultado ${index + 1}`);
      dot.setAttribute("aria-controls", track.id);
      dot.addEventListener("click", () => scrollToPosition(position));
      dots.appendChild(dot);

      return dot;
    });

    updateControls();
  }

  function getActiveIndex() {
    return positions.reduce(
      (closest, position, index) => {
        const distance = Math.abs(track.scrollLeft - position);
        return distance < closest.distance ? { index, distance } : closest;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    ).index;
  }

  function updateControls() {
    if (!positions.length) return;

    const activeIndex = getActiveIndex();

    dotButtons.forEach((dot, index) => {
      const active = index === activeIndex;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });

    previous.disabled = activeIndex === 0;
    next.disabled = activeIndex === positions.length - 1;
  }

  function scrollToPosition(left) {
    track.scrollTo({ left, behavior: getScrollBehavior() });
  }

  function move(direction) {
    const activeIndex = getActiveIndex();
    const targetIndex = Math.max(0, Math.min(activeIndex + direction, positions.length - 1));
    scrollToPosition(positions[targetIndex]);
  }

  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));

  track.addEventListener(
    "scroll",
    () => {
      if (scrollFrame) return;

      scrollFrame = window.requestAnimationFrame(() => {
        updateControls();
        scrollFrame = 0;
      });
    },
    { passive: true },
  );

  track.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    move(event.key === "ArrowRight" ? 1 : -1);
  });

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(calculatePositions);
    resizeObserver.observe(track);
  } else {
    window.addEventListener("resize", calculatePositions, { passive: true });
  }

  calculatePositions();
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

function init() {
  setCheckoutLinks();
  setupStickyButton();
  setupCarousel();
  setupFaq();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
