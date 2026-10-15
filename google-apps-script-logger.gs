/**
 * GOOGLE APPS SCRIPT: LOGGER PEMANTAU DASHBOARD PPPK BGTK SUMBAR
 * 
 * Cara Pasang (Hanya 1 Menit):
 * 1. Buka Google Drive -> Buat Google Spreadsheet baru, beri nama: "Log Akses Pemantau PPPK"
 * 2. Di menu spreadsheet, klik Extensions -> Apps Script.
 * 3. Hapus kode default, lalu salin dan tempel seluruh kode di bawah ini.
 * 4. Klik tombol "Deploy" (pojok kanan atas) -> "New deployment".
 * 5. Pilih Type: "Web app".
 * 6. Execute as: "Me" (email Anda).
 * 7. Who has access: "Anyone" (Siapa saja, agar dashboard bisa mengirim log tanpa login).
 * 8. Klik "Deploy" -> Salin Web App URL yang dihasilkan.
 * 9. Tempelkan URL tersebut ke TRACKER_CONFIG.GOOGLE_SHEET_WEBAPP_URL di berkas tracker.js!
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Buat Header jika sheet masih kosong
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Waktu", "Visitor ID", "Session ID", "Device", "OS", 
        "Browser", "Layar", "IP", "Lokasi", "ISP", "Jenis Aksi", "Rincian Aktivitas"
      ]);
      sheet.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#0f2b48").setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }
    
    var data = JSON.parse(e.postData.contents);
    
    sheet.appendRow([
      data.timestamp || new Date(),
      data.visitorId || "-",
      data.sessionId || "-",
      data.device || "-",
      data.os || "-",
      data.browser || "-",
      data.screen || "-",
      data.ip || "-",
      data.location || "-",
      data.isp || "-",
      data.actionType || "-",
      data.actionDetail || "-"
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Endpoint Logger Pemantau PPPK BGTK Sumbar Aktif.")
    .setMimeType(ContentService.MimeType.TEXT);
}
