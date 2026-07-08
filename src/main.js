const CHECKOUT_URL = "#oferta";

const checkoutLinks = document.querySelectorAll("[data-checkout-link]");
const mobileSticky = document.querySelector("[data-mobile-sticky]");

checkoutLinks.forEach((link) => {
  link.setAttribute("href", CHECKOUT_URL);
});

function handleStickyButton() {
  if (!mobileSticky) return;

  const shouldShow = window.scrollY > 420;
  mobileSticky.classList.toggle("is-visible", shouldShow);
}

window.addEventListener("scroll", handleStickyButton, { passive: true });
handleStickyButton();
