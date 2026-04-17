import * as XLSX from 'xlsx';

/**
 * 將 JSON 資料匯出為 Excel (.xlsx) 檔案
 */
export const exportToExcel = <T extends Record<string, any>>(data: T[], filename: string, sheetName: string = '資料匯出') => {
  if (data.length === 0) return;
  
  // 建立工作表
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // 建立工作簿
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // 觸發下載
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

/**
 * 將多組資料匯出為含多個工作表 (Sheet) 的 Excel 檔案
 */
export const multiSheetExport = (sheets: { [sheetName: string]: any[] }, filename: string) => {
  const workbook = XLSX.utils.book_new();
  let hasData = false;
  
  for (const [name, data] of Object.entries(sheets)) {
    if (data && data.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, name);
      hasData = true;
    }
  }
  
  if (hasData) {
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  }
};

/**
 * 從 Excel (.xlsx) 檔案讀取資料並轉換為 JSON
 */
export const importFromExcel = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 讀取第一個工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 轉換為 JSON
        const json = XLSX.utils.sheet_to_json(worksheet);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};
