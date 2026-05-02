const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', '庫存清單_2026-05-02-1.xlsx');
try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    console.log('--- Headers ---');
    if (data.length > 0) {
        console.log(Object.keys(data[0]));
    } else {
        console.log('No data found');
    }
    
    console.log('\n--- First 3 Rows ---');
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
} catch (err) {
    console.error('Error reading Excel file:', err.message);
}
