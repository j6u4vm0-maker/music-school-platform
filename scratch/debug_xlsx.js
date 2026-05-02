const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../庫存清單_2026-05-02-1.xlsx');
try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log('Total rows:', data.length);
    console.log('Headers (Keys of first row):', Object.keys(data[0] || {}));
    console.log('First row sample:', JSON.stringify(data[0], null, 2));
} catch (err) {
    console.error('Error reading Excel:', err);
}
