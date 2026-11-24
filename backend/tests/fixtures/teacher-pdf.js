function pdf(marker = '') {
  const header = '%PDF-1.4\n';
  const catalog = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const pages = '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
  const data = header + catalog + pages + '%' + marker + '\n';
  return Buffer.from(data + 'xref\n0 3\n0000000000 65535 f \n' +
    String(header.length).padStart(10, '0') + ' 00000 n \n' +
    String(header.length + catalog.length).padStart(10, '0') + ' 00000 n \n' +
    'trailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n' + data.length + '\n%%EOF\n');
}

module.exports = { pdf };
