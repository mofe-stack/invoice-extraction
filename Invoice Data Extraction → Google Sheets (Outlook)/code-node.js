// ===== n8n Code node: Keep PDF's only =====

// Keep PDF's only — Outlook
// Sits between "Get many attachments" and "Download an attachment".
// Outlook gives us attachment metadata here (name + contentType, no file yet),
// so we filter on that and only let PDFs through to be downloaded.

const items = $input.all();
const results = [];

for (let i = 0; i < items.length; i++) {
  const j = items[i].json || {};
  const name = (j.name || '').toLowerCase();
  const contentType = (j.contentType || '').toLowerCase();

  const isPdf = contentType === 'application/pdf' || name.endsWith('.pdf');

  if (isPdf) {
    results.push({
      json: j,
      pairedItem: items[i].pairedItem ?? { item: i },
    });
  }
}

return results;


// ===== n8n Code node: Format Invoice =====

// Get all items from Claude (one per attachment)
const allItems = $input.all();
const allInvoices = [];

// Get the source email subject for this run
const sourceMessage = $('Get many messages').item.json;
const emailName = sourceMessage.subject || '(No subject)';

// Loop through each AI response
for (const item of allItems) {
  const aiText = item.json.content[0].text;
  
  // Parse the JSON string into a real array
  const invoices = JSON.parse(aiText);
  
  // Attach the source email subject to every invoice from this email
  for (const invoice of invoices) {
    allInvoices.push({
      ...invoice,
      emailName: emailName
    });
  }
}

// Return each invoice as a separate item for the next node
return allInvoices.map(invoice => ({ json: invoice }));
