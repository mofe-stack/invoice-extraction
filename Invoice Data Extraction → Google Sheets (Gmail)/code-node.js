// ===== n8n Code node: Keep PDF's only =====

const results = [];
const items = $input.all();

for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const binary = item.binary || {};
  for (const key of Object.keys(binary)) {
    const att = binary[key];
    const name = (att.fileName || '').toLowerCase();
    const isPdf = att.mimeType === 'application/pdf' || name.endsWith('.pdf');
    if (isPdf) {
      results.push({
        json: { ...item.json, attachmentFileName: att.fileName },
        binary: { data: att },
        pairedItem: { item: i },
      });
    }
  }
}

return results;


// ===== n8n Code node: Format Invoices =====

const allItems = $input.all();
const pdfItems = $("Keep PDF's only").all();
const allInvoices = [];

function getSubject(j) {
  let subject = '(No subject)';
  if (j) {
    if (j.subject) subject = j.subject;
    else if (j.Subject) subject = j.Subject;
    else {
      const headers = j.payload && j.payload.headers;
      if (Array.isArray(headers)) {
        const h = headers.find(x => (x.name || '').toLowerCase() === 'subject');
        if (h && h.value) subject = h.value;
      }
    }
    if (subject === '(No subject)' && j.attachmentFileName) subject = j.attachmentFileName;
  }
  // Strip leading Fw:, Fwd:, Re: prefixes (handles repeats like "Fw: Re:")
  return subject.replace(/^((fw|fwd|re):\s*)+/i, '').trim();
}

for (let i = 0; i < allItems.length; i++) {
  const item = allItems[i];
  const source = pdfItems[i] ? pdfItems[i].json : {};
  const emailName = getSubject(source);

  const aiText = item.json.content[0].text;
  const invoices = JSON.parse(aiText);
  for (const invoice of invoices) {
    allInvoices.push({ ...invoice, emailName });
  }
}

return allInvoices.map(invoice => ({ json: invoice }));
