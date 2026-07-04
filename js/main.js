const menuToggle = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');

menuToggle?.addEventListener('click', () => {
  const isOpen = menu.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

menu?.addEventListener('click', (event) => {
  if (event.target.matches('a')) {
    menu.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  }
});

const alert = document.querySelector('[data-alert]');
const alertClose = document.querySelector('[data-alert-close]');

alertClose?.addEventListener('click', () => {
  alert?.classList.add('is-hidden');
});

const tickerTrack = document.querySelector('.ticker__track');
const tickerGroup = document.querySelector('.ticker__group');

if (tickerTrack && tickerGroup) {
  const updateTickerWidth = () => {
    tickerTrack.style.setProperty('--ticker-width', `${tickerGroup.offsetWidth}px`);
  };

  updateTickerWidth();
  window.addEventListener('resize', updateTickerWidth);
}