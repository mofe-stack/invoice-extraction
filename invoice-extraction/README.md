# Invoice Extraction Workflow

End-to-end automation that turns invoice PDFs arriving by email into structured rows in a Google Sheet — with intelligent routing between standard AP entries and legal invoices that need separate review.

Built with **n8n**, **Claude**, and the **Microsoft Graph** + **Google Sheets** APIs.

## The problem

Finance teams handling accounts payable spend hours each week on the same tedious loop:

1. Open Outlook
2. Download the PDF attachment
3. Squint at it to find the invoice number, vendor, amount, and what it's for
4. Type it into a spreadsheet
5. Repeat for every invoice that came in that day

It's slow. It's error-prone. Vendors get missed. Numbers get fat-fingered. Legal invoices accidentally get treated like regular ones and slip past approval. And it gets worse during month-end.

## The solution

The workflow runs every 60 seconds in the background. When a new email lands in a designated Outlook folder:

1. The attachment is pulled automatically
2. Claude reads the PDF and extracts structured invoice data — handling everything from single invoices to multi-line statements, tax notices, credit memos, and law-firm bills with prior outstanding balances
3. Each invoice is routed to the right sheet tab based on its type
4. Within 60–90 seconds of the email arriving, the data is in the spreadsheet

No human in the loop unless something goes wrong.

## How it works

```
Schedule Trigger (every 60s)
        ↓
Get many messages (Outlook folder)
        ↓
Remove Duplicates (skip already-processed emails)
        ↓
Get many attachments
        ↓
Download an attachment
        ↓
Analyze document (Claude — PDF in, JSON out)
        ↓
Code in JavaScript (flatten array of invoices into items)
        ↓
       IF (type === "legal")
       /              \
     true            false
      ↓                ↓
Legal Invoices    Regular Invoices
   (sheet tab)      (sheet tab)
```

## Why this works

A few design decisions worth calling out:

**Claude does the hard part.** PDF parsing libraries can extract text, but they can't tell you *which* number is the invoice total versus a subtotal versus a previous balance versus a credit. Claude reads the document the way a human would and applies domain-specific rules — see `claude-prompt.md` for the full prompt.

**Outstanding invoices get extracted separately, not as a lump sum.** Legal statements typically list current charges plus prior unpaid balances together. The prompt extracts them as separate line items so the sheet preserves per-invoice history, not a single "Total Due" that's painful to reconcile.

**Service-period dating for legal work.** Legal invoices bill in arrears, so using the issue date misattributes the expense to the wrong month. The prompt explicitly hunts for service period markers in the document and only falls back to date math if nothing is stated.

**Credit memos are negative numbers, not separate columns.** A `-250.00` credit cancels a `+250.00` charge cleanly via SUM formulas — no special handling needed downstream.

**Type-based routing.** Legal invoices need separate review/approval in most finance workflows. Routing them to their own tab via the IF node keeps the standard AP flow uncluttered.

## Stack

- [**n8n**](https://n8n.io) — workflow orchestration
- [**Anthropic Claude**](https://anthropic.com) (`claude-sonnet-4-6`) — document extraction
- **Microsoft Graph API** — Outlook integration
- **Google Sheets API** — data destination

## Cost

Roughly **$0.02 per invoice** in Claude API spend. A business processing 100 invoices/month spends about **$2/month**.

n8n hosting is separate — n8n Cloud starts around $20/month, or self-host for free.

## Files in this folder

| File | What it is |
|------|-----------|
| `workflow.json` | n8n workflow export, sanitized. Import into your own n8n instance. |
| `claude-prompt.md` | The full extraction prompt with design notes. |
| `code-node.js` | The JavaScript that flattens Claude's response into individual items. |

Setup walkthrough and troubleshooting docs coming soon.

## Adapting this for something else

The architecture isn't invoice-specific. Swap the prompt and the destination, and the same pattern works for:

- Resume screening (PDF → structured candidate data → ATS or sheet)
- Contract review (PDF → extracted clauses + risk flags → Notion/Airtable)
- Receipt categorization (image/PDF → categorized expense → expense tracker)
- Support ticket triage (email → categorized + prioritized → Zendesk/help desk)
- Real estate listing parsing (PDF brochure → structured listing data → CRM)

The Code node in particular is fully reusable — it doesn't know or care what's being extracted. See `code-node.js` for notes.

## Limitations and future work

Honest about what this v1 doesn't do:

- **No validation.** If Claude returns malformed JSON or a missing field, the workflow currently fails or writes garbage. A v2 would add a validation step that routes bad extractions to an error log.
- **No notifications.** Failures show up only in the n8n executions tab. Could add Slack/email alerts for failed runs.
- **No retries.** A single transient API hiccup will skip that email (deduplication will prevent re-processing). Worth adding error-handling branches with retry logic.
- **Single language.** Tested only on English invoices. Should work on others with prompt tuning.
- **No duplicate detection.** Doesn't check whether the same invoice has already been written to the sheet, or whether extracted amounts match what's stated in the email body.

These are all real improvements, not deal-breakers. The current version reliably handles real production volume — these are v2 priorities once base usage proves out.

## Built for

Originally built for a small finance team processing dozens of invoices per week across multiple entity types. The legal-vs-regular split was driven by their real approval workflow, where law firm bills go through separate review before payment.