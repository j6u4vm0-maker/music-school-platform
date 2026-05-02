const XLSX = require('xlsx');
const filePath = 'C:\\Users\\USER\\Downloads\\庫存清單_2026-05-02-1.xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  
  console.log('--- ALL UNIQUE HEADERS ---');
  const headers = new Set();
  data.forEach(row => Object.keys(row).forEach(k => headers.add(k)));
  console.log(Array.from(headers));
  
  console.log('\n--- SAMPLE ROW FOR 音樂家小舖 ---');
  const sample = data.find(r => r['分類'] === '音樂家小舖' || r['品牌 / 出版社'] === '音樂家小舖');
  console.log(sample);

} catch (err) {
  console.error(err);
}
