// ===== n8n Code node: Keep PDF's & Images only =====

const results = [];
const items = $input.all();

const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Inline logos/signatures/spacers are small and/or have generic names.
// Tune these two if a real invoice image ever gets dropped.
const MIN_IMAGE_BYTES = 40 * 1024; // 40 KB
const INLINE_NAME = /^(image\d+|outlook-|att\d+|logo|signature|sig[-_]?|icon|spacer|banner|header|footer|cid)/i;

function toBytes(fs) {
  if (typeof fs === 'number') return fs;
  if (!fs) return 0;
  const m = String(fs).trim().match(/^([\d.]+)\s*(b|kb|mb|gb)?$/i);
  if (!m) return 0;
  const mult = { b: 1, kb: 1024, mb: 1048576, gb: 1073741824 }[(m[2] || 'b').toLowerCase()];
  return parseFloat(m[1]) * mult;
}

for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const binary = item.binary || {};

  for (const key of Object.keys(binary)) {
    const att = binary[key];
    const name = (att.fileName || '').toLowerCase();
    const mime = att.mimeType || '';

    const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
    const isImage = imageTypes.includes(mime) || imageExts.some(ext => name.endsWith(ext));

    let keep = false;
    if (isPdf) {
      keep = true; // real invoices are almost always PDFs
    } else if (isImage) {
      const tooSmall = toBytes(att.fileSize) > 0 && toBytes(att.fileSize) < MIN_IMAGE_BYTES;
      const looksInline = !name || INLINE_NAME.test(name);
      keep = !tooSmall && !looksInline; // drop logos / signatures / spacers
    }

    if (keep) {
      results.push({
        json: { ...item.json, attachmentFileName: att.fileName, attachmentMimeType: mime },
        binary: { data: att },
        pairedItem: { item: i },
      });
    }
  }
}

return results;


// ===== n8n Code node: Format Invoices =====

const allItems = $input.all();
const keepItems = $("Keep PDF's & Images only").all();

// Rebuild source order to match the Merge (Append): PDF branch first, then image branch.
// (Merge Input 1 = Analyze PDF's, Input 2 = Analyze Images.)
const pdfSources = keepItems.filter(it => (it.json && it.json.attachmentMimeType) === 'application/pdf');
const imageSources = keepItems.filter(it => String((it.json && it.json.attachmentMimeType) || '').startsWith('image/'));
const orderedSources = [...pdfSources, ...imageSources];

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
  return subject.replace(/^((fw|fwd|re):\s*)+/i, '').trim();
}

function parseInvoices(text) {
  if (text == null) return [];
  let t = String(text).trim();
  if (!t) return [];
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const parsed = JSON.parse(t.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    return [];
  }
}

for (let i = 0; i < allItems.length; i++) {
  const item = allItems[i];
  const aiText = item.json && item.json.content && item.json.content[0] && item.json.content[0].text;
  const invoices = parseInvoices(aiText);
  if (invoices.length === 0) continue;

  const source = orderedSources[i] ? orderedSources[i].json : {};
  const emailName = getSubject(source);
  const messageId = source.id || null;
  for (const invoice of invoices) {
    allInvoices.push({ ...invoice, emailName, messageId });
  }
}

return allInvoices.map(invoice => ({ json: invoice }));


// ===== n8n Code node: Unique Processed Emails =====

const seen = new Set();
const out = [];
for (const item of $("Format Invoices").all()) {
  const id = item.json && item.json.messageId;
  if (id && !seen.has(id)) {
    seen.add(id);
    out.push({ json: { messageId: id } });
  }
}
return out;
