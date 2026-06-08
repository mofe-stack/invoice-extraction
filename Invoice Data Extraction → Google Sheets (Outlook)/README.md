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

### What each step is doing

1. **Schedule Trigger** — the whole thing runs on a timer, checking for new invoices every 60 seconds. Nobody has to start it.
2. **Get many messages** — pulls recent messages from the Outlook folder you point it at.
3. **Remove Duplicates** — keeps track of which emails it has already handled so the same invoice never gets processed (or written to the sheet) twice.
4. **Get many attachments → Download an attachment** — Outlook hands back attachments through its own nodes, so these two pull the actual PDF file out of each email before anything else happens.
5. **Analyze document** — this is the part doing the real work. Each PDF goes to Claude, which reads it like a person would and returns the invoice number, vendor, amount, a short description, and a confidence score, as clean JSON.
6. **Code in JavaScript** — Claude can return several invoices from one PDF (a statement with multiple line items, say). This step splits them into one row each and tags every row with the subject of the email it came from.
7. **IF confidence ≥ 80** — the quality gate. Claude scored how sure it was about each invoice from 0 to 100. Anything 80 or above is treated as trustworthy; anything below gets set aside.
8. **Regular Invoices vs. Needs Review** — confident rows land in the main **Regular Invoices** tab ready to use. Anything Claude wasn't sure about goes to a separate **Needs Review** tab so a person can glance at it before it counts, instead of a wrong number quietly ending up in the books.

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
