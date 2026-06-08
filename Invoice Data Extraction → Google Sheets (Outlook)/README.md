# Invoice Data Extraction → Google Sheets (Outlook)

The Outlook version of the invoice automation. It watches an Outlook folder, reads PDF invoices with Claude, and writes the results to a Google Sheet. Rows Claude is confident about go to the main tab; the rest go to a Needs Review tab.

If you use Gmail instead, grab the Gmail version in the folder next door. The only difference is the email node at the front.

## The flow

```
Schedule Trigger (every 60s)
        ↓
Get many messages (Outlook folder)
        ↓
Remove Duplicates (skip messages already processed)
        ↓
Get many attachments  →  Download an attachment
        ↓
Analyze document (Claude reads each PDF → JSON)
        ↓
Code in JavaScript (flatten into one row per invoice, attach the email subject)
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
| `code-node.js` | The Code node that flattens Claude's output into one row per invoice. |

## A couple of things worth knowing

Outlook hands back attachments through its own nodes, so the flow uses **Get many attachments** and **Download an attachment** to pull the PDF binary before it reaches Claude.

The **Code in JavaScript** node reads the source email's subject (Outlook exposes it as a plain `subject` field) and attaches it to every invoice from that email, so each row in the sheet shows where it came from. A statement with several line items produces several rows, all carrying the same subject.

## Setup

1. Import `workflow.json` into n8n.
2. Connect your Microsoft Outlook account on the message and attachment nodes, and point **Get many messages** at the folder you want watched.
3. Connect your Anthropic key on **Analyze document**.
4. Connect Google Sheets on **Regular Invoices** and **Needs Review**, and point each at the right tab.
5. Turn the workflow on.

## On legal invoices

This isn't tuned for law-firm billing. Legal invoices carry prior balances, service-period dates, and trust-account lines that the prompt doesn't account for, so anything legal should be checked by hand rather than trusted straight from the sheet. See the note in the main project README for more.
