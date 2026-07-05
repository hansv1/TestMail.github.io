/**
 * HANS WEB - Módulo de Gestión de Códigos y Correo Temporal (testmail.app)
 * 
 * Este script maneja la búsqueda de correos mediante alias de Google Sheets,
 * el filtrado avanzado de correos por plataforma, la generación de correos
 * temporales con dominios personalizados y la renderización segura de correos.
 */

// CONFIGURACIÓN
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw1DSh97C7dDjoNUUPOZkuKtKJCYi-utiErGRDB5s3p23bqx4n-MWU53TTzvfN2Vbl-/exec";
const TESTMAIL_API_KEY = "e769cbfe-db59-4af7-97d3-74703239d385";
const TESTMAIL_NAMESPACE = "wjlcs";
const TESTMAIL_API_URL = "https://api.testmail.app/api/json";

// Variables de estado
let codigosMappings = [];
let dominiosList = [];
let activeCheckInterval = null; // Para auto-recarga opcional

document.addEventListener("DOMContentLoaded", () => {
  const isGestionCodigos = window.location.pathname.includes("gestion-codigos.html");
  const isCorreoTemporal = window.location.pathname.includes("correo-temporal.html");

  if (isGestionCodigos) {
    initGestionCodigos();
  } else if (isCorreoTemporal) {
    initCorreoTemporal();
  }
});

// ==========================================
// 1. UTILIDADES COMUNES
// ==========================================

// Helper para limpiar/convertir enlaces de Drive
function convertDriveUrl(url) {
  if (!url) return "";
  url = url.trim();
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

// Formatear Unix timestamp a fecha legible
function formatTimestamp(ts) {
  const date = new Date(ts);
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Generar cadena aleatoria
function generateRandomString(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Copiar texto al portapapeles
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert("¡Correo copiado al portapapeles!");
  }).catch(err => {
    console.error("Error al copiar correo:", err);
  });
}

// ==========================================
// 2. GESTIÓN DE CÓDIGOS (gestion-codigos.html)
// ==========================================
function initGestionCodigos() {
  const section = document.querySelector("#product-categories");
  if (!section) return;

  // Insertar interfaz en la sección product-categories
  section.innerHTML = `
    <div class="container section__content">
      <div class="section-heading section-heading--center">
        <p class="eyebrow">Acceso Seguro</p>
        <h2>Consulta tus códigos de verificación</h2>
        <p>Ingresa tu correo principal para obtener los mensajes de tu plataforma al instante.</p>
      </div>
      
      <div class="inbox-panel">
        <form id="gc-search-form" class="inbox-form">
          <div class="inbox-form__row">
            <div class="inbox-form__group">
              <label for="gc-email-input" class="inbox-form__label">Correo Principal de la Cuenta</label>
              <div class="inbox-input-wrapper">
                <i class="fas fa-envelope inbox-input-icon"></i>
                <input type="email" id="gc-email-input" class="inbox-control inbox-control--with-icon" placeholder="ejemplo@outlook.com" required>
              </div>
            </div>
            <button type="submit" class="inbox-btn inbox-btn--primary" id="gc-submit-btn">
              <i class="fas fa-search"></i> Consultar Códigos
            </button>
          </div>
        </form>

        <div id="gc-results-container" style="display: none;">
          <div class="inbox-results">
            <div class="inbox-results__header">
              <h3 class="inbox-results__title" id="gc-platform-title">
                <img src="" id="gc-platform-icon" alt="" style="display: none;">
                <span>Plataforma</span>
              </h3>
              <div class="inbox-status">
                <span class="inbox-status__dot"></span>
                <span>Bandeja en vivo</span>
              </div>
            </div>
            
            <div id="gc-emails-list" class="email-list">
              <!-- Se cargan correos aquí -->
            </div>
          </div>
        </div>
        
        <div id="gc-loading" class="inbox-loader" style="display: none;">
          <i class="fas fa-circle-notch"></i>
          <p>Buscando cuenta y consultando bandeja de entrada...</p>
        </div>
        
        <div id="gc-error" class="inbox-empty" style="display: none;">
          <i class="fas fa-exclamation-circle" style="color: var(--accent);"></i>
          <h4 id="gc-error-title">No encontrado</h4>
          <p id="gc-error-message">Detalles del problema.</p>
        </div>
      </div>
    </div>
  `;

  // Cargar mapeos de Sheets
  fetch(GOOGLE_SCRIPT_URL + "?sheet=GestionCodigos")
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        console.error("Error en Sheets:", data.error);
      } else {
        codigosMappings = data.filter(item => item.activo === true);
      }
    })
    .catch(err => console.error("Error cargando mapeos:", err));

  // Manejar submit de búsqueda
  const form = document.getElementById("gc-search-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("gc-email-input").value.trim().toLowerCase();
    searchGcEmails(email);
  });
}

function searchGcEmails(email) {
  const loading = document.getElementById("gc-loading");
  const results = document.getElementById("gc-results-container");
  const error = document.getElementById("gc-error");
  const submitBtn = document.getElementById("gc-submit-btn");

  loading.style.display = "block";
  results.style.display = "none";
  error.style.display = "none";
  submitBtn.disabled = true;

  // Buscar coincidencia en Google Sheets
  const mapping = codigosMappings.find(m => m.correo_principal.toLowerCase().trim() === email);

  if (!mapping) {
    setTimeout(() => {
      loading.style.display = "none";
      submitBtn.disabled = false;
      error.style.display = "block";
      document.getElementById("gc-error-title").textContent = "Cuenta No Registrada";
      document.getElementById("gc-error-message").textContent = "El correo '" + email + "' no está registrado o activo en el sistema. Por favor, solicita soporte para activarlo.";
    }, 600);
    return;
  }

  // Cuenta encontrada. Cargar datos de plataforma
  const platformName = mapping.plataforma;
  const aliasTag = mapping.alias_tag;
  const iconUrl = convertDriveUrl(mapping.imagen_url);

  // Filtros
  const filterSubject = mapping.filtro_asunto || "";
  const filterBody = mapping.filtro_contenido || "";
  const allowedPhrases = mapping.permitidas ? mapping.permitidas.split(",").map(p => p.trim().toLowerCase()).filter(p => p !== "") : [];
  const blockedPhrases = mapping.bloqueadas ? mapping.bloqueadas.split(",").map(b => b.trim().toLowerCase()).filter(b => b !== "") : [];

  // Actualizar cabecera de resultados
  const plTitleSpan = document.querySelector("#gc-platform-title span");
  const plIconImg = document.getElementById("gc-platform-icon");
  
  plTitleSpan.textContent = `${platformName} (${email})`;
  if (iconUrl) {
    plIconImg.src = iconUrl;
    plIconImg.style.display = "inline-block";
  } else {
    plIconImg.style.display = "none";
  }

  // Consultar testmail.app
  const queryUrl = `${TESTMAIL_API_URL}?apikey=${TESTMAIL_API_KEY}&namespace=${TESTMAIL_NAMESPACE}&tag=${aliasTag}&livequery=false`;

  fetch(queryUrl)
    .then(res => res.json())
    .then(data => {
      loading.style.display = "none";
      submitBtn.disabled = false;

      if (data.result === "success") {
        const emails = data.emails || [];
        // Aplicar filtros configurados
        const filtered = emails.filter(mail => {
          const subject = (mail.subject || "").toLowerCase();
          const htmlBody = (mail.html || "").toLowerCase();
          const textBody = (mail.text || "").toLowerCase();
          const fullContent = subject + " " + htmlBody + " " + textBody;

          // 1. Filtro por asunto
          if (filterSubject !== "" && !subject.includes(filterSubject.toLowerCase())) {
            return false;
          }

          // 2. Filtro por contenido
          if (filterBody !== "" && !htmlBody.includes(filterBody.toLowerCase()) && !textBody.includes(filterBody.toLowerCase())) {
            return false;
          }

          // 3. Palabras permitidas (debe incluir al menos una si el filtro existe)
          if (allowedPhrases.length > 0) {
            const hasAllowed = allowedPhrases.some(phrase => fullContent.includes(phrase));
            if (!hasAllowed) return false;
          }

          // 4. Palabras bloqueadas (NO debe incluir ninguna)
          if (blockedPhrases.length > 0) {
            const hasBlocked = blockedPhrases.some(phrase => fullContent.includes(phrase));
            if (hasBlocked) return false;
          }

          return true;
        });

        renderEmailsList(filtered, "gc-emails-list");
        results.style.display = "block";
      } else {
        error.style.display = "block";
        document.getElementById("gc-error-title").textContent = "Error de Consulta";
        document.getElementById("gc-error-message").textContent = data.message || "No se pudo recuperar los correos de testmail.app.";
      }
    })
    .catch(err => {
      console.error(err);
      loading.style.display = "none";
      submitBtn.disabled = false;
      error.style.display = "block";
      document.getElementById("gc-error-title").textContent = "Error de Conexión";
      document.getElementById("gc-error-message").textContent = "Ocurrió un error al comunicarse con la bandeja de entrada.";
    });
}

// ==========================================
// 3. CORREO TEMPORAL (correo-temporal.html)
// ==========================================
function initCorreoTemporal() {
  const section = document.querySelector("#product-categories");
  if (!section) return;

  // Insertar interfaz en la sección product-categories
  section.innerHTML = `
    <div class="container section__content">
      <div class="section-heading section-heading--center">
        <p class="eyebrow">Desechable y Seguro</p>
        <h2>Bandeja de Correo Temporal</h2>
        <p>Crea una dirección de correo al instante para proteger tu privacidad y ver los mensajes entrantes.</p>
      </div>

      <div class="inbox-panel">
        <form id="temp-email-form" class="inbox-form">
          <div class="inbox-form__row">
            <div class="inbox-form__group">
              <label for="temp-user-input" class="inbox-form__label">Nombre del correo</label>
              <input type="text" id="temp-user-input" class="inbox-control" placeholder="ej. mi-correo" required>
            </div>
            
            <div class="inbox-form__group inbox-form__group--select">
              <label for="temp-domain-select" class="inbox-form__label">Dominio</label>
              <select id="temp-domain-select" class="inbox-control">
                <option value="@inbox.testmail.app" data-type="default">@inbox.testmail.app</option>
                <!-- Se cargan dominios de Sheets -->
              </select>
            </div>
            
            <button type="button" class="inbox-btn inbox-btn--secondary" id="temp-random-btn" title="Generar correo aleatorio">
              <i class="fas fa-random"></i> Aleatorio
            </button>
            
            <button type="submit" class="inbox-btn inbox-btn--primary" id="temp-check-btn">
              <i class="fas fa-sync-alt"></i> Consultar Bandeja
            </button>
          </div>
        </form>

        <div id="temp-generated-box" class="generated-email-box" style="display: none;">
          <div>
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--muted); text-transform: uppercase;">Tu Correo Temporal:</span>
            <div class="generated-email-text" id="temp-email-display">usuario@dominio.com</div>
          </div>
          <button type="button" class="copy-btn" id="temp-copy-btn" title="Copiar correo">
            <i class="fas fa-copy"></i>
          </button>
        </div>

        <div id="temp-results-container" style="display: none;">
          <div class="inbox-results">
            <div class="inbox-results__header">
              <h3 class="inbox-results__title">
                <i class="fas fa-inbox"></i>
                <span>Mensajes Recibidos</span>
              </h3>
              <div class="inbox-status">
                <span class="inbox-status__dot"></span>
                <span>Bandeja en vivo</span>
              </div>
            </div>
            
            <div id="temp-emails-list" class="email-list">
              <!-- Se cargan correos aquí -->
            </div>
          </div>
        </div>

        <div id="temp-loading" class="inbox-loader" style="display: none;">
          <i class="fas fa-circle-notch"></i>
          <p>Consultando mensajes en la bandeja de entrada...</p>
        </div>
        
        <div id="temp-error" class="inbox-empty" style="display: none;">
          <i class="fas fa-exclamation-circle" style="color: var(--accent);"></i>
          <h4 id="temp-error-title">Error</h4>
          <p id="temp-error-message">Detalles del problema.</p>
        </div>
      </div>
    </div>
  `;

  // Cargar dominios adicionales de Sheets
  fetch(GOOGLE_SCRIPT_URL + "?sheet=Dominios")
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        console.error("Error en Dominios:", data.error);
      } else {
        dominiosList = data.filter(d => d.activo === true);
        const select = document.getElementById("temp-domain-select");
        dominiosList.forEach(d => {
          const opt = document.createElement("option");
          opt.value = d.dominio.trim();
          opt.textContent = d.dominio.trim();
          opt.setAttribute("data-type", "custom");
          opt.setAttribute("data-alias", d.alias_tag.trim());
          select.appendChild(opt);
        });
      }
    })
    .catch(err => console.error("Error cargando dominios:", err));

  // Evento botón aleatorio
  document.getElementById("temp-random-btn").addEventListener("click", () => {
    document.getElementById("temp-user-input").value = generateRandomString(9);
  });

  // Copiar correo
  document.getElementById("temp-copy-btn").addEventListener("click", () => {
    const text = document.getElementById("temp-email-display").textContent;
    copyToClipboard(text);
  });

  // Manejar submit de consulta
  const form = document.getElementById("temp-email-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    checkTempInbox();
  });
}

function checkTempInbox() {
  const userInput = document.getElementById("temp-user-input").value.trim().toLowerCase();
  const domainSelect = document.getElementById("temp-domain-select");
  const selectedOption = domainSelect.options[domainSelect.selectedIndex];
  const domain = selectedOption.value;
  const domainType = selectedOption.getAttribute("data-type");

  if (userInput === "") {
    alert("Por favor escribe el nombre de tu correo.");
    return;
  }

  let finalEmail = "";
  let queryTag = "";

  if (domainType === "default") {
    // Para @inbox.testmail.app: wjlcs.{tag}@inbox.testmail.app
    finalEmail = `${TESTMAIL_NAMESPACE}.${userInput}${domain}`;
    queryTag = userInput;
  } else {
    // Para otros dominios: correo@dominio.com, pero consultamos el tag mapeado
    finalEmail = userInput + domain;
    queryTag = selectedOption.getAttribute("data-alias");
  }

  // Mostrar correo generado
  document.getElementById("temp-email-display").textContent = finalEmail;
  document.getElementById("temp-generated-box").style.display = "flex";

  const loading = document.getElementById("temp-loading");
  const results = document.getElementById("temp-results-container");
  const error = document.getElementById("temp-error");
  const checkBtn = document.getElementById("temp-check-btn");

  loading.style.display = "block";
  results.style.display = "none";
  error.style.display = "none";
  checkBtn.disabled = true;

  const queryUrl = `${TESTMAIL_API_URL}?apikey=${TESTMAIL_API_KEY}&namespace=${TESTMAIL_NAMESPACE}&tag=${queryTag}&livequery=false`;

  fetch(queryUrl)
    .then(res => res.json())
    .then(data => {
      loading.style.display = "none";
      checkBtn.disabled = false;

      if (data.result === "success") {
        const emails = data.emails || [];
        // En correo temporal NO se aplican filtros, mostrar todos
        renderEmailsList(emails, "temp-emails-list");
        results.style.display = "block";
      } else {
        error.style.display = "block";
        document.getElementById("temp-error-title").textContent = "Error de Consulta";
        document.getElementById("temp-error-message").textContent = data.message || "No se pudo recuperar los correos de testmail.app.";
      }
    })
    .catch(err => {
      console.error(err);
      loading.style.display = "none";
      checkBtn.disabled = false;
      error.style.display = "block";
      document.getElementById("temp-error-title").textContent = "Error de Conexión";
      document.getElementById("temp-error-message").textContent = "Ocurrió un error al conectarse a la bandeja de entrada temporal.";
    });
}

// ==========================================
// 4. COMPONENTES RENDERIZADORES DE CORREOS
// ==========================================
function renderEmailsList(emails, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (emails.length === 0) {
    container.innerHTML = `
      <div class="inbox-empty">
        <i class="fas fa-envelope-open" style="font-size: 2.2rem; color: var(--muted); margin-bottom: 8px;"></i>
        <h4>Bandeja vacía</h4>
        <p>No se han recibido mensajes recientes para esta dirección de correo.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  // Ordenar correos de más nuevos a más viejos
  emails.sort((a, b) => b.timestamp - a.timestamp);

  emails.forEach((mail, index) => {
    const card = document.createElement("article");
    card.className = "email-card";
    
    // Obtener preview de texto
    const textPreview = mail.text ? mail.text.substring(0, 160) + "..." : "Sin contenido de texto.";

    card.innerHTML = `
      <div class="email-card__meta">
        <span class="email-card__sender"><i class="fas fa-user"></i> De: ${escapeHtml(mail.from)}</span>
        <span class="email-card__date"><i class="fas fa-clock"></i> ${formatTimestamp(mail.timestamp)}</span>
      </div>
      <h4 class="email-card__subject">${escapeHtml(mail.subject || 'Sin Asunto')}</h4>
      <p class="email-card__preview">${escapeHtml(textPreview)}</p>
      
      <!-- Visualizador de HTML (Iframe) oculto -->
      <div class="email-content-viewer" id="viewer-${containerId}-${index}">
        <div class="email-iframe-container">
          <!-- Se inyecta el iframe de forma diferida al hacer clic -->
        </div>
      </div>
    `;

    // Toggle expandir correo
    card.addEventListener("click", (e) => {
      // Ignorar clics internos del visor abierto
      if (e.target.closest(".email-content-viewer")) return;
      
      const viewer = card.querySelector(".email-content-viewer");
      const iframeContainer = viewer.querySelector(".email-iframe-container");
      
      const isCurrentlyActive = viewer.classList.contains("is-active");
      
      // Cerrar otros visores del mismo contenedor
      container.querySelectorAll(".email-content-viewer").forEach(v => {
        v.classList.remove("is-active");
      });

      if (!isCurrentlyActive) {
        viewer.classList.add("is-active");
        
        // Inyectar el iframe diferido si no existe ya
        if (!iframeContainer.querySelector("iframe") && !iframeContainer.querySelector(".email-no-html")) {
          iframeContainer.innerHTML = ""; // Limpiar comentario HTML
          if (mail.html) {
            const iframe = document.createElement("iframe");
            iframe.className = "email-iframe";
            
            // Inyectar <base target="_blank"> en el HTML del correo
            let processedHtml = mail.html;
            if (processedHtml.toLowerCase().includes("<head>")) {
              processedHtml = processedHtml.replace(/<head>/i, "<head><base target=\"_blank\">");
            } else {
              processedHtml = `<base target="_blank">${processedHtml}`;
            }
            
            iframe.srcdoc = processedHtml;
            
            // Redimensionar automáticamente y asegurar enlaces target="_blank"
            iframe.onload = () => {
              try {
                const iframeDoc = iframe.contentWindow.document || iframe.contentDocument;
                
                // Forzar target="_blank" en todos los enlaces
                const links = iframeDoc.getElementsByTagName("a");
                for (let i = 0; i < links.length; i++) {
                  links[i].setAttribute("target", "_blank");
                }
                
                const body = iframeDoc.body;
                const html = iframeDoc.documentElement;
                const height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
                iframe.style.height = (height + 30) + "px";
              } catch (e) {
                iframe.style.height = "550px";
              }
            };
            
            iframeContainer.appendChild(iframe);
          } else {
            // Si no tiene HTML, mostrar texto plano formateado
            iframeContainer.innerHTML = `<div class="email-no-html">${escapeHtml(mail.text || 'Mensaje sin cuerpo')}</div>`;
          }
        }
      }
    });

    container.appendChild(card);
  });
}

// Escapar caracteres HTML para evitar XSS
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
