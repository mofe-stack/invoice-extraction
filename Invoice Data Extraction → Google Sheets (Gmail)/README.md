# Invoice Data Extraction → Google Sheets (Gmail)

The Gmail version of the invoice automation. It watches a Gmail inbox, reads PDF invoices with Claude, and writes the results to a Google Sheet. Rows Claude is confident about go to the main tab; the rest go to a Needs Review tab.

If you use Outlook instead, grab the Outlook version in the folder next door. The only difference is the email node at the front.

## The flow

```
Schedule Trigger (every 60s)
        ↓
Get Invoices (Gmail — fetch recent messages)
        ↓
Remove Duplicates (skip messages already processed)
        ↓
Keep PDF's only (drop non-PDF attachments)
        ↓
Analyze document (Claude reads each PDF → JSON)
        ↓
Format Invoices (flatten into one row per invoice, attach the email subject)
        ↓
       IF confidence ≥ 80
       /              \
     yes              no
      ↓                ↓
Regular Invoices   Needs Review
   (sheet tab)       (sheet tab)
```

## The files

| File | What it is |
|------|------------|
| `workflow.json` | The n8n export. Import this into your own n8n instance. Credentials are stripped. |
| `claude-prompt.md` | The prompt Claude uses to read each PDF. |
| `code-node.js` | The two Code nodes — one keeps only PDF attachments, the other formats Claude's output into rows. |

## A couple of things worth knowing

The "Keep PDF's only" node runs before Claude so you don't burn API calls on logos, signatures, or random image attachments. It checks both the MIME type and the `.pdf` extension.

The "Format Invoices" node digs the original email subject out of Gmail's payload (Gmail nests it under `payload.headers`, not a plain `subject` field) and strips `Re:`/`Fwd:` prefixes so forwarded invoices read cleanly in the sheet. Each invoice row carries the subject of the email it came from.

## Setup

1. Import `workflow.json` into n8n.
2. Connect your Gmail account on the **Get Invoices** node and point it at the label or inbox you want watched.
3. Connect your Anthropic key on **Analyze document**.
4. Connect Google Sheets on **Regular Invoices** and **Needs Review**, and point each at the right tab.
5. Turn the workflow on.

## On legal invoices

This isn't tuned for law-firm billing. Legal invoices carry prior balances, service-period dates, and trust-account lines that the prompt doesn't account for, so anything legal should be checked by hand rather than trusted straight from the sheet. See the note in the main project README for more.
