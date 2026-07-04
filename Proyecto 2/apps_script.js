/**
 * Google Apps Script - API de Productos para HANS WEB
 * 
 * Instrucciones:
 * 1. Abre tu Google Sheet con la pestaña "Productos".
 * 2. En el menú superior, ve a: Extensiones -> Apps Script.
 * 3. Borra el código existente y pega este código.
 * 4. Guarda el proyecto (clic en el ícono de disco).
 * 5. Haz clic en "Implementar" -> "Nueva implementación".
 * 6. Selecciona el tipo de implementación: "Aplicación web".
 * 7. Configura:
 *    - Descripción: API de Productos HANS WEB
 *    - Ejecutar como: Tú (tu cuenta de Google)
 *    - Quién tiene acceso: "Cualquiera" (esto es MUY importante para que el sitio web pueda consultar la API).
 * 8. Haz clic en "Implementar". Copia la URL de la aplicación web generada.
 * 9. Reemplaza la variable `GOOGLE_SCRIPT_URL` en `js/store.js` con esa URL.
 */

function doGet(e) {
  var sheetName = "Productos";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return createJsonResponse({ error: "No se encontró la pestaña '" + sheetName + "'" });
  }
  
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return createJsonResponse([]);
  }
  
  // Obtener los encabezados en minúsculas y limpiados
  var headers = data[0].map(function(h) { 
    return h.toString().trim().toLowerCase()
      .replace(/\s+/g, '_') // Reemplaza espacios con guiones bajos si existiesen
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remueve acentos
  });
  
  var jsonArray = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    var hasData = false;
    
    for (var j = 0; j < headers.length; j++) {
      var cellVal = row[j];
      
      // Manejar tipos de datos específicos
      if (cellVal instanceof Date) {
        cellVal = cellVal.toISOString().split('T')[0]; // Formato YYYY-MM-DD
      }
      
      obj[headers[j]] = cellVal;
      
      if (cellVal !== "") {
        hasData = true;
      }
    }
    
    // Solo agregar si la fila tiene datos y tiene un ID definido
    if (hasData && obj.id !== undefined && obj.id !== "") {
      // Convertir campos numéricos y booleanos para facilitar el uso en JS
      if (obj.precio !== undefined) obj.precio = parseFloat(obj.precio) || 0;
      if (obj.precio_oferta !== undefined && obj.precio_oferta !== "") {
        obj.precio_oferta = parseFloat(obj.precio_oferta) || null;
      } else {
        obj.precio_oferta = null;
      }
      if (obj.stock !== undefined) obj.stock = parseInt(obj.stock) || 0;
      
      // Convertir booleanos o textos tipo SI/NO, TRUE/FALSE
      if (obj.destacado !== undefined) {
        var destStr = obj.destacado.toString().toLowerCase().trim();
        obj.destacado = (destStr === "true" || destStr === "yes" || destStr === "sí" || destStr === "si" || destStr === "1");
      }
      
      jsonArray.push(obj);
    }
  }
  
  // Ordenar los productos por la columna 'orden' si existe
  jsonArray.sort(function(a, b) {
    var orderA = parseFloat(a.orden) !== undefined && !isNaN(parseFloat(a.orden)) ? parseFloat(a.orden) : 9999;
    var orderB = parseFloat(b.orden) !== undefined && !isNaN(parseFloat(b.orden)) ? parseFloat(b.orden) : 9999;
    return orderA - orderB;
  });
  
  return createJsonResponse(jsonArray);
}

function createJsonResponse(data) {
  var result = JSON.stringify(data);
  return ContentService.createTextOutput(result)
    .setMimeType(ContentService.MimeType.JSON);
}
