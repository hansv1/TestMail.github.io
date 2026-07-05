const menuToggle = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');

menuToggle?.addEventListener('click', () => {
  const isOpen = menu.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

menu?.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (link && !link.classList.contains('nav__dropdown-toggle')) {
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

// Lógica para abrir/cerrar dropdowns en móviles y tabletas
const dropdowns = document.querySelectorAll('.nav__dropdown');
dropdowns.forEach(dropdown => {
  const toggle = dropdown.querySelector('.nav__dropdown-toggle');
  toggle?.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      const menu = dropdown.querySelector('.nav__dropdown-menu');
      const isVisible = window.getComputedStyle(menu).display !== 'none';
      
      // Si el menú está cerrado, prevenimos navegación y lo abrimos
      if (!isVisible) {
        e.preventDefault();
        dropdowns.forEach(d => d.classList.remove('is-active'));
        dropdown.classList.add('is-active');
      }
    }
  });
});

// Cerrar desplegables si se hace clic fuera de ellos
document.addEventListener('click', (e) => {
  if (!e.target.closest('.nav__dropdown')) {
    dropdowns.forEach(d => d.classList.remove('is-active'));
  }
});