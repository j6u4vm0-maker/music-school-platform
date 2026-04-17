export const downloadCSV = <T extends Record<string, any>>(data: T[], filename: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(header => {
      const val = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',')
  );
  // Add BOM for UTF-8 (Excel compatibility for Chinese characters)
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const parseCSV = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        // Basic CSV regex parsing respecting quotes
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) resolve([]);
        const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
        const result = lines.slice(1).map(line => {
          // Split by comma, but ignore commas inside quotes
          const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
          return headers.reduce((acc, h, i) => {
            acc[h] = values[i];
            return acc;
          }, {} as any);
        });
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
};
