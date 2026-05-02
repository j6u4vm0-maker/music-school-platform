const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:\\Users\\USER\\Downloads\\庫存清單_2026-05-02-1.xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log('--- Headers ---');
  if (data.length > 0) {
    console.log(Object.keys(data[0]));
  }
  
  console.log('\n--- First Row ---');
  console.log(data[0]);
  
  console.log('\n--- Data Count ---');
  console.log(data.length);

} catch (err) {
  console.error('Error reading file:', err.message);
}
