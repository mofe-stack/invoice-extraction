/**
 * Code node — invoice parsing and flattening
 * 
 * Runs after the Anthropic node returns extracted invoice data.
 * Each upstream item represents one email; Claude's response for each
 * email is a JSON array of invoice objects (since one email can carry
 * a statement with multiple invoices on it).
 * 
 * This node:
 *   1. Loops through every email's Claude response
 *   2. Parses the JSON text into a real array
 *   3. Flattens everything into one list, where each invoice
 *      becomes its own n8n item
 * 
 * Output: one item per invoice, ready for the IF node to route
 * based on `type` (legal vs regular).
 */

// Get all items from Claude (one per email)
const allItems = $input.all();
const allInvoices = [];

// Loop through each email's Claude response
for (const item of allItems) {
  const aiText = item.json.content[0].text;
  
  // Parse the JSON string into a real array
  const invoices = JSON.parse(aiText);
  
  // Add all invoices from this email to our master list
  allInvoices.push(...invoices);
}

// Return each invoice as a separate item for the next node
return allInvoices.map(invoice => ({ json: invoice }));