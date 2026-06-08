# Invoice Data Extraction → Google Sheets (Gmail)

The Gmail version of the invoice automation. It watches a Gmail label, reads PDF invoices with Claude, and writes the results to a Google Sheet. Rows Claude is confident about go to the main tab; the rest go to a Needs Review tab.

The label is how you tell it which emails to look at: set up a Gmail filter (or just apply a label by hand) so invoice emails get tagged with, say, an `Invoices` label, and the workflow only ever touches that label. The Outlook version does the same thing with an Outlook folder instead.

If you use Outlook instead, grab the Outlook version in the folder next door. The only difference is the email node at the front.

## The flow

```
Schedule Trigger (every 60s)
        ↓
Get Invoices (Gmail — fetch messages from a label)
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

### What each step is doing

1. **Schedule Trigger** — the whole thing runs on a timer, checking for new invoices every 60 seconds. Nobody has to start it.
2. **Get Invoices** — pulls recent messages from the Gmail label you point it at, along with their attachments. Only emails carrying that label get looked at, so the rest of your inbox is left alone.
3. **Remove Duplicates** — keeps track of which emails it has already handled so the same invoice never gets processed (or written to the sheet) twice.
4. **Keep PDF's only** — throws out anything that isn't a PDF, like email signatures, logos, or images, so Claude only ever looks at actual invoice files.
5. **Analyze document** — this is the part doing the real work. Each PDF goes to Claude, which reads it like a person would and returns the invoice number, vendor, amount, a short description, and a confidence score, as clean JSON.
6. **Format Invoices** — Claude can return several invoices from one PDF (a statement with multiple line items, say). This step splits them into one row each and tags every row with the subject of the email it came from.
7. **IF confidence ≥ 80** — the quality gate. Claude scored how sure it was about each invoice from 0 to 100. Anything 80 or above is treated as trustworthy; anything below gets set aside.
8. **Regular Invoices vs. Needs Review** — confident rows land in the main **Regular Invoices** tab ready to use. Anything Claude wasn't sure about goes to a separate **Needs Review** tab so a person can glance at it before it counts, instead of a wrong number quietly ending up in the books.

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
2. Connect your Gmail account on the **Get Invoices** node and point it at the label you want watched. Make a Gmail filter that labels incoming invoice emails (or apply the label by hand) so they show up there.
3. Connect your Anthropic key on **Analyze document**.
4. Connect Google Sheets on **Regular Invoices** and **Needs Review**, and point each at the right tab.
5. Turn the workflow on.

## On legal invoices

This isn't tuned for law-firm billing. Legal invoices carry prior balances, service-period dates, and trust-account lines that the prompt doesn't account for, so anything legal should be checked by hand rather than trusted straight from the sheet. See the note in the main project README for more.
