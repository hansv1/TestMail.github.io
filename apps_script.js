/**
 * Google Apps Script - API Multipropósito para HANS WEB
 * 
 * Este script expone cualquier pestaña de tu Google Sheet como JSON.
 * Admite el parámetro '?sheet=NombreDePestaña' en la URL.
 * 
 * Pestañas requeridas en tu Google Sheets:
 * 1. "Productos" (para el catálogo)
 * 2. "GestionCodigos" (para mapear correos a alias de testmail y configurar filtros)
 * 3. "Dominios" (para los dominios de correo temporal)
 * 
 * Instrucciones de despliegue actualizadas:
 * 1. Abre tu Google Sheet.
 * 2. Ve a: Extensiones -> Apps Script.
 * 3. Borra el código anterior y pega este nuevo código.
 * 4. Guarda e implementa como Aplicación Web (Nueva implementación).
 * 5. Asegúrate de configurar "Quién tiene acceso: Cualquiera".
 * 6. Copia la URL generada y actualízala en tus archivos JS.
 */

function doGet(e) {
  // Pestaña predeterminada si no se especifica
  var sheetName = e.parameter.sheet || "Productos";
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return createJsonResponse({ error: "No se encontró la pestaña '" + sheetName + "'" });
  }
  
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return createJsonResponse([]);
  }
  
  // Limpiar y estandarizar los encabezados: minúsculas, reemplazar espacios/barras/guiones con guiones bajos, remover acentos
  var headers = data[0].map(function(h) { 
    return h.toString().trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remueve acentos
      .replace(/[^a-z0-9]/g, '_') // Reemplaza caracteres no alfanuméricos con _
      .replace(/_+/g, '_') // Estandariza múltiples _ seguidos
      .replace(/^_+|_+$/g, ''); // Quita _ del inicio y fin
  });
  
  var jsonArray = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    var hasData = false;
    
    for (var j = 0; j < headers.length; j++) {
      var cellVal = row[j];
      
      // Manejar fechas
      if (cellVal instanceof Date) {
        cellVal = cellVal.toISOString().split('T')[0];
      }
      
      obj[headers[j]] = cellVal;
      
      if (cellVal !== "") {
        hasData = true;
      }
    }
    
    // Validar si la fila contiene datos reales
    if (hasData) {
      // Estandarizar valores comunes según la pestaña
      
      // Para la pestaña Productos
      if (sheetName === "Productos" && obj.id) {
        obj.precio = parseFloat(obj.precio) || 0;
        if (obj.precio_oferta !== undefined && obj.precio_oferta !== "") {
          obj.precio_oferta = parseFloat(obj.precio_oferta) || null;
        } else {
          obj.precio_oferta = null;
        }
        obj.stock = parseInt(obj.stock) || 0;
        obj.destacado = isTrue(obj.destacado);
        jsonArray.push(obj);
      } 
      // Para la pestaña GestionCodigos
      else if (sheetName === "GestionCodigos" && obj.correo_principal) {
        obj.activo = isTrue(obj.activo);
        jsonArray.push(obj);
      }
      // Para la pestaña Dominios
      else if (sheetName === "Dominios" && obj.dominio) {
        obj.activo = isTrue(obj.activo);
        jsonArray.push(obj);
      }
      // Cualquier otra pestaña (genérico)
      else if (sheetName !== "Productos" && sheetName !== "GestionCodigos" && sheetName !== "Dominios") {
        jsonArray.push(obj);
      }
    }
  }
  
  // Ordenar si tiene columna 'orden'
  if (jsonArray.length > 0 && jsonArray[0].orden !== undefined) {
    jsonArray.sort(function(a, b) {
      var orderA = parseFloat(a.orden) !== undefined && !isNaN(parseFloat(a.orden)) ? parseFloat(a.orden) : 9999;
      var orderB = parseFloat(b.orden) !== undefined && !isNaN(parseFloat(b.orden)) ? parseFloat(b.orden) : 9999;
      return orderA - orderB;
    });
  }
  
  return createJsonResponse(jsonArray);
}

// Helper para convertir textos de Sheets a booleanos de JS
function isTrue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  var str = value.toString().toLowerCase().trim();
  return (str === "true" || str === "yes" || str === "sí" || str === "si" || str === "1" || str === "activo");
}

function createJsonResponse(data) {
  var result = JSON.stringify(data);
  return ContentService.createTextOutput(result)
    .setMimeType(ContentService.MimeType.JSON);
}
