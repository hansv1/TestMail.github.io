/**
 * HANS WEB - Sistema de Tienda Dinámica (Google Sheets + Carrito + WhatsApp)
 * 
 * Este script maneja la carga de productos, el carrito de compras, el modal
 * de detalles de productos y la finalización de compra por WhatsApp.
 */

// CONFIGURACIÓN - Reemplaza con tus datos
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgoDj2YfSqDexxPPu2HDCr8Ibw2sDtbcdxZ24l69duYbGsfLJGkVHuGXa-ETxjr7c/exec"; // URL de tu Google Apps Script Web App
const WHATSAPP_PHONE = "51999999999"; // Reemplaza con tu número de WhatsApp (código de país + número, sin el + ni espacios)
const DEFAULT_MONEDA = "S/."; // Moneda por defecto si no viene especificada en la hoja

// Función para convertir enlaces de compartir de Google Drive a URLs de imagen directas
function convertDriveUrl(url) {
  if (!url) return "";
  url = url.trim();
  
  // Expresiones regulares para capturar el ID del archivo de Google Drive
  const driveViewRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const driveOpenRegex = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
  const driveUcRegex = /drive\.google\.com\/uc\?(?:export=view&)?id=([a-zA-Z0-9_-]+)/;
  
  let fileId = "";
  
  if (driveViewRegex.test(url)) {
    fileId = url.match(driveViewRegex)[1];
  } else if (driveOpenRegex.test(url)) {
    fileId = url.match(driveOpenRegex)[1];
  } else if (driveUcRegex.test(url)) {
    fileId = url.match(driveUcRegex)[1];
  }
  
  if (fileId) {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }
  
  return url;
}

// Estado global de la tienda
let allProducts = [];
let filteredProducts = [];
let cart = [];
let currentCategory = ""; // Se asigna dinámicamente

// Inicialización cuando carga el documento
document.addEventListener("DOMContentLoaded", () => {
  detectCategory();
  initCart();
  injectUIComponents();
  loadProducts();
});

// 1. Detectar categoría actual según el archivo HTML
function detectCategory() {
  const path = window.location.pathname;
  if (path.includes("windowsoffice.html")) {
    currentCategory = "windows-office";
  } else if (path.includes("programas.html")) {
    currentCategory = "programas";
  } else if (path.includes("streaming.html")) {
    currentCategory = "streaming";
  } else {
    currentCategory = "all"; // tienda.html
  }
}

// 2. Cargar estado del carrito de localStorage
function initCart() {
  const savedCart = localStorage.getItem("hans_web_cart");
  if (savedCart) {
    try {
      cart = JSON.parse(savedCart);
    } catch (e) {
      cart = [];
    }
  }
}

// Guardar carrito en localStorage
function saveCart() {
  localStorage.setItem("hans_web_cart", JSON.stringify(cart));
  updateCartCounters();
}

// 3. Inyectar componentes UI dinámicos en la página
function injectUIComponents() {
  // Solo inyectar si estamos en una de las páginas de la tienda válidas
  const activePages = ["windowsoffice.html", "streaming.html", "programas.html", "tienda.html"];
  const isStorePage = activePages.some(page => window.location.pathname.includes(page));
  
  if (!isStorePage) return;

  // A. Inyectar el botón del carrito en el header (junto al menú de navegación)
  const navMenu = document.querySelector('[data-menu]');
  if (navMenu) {
    const cartBtnContainer = document.createElement("div");
    cartBtnContainer.className = "nav__cart-btn-wrapper";
    cartBtnContainer.style.display = "inline-flex";
    cartBtnContainer.style.alignItems = "center";
    cartBtnContainer.style.marginLeft = "12px";

    const cartNavBtn = document.createElement("button");
    cartNavBtn.type = "button";
    cartNavBtn.className = "nav__cart-btn";
    cartNavBtn.innerHTML = `
      <i class="fas fa-shopping-cart"></i>
      <span>Carrito</span>
      <span class="nav__cart-badge" id="nav-cart-badge">0</span>
    `;
    cartNavBtn.addEventListener("click", () => openCart());
    cartBtnContainer.appendChild(cartNavBtn);
    navMenu.appendChild(cartBtnContainer);
  }

  // B. Inyectar el botón flotante del carrito
  const floatingBtn = document.createElement("button");
  floatingBtn.type = "button";
  floatingBtn.className = "cart-floating-btn";
  floatingBtn.id = "cart-floating-btn";
  floatingBtn.ariaLabel = "Abrir carrito de compras";
  floatingBtn.innerHTML = `
    <i class="fas fa-shopping-cart"></i>
    <span class="cart-badge" id="cart-floating-badge" style="display: none;">0</span>
  `;
  floatingBtn.addEventListener("click", () => openCart());
  document.body.appendChild(floatingBtn);

  // C. Inyectar el panel del Carrito Lateral (Drawer)
  const cartDrawer = document.createElement("div");
  cartDrawer.className = "cart-drawer";
  cartDrawer.id = "cart-drawer";
  cartDrawer.innerHTML = `
    <div class="cart-drawer__overlay" id="cart-drawer-overlay"></div>
    <div class="cart-drawer__container">
      <div class="cart-drawer__header">
        <h3 class="cart-drawer__title">
          <i class="fas fa-shopping-cart"></i> Tu Pedido
        </h3>
        <button class="cart-drawer__close" id="cart-drawer-close" aria-label="Cerrar carrito">&times;</button>
      </div>
      <div class="cart-drawer__content">
        <div class="cart-list" id="cart-items-list">
          <!-- Se llena dinámicamente -->
        </div>
        <div class="checkout-form" id="cart-checkout-form" style="display: none;">
          <h4 class="checkout-form__title">Datos del Pedido</h4>
          <div class="form-group">
            <label for="checkout-name">Tu Nombre Completo</label>
            <input type="text" id="checkout-name" class="form-control" placeholder="Ej. Juan Pérez" required>
          </div>
          <div class="form-group">
            <label for="checkout-payment">Método de Pago Preferido</label>
            <select id="checkout-payment" class="form-control">
              <option value="Yape/Plin">Yape / Plin</option>
              <option value="Transferencia Bancaria">Transferencia Bancaria (BCP, BBVA, Interbank)</option>
              <option value="PayPal">PayPal</option>
              <option value="Tarjeta Crédito/Débito">Tarjeta de Crédito / Débito</option>
            </select>
          </div>
        </div>
      </div>
      <div class="cart-drawer__footer">
        <div class="cart-summary">
          <div class="cart-summary-row">
            <span>Productos:</span>
            <span id="cart-summary-qty">0 items</span>
          </div>
          <div class="cart-summary-row cart-summary-row--total">
            <span>Total estimado:</span>
            <span id="cart-summary-total">S/. 0.00</span>
          </div>
        </div>
        <button class="btn-checkout" id="cart-checkout-btn" disabled>
          <i class="fab fa-whatsapp"></i> Finalizar Pedido por WhatsApp
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(cartDrawer);

  // Eventos para cerrar carrito
  document.getElementById("cart-drawer-close").addEventListener("click", () => closeCart());
  document.getElementById("cart-drawer-overlay").addEventListener("click", () => closeCart());
  document.getElementById("cart-checkout-btn").addEventListener("click", () => processCheckout());

  // D. Inyectar el Modal de Detalle
  const storeModal = document.createElement("div");
  storeModal.className = "store-modal";
  storeModal.id = "store-modal";
  storeModal.innerHTML = `
    <div class="store-modal__overlay" id="store-modal-overlay"></div>
    <div class="store-modal__container">
      <button class="store-modal__close" id="store-modal-close" aria-label="Cerrar modal">&times;</button>
      <div class="store-modal__grid" id="store-modal-content">
        <!-- Contenido dinámico -->
      </div>
    </div>
  `;
  document.body.appendChild(storeModal);

  document.getElementById("store-modal-close").addEventListener("click", () => closeModal());
  document.getElementById("store-modal-overlay").addEventListener("click", () => closeModal());

  // E. Inyectar Notificación Toast
  const storeToast = document.createElement("div");
  storeToast.className = "store-toast";
  storeToast.id = "store-toast";
  storeToast.innerHTML = `
    <i class="fas fa-check-circle"></i>
    <span id="store-toast-message">Producto agregado al carrito</span>
  `;
  document.body.appendChild(storeToast);

  // Inicializar contadores visuales del carrito
  updateCartCounters();
  renderCartItems();
}

// 4. Cargar productos desde la base de datos (Google Sheets)
function loadProducts() {
  const container = document.querySelector("#product-categories .container");
  if (!container) return;

  // Insertar un contenedor exclusivo para los productos dinámicos si no existe
  let dynamicSection = document.getElementById("dynamic-products-container");
  if (!dynamicSection) {
    // Buscar la grilla de accesos principales existente y ocultarla en páginas específicas de categoría
    const featuredServices = container.querySelector(".featured-services");
    if (featuredServices) {
      if (currentCategory !== "all") {
        // En páginas de categoría específica, ocultamos las tres tarjetas redundantes
        featuredServices.style.display = "none";
      } else {
        // En tienda.html, movemos las tres tarjetas arriba del listado
        featuredServices.style.marginBottom = "48px";
      }
    }

    dynamicSection = document.createElement("div");
    dynamicSection.id = "dynamic-products-container";
    dynamicSection.className = "products-container";
    
    // Si estamos en tienda.html, inyectamos una barra de filtros arriba
    if (currentCategory === "all") {
      dynamicSection.innerHTML = `
        <div class="products-filter-bar">
          <button type="button" class="filter-btn active" data-filter="all">Todos los productos</button>
          <button type="button" class="filter-btn" data-filter="windows-office">Windows y Office</button>
          <button type="button" class="filter-btn" data-filter="programas">Programas</button>
          <button type="button" class="filter-btn" data-filter="streaming">Streaming</button>
        </div>
        <div class="products-grid" id="store-products-grid">
          <div class="products-loading"><i class="fas fa-circle-notch"></i><br>Cargando productos dinámicos...</div>
        </div>
      `;
    } else {
      dynamicSection.innerHTML = `
        <div class="products-grid" id="store-products-grid">
          <div class="products-loading"><i class="fas fa-circle-notch"></i><br>Cargando productos de la categoría...</div>
        </div>
      `;
    }
    container.appendChild(dynamicSection);

    // Eventos para filtros en tienda.html
    if (currentCategory === "all") {
      const filterButtons = dynamicSection.querySelectorAll(".filter-btn");
      filterButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
          filterButtons.forEach(b => b.classList.remove("active"));
          e.target.classList.add("active");
          const filterValue = e.target.getAttribute("data-filter");
          applyFilter(filterValue);
        });
      });
    }
  }

  // Carga real de los datos
  if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL !== "") {
    fetch(GOOGLE_SCRIPT_URL)
      .then(response => {
        if (!response.ok) throw new Error("Error en la respuesta de red");
        return response.json();
      })
      .then(data => {
        if (data.error) {
          console.warn("Apps Script devolvió un error:", data.error);
          showLoadError(data.error);
        } else {
          allProducts = data;
          processAndRenderProducts();
        }
      })
      .catch(err => {
        console.error("Error cargando productos de Google Sheets:", err);
        showLoadError("Error de conexión al cargar el catálogo de productos.");
      });
  } else {
    showLoadError("La URL de la API de Google Sheets no está configurada.");
  }
}

function showLoadError(message) {
  const grid = document.getElementById("store-products-grid");
  if (grid) {
    grid.innerHTML = `
      <div class="products-empty">
        <i class="fas fa-exclamation-triangle" style="font-size: 2.5rem; color: var(--accent); margin-bottom: 12px;"></i><br>
        ${message}<br><small style="color: var(--muted); font-size: 0.85rem; display: block; margin-top: 6px;">Verifica la configuración del script de Google Sheets.</small>
      </div>
    `;
  }
}

function processAndRenderProducts() {
  // Filtrar según la categoría de la página actual
  if (currentCategory !== "all") {
    filteredProducts = allProducts.filter(p => p.categoria === currentCategory);
    
    // Cambiar dinámicamente el título del encabezado para alinearlo con la categoría
    const mainHeading = document.querySelector("#product-categories h2");
    if (mainHeading) {
      if (currentCategory === "windows-office") {
        mainHeading.textContent = "Licencias Disponibles";
      } else if (currentCategory === "programas") {
        mainHeading.textContent = "Herramientas de Software";
      } else if (currentCategory === "streaming") {
        mainHeading.textContent = "Plataformas de Streaming";
      }
    }
  } else {
    filteredProducts = allProducts;
  }
  
  renderProductsGrid(filteredProducts);
}

function applyFilter(filterValue) {
  if (filterValue === "all") {
    filteredProducts = allProducts;
  } else {
    filteredProducts = allProducts.filter(p => p.categoria === filterValue);
  }
  renderProductsGrid(filteredProducts);
}

// 5. Renderizar los productos en la grilla
function renderProductsGrid(products) {
  const grid = document.getElementById("store-products-grid");
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="products-empty">
        <i class="fas fa-box-open" style="font-size: 2.5rem; color: var(--accent); margin-bottom: 12px;"></i><br>
        No hay productos disponibles en esta categoría por el momento.
      </div>
    `;
    return;
  }

  grid.innerHTML = ""; // Limpiar spinner

  products.forEach(p => {
    // Crear tarjeta de producto
    const card = document.createElement("article");
    card.className = "product-card";
    
    // Badge de oferta
    let badgeHTML = "";
    if (p.precio_oferta && p.precio_oferta < p.precio) {
      const ahorro = Math.round(((p.precio - p.precio_oferta) / p.precio) * 100);
      badgeHTML = `<span class="product-card__badge">Oferta -${ahorro}%</span>`;
    }

    // Dot de disponibilidad
    const dispClass = getAvailabilityClass(p.disponibilidad);
    const dispVal = p.disponibilidad === true || String(p.disponibilidad).toLowerCase() === "true" ? "Disponible" : 
                    (p.disponibilidad === false || String(p.disponibilidad).toLowerCase() === "false" ? "Agotado" : p.disponibilidad || "Sin datos");
    
    // Fila de precios
    const moneda = p.moneda || DEFAULT_MONEDA;
    let priceHTML = "";
    if (p.precio_oferta) {
      priceHTML = `
        <span class="price--original">${moneda} ${parseFloat(p.precio).toFixed(2)}</span>
        <span class="price--current price--offer">${moneda} ${parseFloat(p.precio_oferta).toFixed(2)}</span>
      `;
    } else {
      priceHTML = `
        <span class="price--current">${moneda} ${parseFloat(p.precio).toFixed(2)}</span>
      `;
    }

    card.innerHTML = `
      ${badgeHTML}
      <div class="product-card__image-container">
        <img class="product-card__image" src="${convertDriveUrl(p.imagen_url) || 'https://via.placeholder.com/300x180?text=Sin+Imagen'}" alt="${p.titulo}" loading="lazy">
      </div>
      <div class="product-card__content">
        <div class="product-card__meta">
          <span class="product-card__category">${p.subcategoria || p.categoria}</span>
          <span class="product-card__availability">
            <span class="availability-dot ${dispClass}"></span>
            ${dispVal}
          </span>
        </div>
        <h3 class="product-card__title">${p.titulo}</h3>
        <p class="product-card__desc">${p.descripcion_corta || ''}</p>
        <div class="product-card__footer">
          <div class="product-card__price-row">
            ${priceHTML}
          </div>
          <div class="product-card__actions">
            <button type="button" class="card-btn card-btn--cart" data-id="${p.id}">
              <i class="fas fa-cart-plus"></i> Agregar
            </button>
            <button type="button" class="card-btn card-btn--whatsapp" data-id="${p.id}">
              <i class="fab fa-whatsapp"></i> Comprar
            </button>
          </div>
        </div>
      </div>
    `;

    // Eventos
    // Clic en la tarjeta abre el detalle (excepto si hace clic en botones)
    card.addEventListener("click", (e) => {
      if (!e.target.closest(".card-btn")) {
        showProductDetails(p.id);
      }
    });

    // Clic en agregar al carrito
    card.querySelector(".card-btn--cart").addEventListener("click", (e) => {
      e.stopPropagation();
      addToCart(p.id);
    });

    // Clic en compra rápida por WhatsApp
    card.querySelector(".card-btn--whatsapp").addEventListener("click", (e) => {
      e.stopPropagation();
      buyDirectViaWhatsApp(p.id);
    });

    grid.appendChild(card);
  });
}

function getAvailabilityClass(disp) {
  if (disp === true || String(disp).toLowerCase() === "true") return "in-stock";
  if (disp === false || String(disp).toLowerCase() === "false") return "out-of-stock";
  if (!disp) return "in-stock";
  const d = String(disp).toLowerCase();
  if (d.includes("disponible") || d.includes("stock") || d.includes("activo") || d.includes("inmediata") || d.includes("si") || d.includes("sí")) {
    return "in-stock";
  }
  if (d.includes("bajo") || d.includes("pedido") || d.includes("demanda")) {
    return "on-demand";
  }
  return "out-of-stock";
}

// 6. Funcionalidad de Carrito de Compras
function addToCart(productId) {
  const product = allProducts.find(p => String(p.id) === String(productId));
  if (!product) return;

  const existingItem = cart.find(item => String(item.product.id) === String(productId));
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ product, quantity: 1 });
  }

  saveCart();
  renderCartItems();
  showToast(`¡"${product.titulo}" agregado al carrito!`);
}

function removeFromCart(productId) {
  cart = cart.filter(item => String(item.product.id) !== String(productId));
  saveCart();
  renderCartItems();
}

function updateQuantity(productId, newQty) {
  const item = cart.find(item => String(item.product.id) === String(productId));
  if (item) {
    item.quantity = parseInt(newQty) || 1;
    if (item.quantity < 1) item.quantity = 1;
    saveCart();
    renderCartItems();
  }
}

// Actualizar contadores del header y del flotante
function updateCartCounters() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  // Badge flotante
  const floatBadge = document.getElementById("cart-floating-badge");
  if (floatBadge) {
    floatBadge.textContent = totalItems;
    floatBadge.style.display = totalItems > 0 ? "flex" : "none";
  }

  // Badge en el menú superior
  const navBadge = document.getElementById("nav-cart-badge");
  if (navBadge) {
    navBadge.textContent = totalItems;
  }
}

// Renderizar artículos en la barra lateral del carrito
function renderCartItems() {
  const container = document.getElementById("cart-items-list");
  if (!container) return;

  const checkoutForm = document.getElementById("cart-checkout-form");
  const checkoutBtn = document.getElementById("cart-checkout-btn");

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-msg">
        <i class="fas fa-shopping-basket"></i>
        <span>El carrito está vacío</span>
      </div>
    `;
    if (checkoutForm) checkoutForm.style.display = "none";
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.innerHTML = `<i class="fab fa-whatsapp"></i> Finalizar Pedido por WhatsApp`;
    }
    
    document.getElementById("cart-summary-qty").textContent = "0 items";
    document.getElementById("cart-summary-total").textContent = `${DEFAULT_MONEDA} 0.00`;
    return;
  }

  container.innerHTML = "";
  let total = 0;
  let totalQty = 0;

  cart.forEach(item => {
    const p = item.product;
    const qty = item.quantity;
    const precioUnitario = p.precio_oferta || p.precio;
    const subtotal = precioUnitario * qty;
    total += subtotal;
    totalQty += qty;

    const moneda = p.moneda || DEFAULT_MONEDA;

    const itemEl = document.createElement("div");
    itemEl.className = "cart-item";
    itemEl.innerHTML = `
      <div class="cart-item__image">
        <img src="${convertDriveUrl(p.imagen_url) || 'https://via.placeholder.com/64x64?text=Item'}" alt="${p.titulo}">
      </div>
      <div class="cart-item__details">
        <h4 class="cart-item__title">${p.titulo}</h4>
        <span class="cart-item__sku">SKU: ${p.sku || 'N/A'}</span>
        <span class="cart-item__price">${moneda} ${parseFloat(precioUnitario).toFixed(2)}</span>
      </div>
      <div class="cart-item__controls">
        <div class="quantity-control">
          <button type="button" class="quantity-btn qty-minus" data-id="${p.id}">&minus;</button>
          <input type="number" class="quantity-input" data-id="${p.id}" value="${qty}" min="1" readonly>
          <button type="button" class="quantity-btn qty-plus" data-id="${p.id}">&plus;</button>
        </div>
        <button type="button" class="cart-item__remove" data-id="${p.id}" aria-label="Remover artículo">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    // Eventos
    itemEl.querySelector(".qty-minus").addEventListener("click", () => updateQuantity(p.id, qty - 1));
    itemEl.querySelector(".qty-plus").addEventListener("click", () => updateQuantity(p.id, qty + 1));
    itemEl.querySelector(".cart-item__remove").addEventListener("click", () => removeFromCart(p.id));

    container.appendChild(itemEl);
  });

  // Mostrar formulario de checkout e integrar totales
  if (checkoutForm) checkoutForm.style.display = "flex";
  if (checkoutBtn) checkoutBtn.disabled = false;

  document.getElementById("cart-summary-qty").textContent = `${totalQty} producto(s)`;
  document.getElementById("cart-summary-total").textContent = `${DEFAULT_MONEDA} ${total.toFixed(2)}`;
}

function openCart() {
  const drawer = document.getElementById("cart-drawer");
  if (drawer) drawer.classList.add("is-open");
}

function closeCart() {
  const drawer = document.getElementById("cart-drawer");
  if (drawer) drawer.classList.remove("is-open");
}

// 7. Modal de Detalles Completos del Producto
function showProductDetails(productId) {
  const p = allProducts.find(prod => String(prod.id) === String(productId));
  if (!p) return;

  const contentContainer = document.getElementById("store-modal-content");
  if (!contentContainer) return;

  // Galería de imágenes
  let mainImgHTML = `<img src="${convertDriveUrl(p.imagen_url) || 'https://via.placeholder.com/400x300?text=Sin+Imagen'}" alt="${p.titulo}" id="modal-main-img">`;
  let thumbsHTML = "";

  if (p.galeria) {
    const urls = p.galeria.split(",").map(url => convertDriveUrl(url.trim()));
    if (urls.length > 0) {
      thumbsHTML += `<div class="store-gallery__thumbs">`;
      urls.forEach((url, index) => {
        thumbsHTML += `
          <div class="store-gallery__thumb ${index === 0 ? 'is-active' : ''}" data-url="${url}">
            <img src="${url}" alt="Miniatura ${index + 1}">
          </div>
        `;
      });
      thumbsHTML += `</div>`;
    }
  }

  // Precios
  const moneda = p.moneda || DEFAULT_MONEDA;
  let priceHTML = "";
  if (p.precio_oferta) {
    priceHTML = `
      <span class="price--original">${moneda} ${parseFloat(p.precio).toFixed(2)}</span>
      <span class="price--current price--offer">${moneda} ${parseFloat(p.precio_oferta).toFixed(2)}</span>
    `;
  } else {
    priceHTML = `
      <span class="price--current">${moneda} ${parseFloat(p.precio).toFixed(2)}</span>
    `;
  }

  // Disponibilidad
  const dispClass = getAvailabilityClass(p.disponibilidad);
  const dispVal = p.disponibilidad === true || String(p.disponibilidad).toLowerCase() === "true" ? "Disponible" : 
                  (p.disponibilidad === false || String(p.disponibilidad).toLowerCase() === "false" ? "Agotado" : p.disponibilidad || "Sin datos");

  contentContainer.innerHTML = `
    <!-- Columna Galería -->
    <div class="store-gallery">
      <div class="store-gallery__main">
        ${mainImgHTML}
      </div>
      ${thumbsHTML}
    </div>
    
    <!-- Columna Detalles -->
    <div class="store-details">
      <div class="store-details__meta">
        <span class="store-details__cat">${p.subcategoria || p.categoria}</span>
        <span class="product-card__availability">
          <span class="availability-dot ${dispClass}"></span>
          ${dispVal}
        </span>
      </div>
      <h3 class="store-details__title">${p.titulo}</h3>
      <div class="store-details__price">
        ${priceHTML}
      </div>
      <div class="store-details__desc">
        ${p.descripcion_larga || p.descripcion_corta || 'No hay descripción detallada disponible.'}
      </div>
      
      <!-- Ficha Técnica -->
      <div class="store-specs">
        <div class="spec-item">
          <span class="spec-label">Plataforma</span>
          <span class="spec-value">${p.plataforma || 'General'}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Tipo de Entrega</span>
          <span class="spec-value">${p.tipo_entrega || 'Digital'}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Tiempo de Entrega</span>
          <span class="spec-value">${p.tiempo_entrega || 'Inmediato'}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">SKU</span>
          <span class="spec-value">${p.sku || 'N/A'}</span>
        </div>
      </div>
      
      ${p.notas ? `<div class="store-details__notes"><strong>Nota:</strong> ${p.notas}</div>` : ''}
      
      <div class="store-details__actions">
        <button type="button" class="btn-modal btn-modal--cart" id="modal-add-to-cart">
          <i class="fas fa-cart-plus"></i> Agregar al Carrito
        </button>
        <button type="button" class="btn-modal btn-modal--whatsapp" id="modal-buy-wa">
          <i class="fab fa-whatsapp"></i> Comprar Directo
        </button>
      </div>
    </div>
  `;

  // Controlar clics en miniaturas de galería
  const thumbs = contentContainer.querySelectorAll(".store-gallery__thumb");
  thumbs.forEach(thumb => {
    thumb.addEventListener("click", () => {
      thumbs.forEach(t => t.classList.remove("is-active"));
      thumb.classList.add("is-active");
      const targetUrl = thumb.getAttribute("data-url");
      const mainImg = document.getElementById("modal-main-img");
      if (mainImg) mainImg.src = targetUrl;
    });
  });

  // Evento agregar al carrito en el modal
  document.getElementById("modal-add-to-cart").addEventListener("click", () => {
    addToCart(p.id);
    closeModal();
  });

  // Evento comprar directo
  document.getElementById("modal-buy-wa").addEventListener("click", () => {
    buyDirectViaWhatsApp(p.id);
    closeModal();
  });

  // Mostrar modal
  document.getElementById("store-modal").classList.add("is-open");
}

function closeModal() {
  const modal = document.getElementById("store-modal");
  if (modal) modal.classList.remove("is-open");
}

// 8. Integración y Envío por WhatsApp
// Compra Directa de 1 producto
function buyDirectViaWhatsApp(productId) {
  const p = allProducts.find(prod => String(prod.id) === String(productId));
  if (!p) return;

  const precioFinal = p.precio_oferta || p.precio;
  const moneda = p.moneda || DEFAULT_MONEDA;
  let text = "";

  if (p.whatsapp_texto && p.whatsapp_texto.trim() !== "") {
    text = p.whatsapp_texto;
  } else {
    // Mensaje automático
    text = `¡Hola HANS WEB! Me interesa comprar este producto:\n\n` +
           `*Producto:* ${p.titulo}\n` +
           `*Precio:* ${moneda} ${parseFloat(precioFinal).toFixed(2)}\n` +
           `*Plataforma:* ${p.plataforma || 'N/A'}\n` +
           `*SKU:* ${p.sku || 'N/A'}\n\n` +
           `¿Me indicas los detalles y métodos de pago para concretar la compra?`;
  }

  sendWhatsAppMessage(text);
}

// Procesar pedido del Carrito Completo
function processCheckout() {
  const nameInput = document.getElementById("checkout-name");
  const name = nameInput ? nameInput.value.trim() : "";
  const paymentMethod = document.getElementById("checkout-payment") ? document.getElementById("checkout-payment").value : "";

  if (name === "") {
    alert("Por favor, ingresa tu nombre completo para procesar el pedido.");
    if (nameInput) nameInput.focus();
    return;
  }

  // Generar resumen del carrito
  let msg = `¡Hola HANS WEB! Me gustaría realizar un pedido con los siguientes productos:\n\n`;
  msg += `*Cliente:* ${name}\n`;
  msg += `*Método de Pago:* ${paymentMethod}\n`;
  msg += `------------------------------------\n\n`;

  let total = 0;
  let itemIndex = 1;

  cart.forEach(item => {
    const p = item.product;
    const qty = item.quantity;
    const precioUnitario = p.precio_oferta || p.precio;
    const subtotal = precioUnitario * qty;
    const moneda = p.moneda || DEFAULT_MONEDA;
    
    total += subtotal;

    msg += `*${itemIndex}. ${p.titulo}*\n`;
    msg += `   Cantidad: ${qty} x ${moneda} ${parseFloat(precioUnitario).toFixed(2)}\n`;
    msg += `   Subtotal: ${moneda} ${subtotal.toFixed(2)}\n`;
    if (p.sku) msg += `   SKU: ${p.sku}\n`;
    msg += `\n`;
    
    itemIndex++;
  });

  const finalMoneda = cart[0].product.moneda || DEFAULT_MONEDA;
  msg += `------------------------------------\n`;
  msg += `*Total Estimado:* ${finalMoneda} ${total.toFixed(2)}\n\n`;
  msg += `Quedo atento a la confirmación de disponibilidad para realizar el pago. ¡Muchas gracias!`;

  // Limpiar el carrito después del checkout exitoso
  cart = [];
  saveCart();
  renderCartItems();
  closeCart();

  sendWhatsAppMessage(msg);
}

// Redireccionar al cliente
function sendWhatsAppMessage(text) {
  const encodedText = encodeURIComponent(text);
  const waUrl = `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encodedText}`;
  window.open(waUrl, "_blank");
}

// 9. Mostrar notificaciones Toast
function showToast(message) {
  const toast = document.getElementById("store-toast");
  const toastMsg = document.getElementById("store-toast-message");
  
  if (toast && toastMsg) {
    toastMsg.textContent = message;
    toast.classList.add("is-visible");
    
    setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 3500);
  }
}
