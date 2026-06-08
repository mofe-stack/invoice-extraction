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
Get many attachments (list attachments on each email)
        ↓
Keep PDF's only (drop non-PDF attachments before downloading)
        ↓
Download an attachment (pull the PDF file)
        ↓
Analyze document (Claude reads each PDF → JSON)
        ↓
Format Invoice (flatten into one row per invoice, attach the email subject)
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
4. **Get many attachments** — Outlook lists the attachments on each email (file name and type), without downloading them yet.
5. **Keep PDF's only** — filters that list down to PDFs, so signature images, logos, and other junk never get downloaded or sent to Claude. It runs *before* the download step so you don't waste calls pulling files you'll throw away.
6. **Download an attachment** — pulls the actual PDF file for each attachment that made it through the filter.
7. **Analyze document** — this is the part doing the real work. Each PDF goes to Claude, which reads it like a person would and returns the invoice number, vendor, amount, a short description, and a confidence score, as clean JSON.
8. **Format Invoice** — Claude can return several invoices from one PDF (a statement with multiple line items, say). This step splits them into one row each and tags every row with the subject of the email it came from.
9. **IF confidence ≥ 80** — the quality gate. Claude scored how sure it was about each invoice from 0 to 100. Anything 80 or above is treated as trustworthy; anything below gets set aside.
10. **Regular Invoices vs. Needs Review** — confident rows land in the main **Regular Invoices** tab ready to use. Anything Claude wasn't sure about goes to a separate **Needs Review** tab so a person can glance at it before it counts, instead of a wrong number quietly ending up in the books.

## The files

| File | What it is |
|------|------------|
| `workflow.json` | The n8n export. Import this into your own n8n instance. Credentials are stripped. |
| `claude-prompt.md` | The prompt Claude uses to read each PDF. |
| `code-node.js` | The two Code nodes — one keeps only PDF attachments, the other formats Claude's output into rows. |

## A couple of things worth knowing

The **Keep PDF's only** node sits between listing the attachments and downloading them. It checks each attachment's content type and file name and only lets PDFs through, so non-PDF attachments are dropped before they're ever downloaded or sent to Claude.

The **Format Invoice** node reads the source email's subject (Outlook exposes it as a plain `subject` field) and attaches it to every invoice from that email, so each row in the sheet shows where it came from. A statement with several line items produces several rows, all carrying the same subject.

## Setup

1. Import `workflow.json` into n8n.
2. Connect your Microsoft Outlook account on the message and attachment nodes, and point **Get many messages** at the folder you want watched.
3. Connect your Anthropic key on **Analyze document**.
4. Connect Google Sheets on **Regular Invoices** and **Needs Review**, and point each at the right tab.
5. Turn the workflow on.

## On legal invoices

This isn't tuned for law-firm billing. Legal invoices carry prior balances, service-period dates, and trust-account lines that the prompt doesn't account for, so anything legal should be checked by hand rather than trusted straight from the sheet. See the note in the main project README for more.
