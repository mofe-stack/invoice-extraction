// ===== n8n Code node: Code in JavaScript =====

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
