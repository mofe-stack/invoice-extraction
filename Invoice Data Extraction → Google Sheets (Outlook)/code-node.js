// ===== n8n Code node: Keep PDF's & Images only =====

// Keep PDF's & Images only — Outlook
// Sits between "Get many attachments" and the download nodes.
// Outlook gives us attachment metadata here (name, contentType, size, isInline —
// no file yet), so we filter on that and only download what's worth analyzing.

const items = $input.all();
const results = [];

const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Inline logos/signatures/spacers are small and/or have generic names.
// Outlook also flags true inline images with isInline.
// Tune these two if a real invoice image ever gets dropped.
const MIN_IMAGE_BYTES = 40 * 1024; // 40 KB
const INLINE_NAME = /^(image\d+|outlook-|att\d+|logo|signature|sig[-_]?|icon|spacer|banner|header|footer|cid)/i;

for (let i = 0; i < items.length; i++) {
  const j = items[i].json || {};
  const name = (j.name || '').toLowerCase();
  const contentType = (j.contentType || '').toLowerCase();

  const isPdf = contentType === 'application/pdf' || name.endsWith('.pdf');
  const isImage = imageTypes.includes(contentType) || imageExts.some(ext => name.endsWith(ext));

  let kind = null;
  if (isPdf) {
    kind = 'pdf'; // real invoices are almost always PDFs
  } else if (isImage) {
    const tooSmall = typeof j.size === 'number' && j.size > 0 && j.size < MIN_IMAGE_BYTES;
    const looksInline = j.isInline === true || !name || INLINE_NAME.test(name);
    if (!tooSmall && !looksInline) kind = 'image'; // drop logos / signatures / spacers
  }

  if (kind) {
    const msg = $('Get many messages').itemMatching(i).json;
    results.push({
      json: {
        ...j,
        attachmentKind: kind,
        attachmentFileName: j.name,
        emailSubject: msg.subject || '(No subject)',
        messageId: msg.id,
      },
      pairedItem: items[i].pairedItem ?? { item: i },
    });
  }
}

return results;


// ===== n8n Code node: Format Invoices =====

const allItems = $input.all();
const keepItems = $("Keep PDF's & Images only").all();

// Rebuild source order to match the Merge (Append): PDF branch first, then image branch.
// (Merge Input 1 = Analyze PDF's, Input 2 = Analyze Images.)
const pdfSources = keepItems.filter(it => (it.json && it.json.attachmentKind) === 'pdf');
const imageSources = keepItems.filter(it => (it.json && it.json.attachmentKind) === 'image');
const orderedSources = [...pdfSources, ...imageSources];

const allInvoices = [];

function cleanSubject(s) {
  return String(s || '(No subject)').replace(/^((fw|fwd|re):\s*)+/i, '').trim();
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
  const emailName = cleanSubject(source.emailSubject || source.attachmentFileName);
  const messageId = source.messageId || null;
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
