const CHECKOUT_URL = "https://pay.kiwify.com.br/z5U6HnE";
const SESSION_KEY = "gamarra:avaliacao-antiflacidez:answers:v1";
const ANSWER_DELAY = 560;
const TRANSITION_DELAY = 220;

const flow = [
  "intro",
  "q1",
  "q2",
  "q3",
  "checkpoint-1",
  "q4",
  "q5",
  "q6",
  "checkpoint-2",
  "q7",
  "processing",
  "result",
];

const nextStep = {
  q1: "q2",
  q2: "q3",
  q3: "checkpoint-1",
  q4: "q5",
  q5: "q6",
  q6: "checkpoint-2",
  q7: "processing",
};

const questionProgress = {
  q1: 14,
  q2: 28,
  q3: 43,
  "checkpoint-1": 43,
  q4: 57,
  q5: 71,
  q6: 86,
  "checkpoint-2": 86,
  q7: 100,
  processing: 100,
  result: 100,
};

const processingMessages = [
  "Entendendo seu ponto de partida…",
  "Analisando sua rotina atual…",
  "Identificando seus principais obstáculos…",
  "Selecionando uma recomendação…",
  "Finalizando seu resultado…",
];

const profileRecommendations = {
  "3x": "Uma rotina de três treinos por semana pode ser o ponto de partida mais possível para você.",
  "4x":
    "Você pode começar pelo protocolo que melhor se encaixa na sua semana e ajustar sua frequência com clareza.",
  "5x": "Uma rotina de cinco treinos por semana pode combinar com a frequência que você considera possível.",
  ajuda:
    "Começar organizando uma rotina possível é mais importante do que tentar seguir uma frequência perfeita.",
};

const legalContent = {
  terms: {
    title: "Termos de Uso",
    body:
      "O Protocolo Antiflacidez é um produto digital, educativo e autoguiado. O acesso, pagamento, garantia e reembolso seguem as condições apresentadas nesta página e as regras da plataforma Kiwify. Antes da publicação, substitua este resumo pelos termos jurídicos definitivos da empresa.",
  },
  privacy: {
    title: "Política de Privacidade",
    body:
      "As respostas desta avaliação são usadas somente no navegador para apresentar uma recomendação educativa e não são enviadas individualmente às plataformas de publicidade. Com autorização no painel de privacidade, Google Analytics, Google Tag Manager, Meta Pixel e Microsoft Clarity medem navegação, progresso, cliques e uso da página. A Kiwify processa o checkout e a compra. Você pode recusar ou rever sua escolha no botão “Privacidade”.",
  },
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const state = {
  activeStep: "intro",
  answers: getStoredAnswers(),
  history: [],
  transitioning: false,
  offerVisible: false,
};

function notifyTracking(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(`paf:${name}`, { detail }));
}

function getStoredAnswers() {
  try {
    return JSON.parse(window.sessionStorage.getItem(SESSION_KEY) || "{}");
  } catch {
    return {};
  }
}

function storeAnswers() {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.answers));
  } catch {
    // The experience still works if session storage is unavailable.
  }
}

function getCheckoutUrl() {
  const checkout = new URL(CHECKOUT_URL);
  const currentParams = new URLSearchParams(window.location.search);

  currentParams.forEach((value, key) => {
    if (/^(utm_|src$|sck$)/i.test(key)) checkout.searchParams.set(key, value);
  });

  return checkout.toString();
}

function setupCheckoutLinks() {
  const checkoutUrl = getCheckoutUrl();

  document.querySelectorAll("[data-checkout]").forEach((link) => {
    link.href = checkoutUrl;
    link.rel = "noopener";
  });
}

function getStep(name) {
  return document.querySelector(`[data-step="${name}"]`);
}

function setProgress(stepName) {
  const shell = document.querySelector("[data-progress-shell]");
  const progress = document.querySelector("[data-progress]");
  const label = document.querySelector("[data-progress-label]");
  const number = document.querySelector("[data-progress-number]");
  const headerStatus = document.querySelector("[data-header-status]");
  const questionNumber = Number(stepName.replace("q", ""));
  const value = questionProgress[stepName] ?? 0;

  if (stepName === "intro") {
    shell.hidden = true;
    headerStatus.textContent = "AVALIAÇÃO GRATUITA";
    return;
  }

  shell.hidden = false;
  progress.style.setProperty("--progress", `${value}%`);
  progress.setAttribute("aria-valuenow", String(value));
  number.textContent = `${value}%`;

  if (Number.isFinite(questionNumber)) {
    label.textContent = `PERGUNTA ${questionNumber} DE 7`;
    headerStatus.textContent = "SEU PERFIL";
  } else if (stepName.startsWith("checkpoint")) {
    label.textContent = "ANÁLISE DO PERFIL";
    headerStatus.textContent = "ANÁLISE EM ANDAMENTO";
  } else if (stepName === "processing") {
    label.textContent = "FINALIZANDO A AVALIAÇÃO";
    headerStatus.textContent = "PROCESSANDO";
  } else {
    label.textContent = "AVALIAÇÃO CONCLUÍDA";
    headerStatus.textContent = "RESULTADO PRONTO";
  }
}

function setBackButton(stepName) {
  const backButton = document.querySelector("[data-back]");
  const blocked = ["intro", "processing", "result"].includes(stepName);
  backButton.hidden = blocked || state.history.length === 0;
}

function restoreAnswerState(stepName) {
  const buttons = document.querySelectorAll(`[data-answer="${stepName}"]`);
  const selectedValue = state.answers[stepName];

  buttons.forEach((button) => {
    const selected = button.dataset.value === selectedValue;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.disabled = false;
  });
}

function focusActiveStep(step) {
  const focusTarget = step.querySelector("h1, h2, button, [tabindex]");
  if (!focusTarget) return;

  focusTarget.setAttribute("tabindex", "-1");
  focusTarget.focus({ preventScroll: true });
  focusTarget.addEventListener(
    "blur",
    () => {
      focusTarget.removeAttribute("tabindex");
    },
    { once: true },
  );
}

async function showStep(stepName, { remember = true, focus = true } = {}) {
  if (state.transitioning || stepName === state.activeStep) return;

  const current = getStep(state.activeStep);
  const target = getStep(stepName);
  if (!current || !target) return;

  state.transitioning = true;

  if (remember) state.history.push(state.activeStep);

  current.classList.add("is-leaving");
  await wait(reduceMotion.matches ? 0 : TRANSITION_DELAY);
  current.hidden = true;
  current.classList.remove("is-active", "is-leaving", "is-entering");

  state.activeStep = stepName;
  target.hidden = false;
  target.classList.add("is-active", "is-entering");
  notifyTracking("quiz-step", { step: stepName });
  restoreAnswerState(stepName);
  setProgress(stepName);
  setBackButton(stepName);

  window.scrollTo({ top: 0, behavior: "auto" });

  if (focus) {
    window.requestAnimationFrame(() => focusActiveStep(target));
  }

  await wait(reduceMotion.matches ? 0 : 460);
  target.classList.remove("is-entering");
  state.transitioning = false;

  if (stepName === "processing") runProcessing();
  if (stepName === "result") updateResultPersonalization();
}

function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

async function selectAnswer(button) {
  if (state.transitioning || button.disabled) return;

  const question = button.dataset.answer;
  const value = button.dataset.value;
  const buttons = document.querySelectorAll(`[data-answer="${question}"]`);

  buttons.forEach((item) => {
    const selected = item === button;
    item.classList.toggle("is-selected", selected);
    item.setAttribute("aria-pressed", String(selected));
    item.disabled = true;
  });

  state.answers[question] = value;
  storeAnswers();
  notifyTracking("quiz-answer", { question });

  await wait(reduceMotion.matches ? 0 : ANSWER_DELAY);
  await showStep(nextStep[question]);
}

async function goBack() {
  if (state.transitioning || state.history.length === 0) return;

  const previous = state.history.pop();
  await showStep(previous, { remember: false });
}

function resetProcessing() {
  document.querySelectorAll("[data-processing-item]").forEach((item) => {
    item.classList.remove("is-complete");
  });

  const gauge = document.querySelector("[data-gauge]");
  const percent = document.querySelector("[data-processing-percent]");
  const message = document.querySelector("[data-processing-message]");

  gauge.style.setProperty("--processing", "0");
  percent.textContent = "0%";
  message.textContent = processingMessages[0];
}

async function runProcessing() {
  resetProcessing();

  const items = [...document.querySelectorAll("[data-processing-item]")];
  const gauge = document.querySelector("[data-gauge]");
  const percent = document.querySelector("[data-processing-percent]");
  const message = document.querySelector("[data-processing-message]");

  for (let index = 0; index < items.length; index += 1) {
    if (state.activeStep !== "processing") return;

    await wait(reduceMotion.matches ? 80 : 820);
    const value = (index + 1) * 20;

    items[index].classList.add("is-complete");
    gauge.style.setProperty("--processing", String(value));
    percent.textContent = `${value}%`;
    message.textContent = processingMessages[index];
  }

  await wait(reduceMotion.matches ? 80 : 620);
  await showStep("result");
}

function updateResultPersonalization() {
  const recommendation = document.querySelector("[data-profile-recommendation]");
  recommendation.textContent =
    profileRecommendations[state.answers.q7] ||
    "Uma rotina organizada para começar com mais direção.";
}

function showOffer() {
  if (state.offerVisible) return;
  state.offerVisible = true;

  const assessment = document.querySelector("[data-assessment]");
  const offer = document.querySelector("[data-offer]");
  const header = document.querySelector("[data-quiz-header]");
  const mobileCheckout = document.querySelector("[data-mobile-checkout]");

  assessment.hidden = true;
  header.hidden = true;
  offer.hidden = false;
  offer.setAttribute("aria-hidden", "false");
  notifyTracking("quiz-offer-revealed");

  window.requestAnimationFrame(() => {
    offer.classList.add("is-revealed");
    setupScrollReveals();
    setupMobileCheckout();
    document.querySelector("#recommendation")?.scrollIntoView({
      behavior: reduceMotion.matches ? "auto" : "smooth",
      block: "start",
    });
  });

  mobileCheckout.removeAttribute("inert");
}

function setupScrollReveals() {
  const elements = document.querySelectorAll(".reveal-on-scroll:not(.is-visible)");

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );

  elements.forEach((element) => observer.observe(element));
}

function setupCarousel() {
  const carousel = document.querySelector("[data-carousel]");
  const previous = document.querySelector("[data-carousel-prev]");
  const next = document.querySelector("[data-carousel-next]");
  const current = document.querySelector("[data-carousel-current]");
  if (!carousel || !previous || !next || !current) return;
  const totalCards = carousel.querySelectorAll(".proof-card").length;

  function getStepWidth() {
    const card = carousel.querySelector(".proof-card");
    const styles = window.getComputedStyle(carousel);
    return (card?.getBoundingClientRect().width || 320) + parseFloat(styles.columnGap || "0");
  }

  function updateCurrent() {
    const index = Math.round(carousel.scrollLeft / getStepWidth()) + 1;
    current.textContent = String(Math.max(1, Math.min(totalCards, index))).padStart(2, "0");
  }

  previous.addEventListener("click", () => {
    carousel.scrollBy({ left: -getStepWidth(), behavior: "smooth" });
  });

  next.addEventListener("click", () => {
    carousel.scrollBy({ left: getStepWidth(), behavior: "smooth" });
  });

  let scheduled = false;
  carousel.addEventListener(
    "scroll",
    () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        updateCurrent();
        scheduled = false;
      });
    },
    { passive: true },
  );
}

function setupFaq() {
  const items = [...document.querySelectorAll(".faq-item")];

  items.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      items.forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });
}

function setupMobileCheckout() {
  const mobileCheckout = document.querySelector("[data-mobile-checkout]");
  const firstPrice = document.querySelector("[data-first-price]");
  const finalOffer = document.querySelector(".final-offer");
  if (!mobileCheckout || !firstPrice || !finalOffer) return;

  if (!("IntersectionObserver" in window)) {
    mobileCheckout.classList.add("is-visible");
    mobileCheckout.setAttribute("aria-hidden", "false");
    return;
  }

  let passedFirstPrice = false;
  let finalOfferVisible = false;

  function update() {
    const visible = passedFirstPrice && !finalOfferVisible;
    mobileCheckout.classList.toggle("is-visible", visible);
    mobileCheckout.setAttribute("aria-hidden", String(!visible));
    mobileCheckout.inert = !visible;
  }

  const priceObserver = new IntersectionObserver(([entry]) => {
    passedFirstPrice = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    update();
  });

  const finalObserver = new IntersectionObserver(([entry]) => {
    finalOfferVisible = entry.isIntersecting;
    update();
  });

  priceObserver.observe(firstPrice);
  finalObserver.observe(finalOffer);
}

function setupLegalDialog() {
  const dialog = document.querySelector("[data-legal-dialog]");
  const content = document.querySelector("[data-legal-content]");
  const close = document.querySelector("[data-legal-close]");
  if (!dialog || !content || !close) return;

  document.querySelectorAll("[data-legal]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = legalContent[button.dataset.legal];
      if (!item) return;

      content.innerHTML = `<h2>${item.title}</h2><p>${item.body}</p>`;
      dialog.showModal();
    });
  });

  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function setupQuiz() {
  document.querySelector("[data-start]")?.addEventListener("click", () => showStep("q1"));
  document.querySelector("[data-back]")?.addEventListener("click", goBack);

  document.querySelectorAll("[data-answer]").forEach((button) => {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => selectAnswer(button));
  });

  document.querySelectorAll("[data-continue]").forEach((button) => {
    button.addEventListener("click", () => showStep(button.dataset.continue));
  });

  document.querySelector("[data-show-offer]")?.addEventListener("click", showOffer);
}

function init() {
  setupCheckoutLinks();
  setupQuiz();
  setupCarousel();
  setupFaq();
  setupLegalDialog();
  setProgress("intro");
  setBackButton("intro");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
