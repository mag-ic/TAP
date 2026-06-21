export function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return null;

  // Parse first line as headers
  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.trim().toLowerCase();
      obj[cleanHeader] = values[index] ? values[index].trim() : '';
    });
    rows.push(obj);
  }
  return { headers: headers.map(h => h.trim().toLowerCase()), rows };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(val => val.replace(/^"|"$/g, '').trim()); // Remove outer quotes and whitespace
}
