# Invoice Data Extraction → Google Sheets (Gmail)

The Gmail version of the invoice automation. It watches a Gmail label, reads PDF **and image** invoices with Claude, writes the results to a Google Sheet, and then files each handled email into a "Processed" label so the watched label only ever contains work that hasn't been done yet. Rows Claude is confident about go to the main tab; the rest go to a Needs Review tab.

The label is how you tell it which emails to look at: set up a Gmail filter (or just apply a label by hand) so invoice emails get tagged with, say, an `Invoices` label, and the workflow only ever touches that label. Once an email's invoices are in the sheet, the workflow swaps that label for a `Processed` one — so the `Invoices` label works like an inbox/queue and `Processed` is the archive.

If you use Outlook instead, grab the Outlook version in the folder next door. Heads up: the Outlook version is the original, simpler pipeline (PDF-only, no processed-folder step) — the features below are Gmail-only for now.

## The flow

```
Schedule Trigger (hourly)
        ↓
Get Invoices (Gmail — list messages from the label, no attachments)
        ↓
Remove Duplicates (skip messages already processed)
        ↓
Download Invoices (Gmail — fetch the full message + attachments by ID)
        ↓
Keep PDF's & Images only (drop signatures, logos, spacer images)
        ↓
Split PDF's & Images (route by attachment type)
       /                \
   PDFs                Images
     ↓                    ↓
Analyze PDF's       Analyze Images
(Claude, document)  (Claude, vision)
       \                /
    Combine PDF's & Images
              ↓
Format Invoices (one row per invoice, tag subject + message ID)
              ↓
       IF confidence ≥ 80
       /              \
     yes              no
      ↓                ↓
Regular Invoices   Needs Review
   (sheet tab)       (sheet tab)
       \              /
      Both Sheets Done
              ↓
   Unique Processed Emails (one item per source email)
              ↓
      Mark Processed (add "Processed" label)
              ↓
   Remove Invoices Label (take it out of the queue)
```

### What each step is doing

1. **Schedule Trigger** — runs every hour. Nobody has to start it.
2. **Get Invoices** — lists recent messages from the Gmail label you point it at (metadata only, attachments are *not* downloaded here). Only emails carrying that label get looked at, so the rest of your inbox is left alone.
3. **Remove Duplicates** — keeps track of which emails it has already handled so the same invoice never gets processed (or written to the sheet) twice. Since processed emails now leave the label entirely, this mostly matters as a backup — see below.
4. **Download Invoices** — fetches the full message and its attachments by message ID. Pulling attachments here, after the dedupe, means you only download files for messages you haven't already handled.
5. **Keep PDF's & Images only** — keeps PDFs and real image attachments (JPEG/PNG/GIF/WebP) and throws out the junk that rides along in email: signature images, logos, spacers. Images are filtered two ways — anything under 40 KB or with an inline-looking filename (`image001`, `logo`, `signature`, `banner`…) is dropped so Claude never burns an API call on a company logo.
6. **Split PDF's & Images** — a Switch that routes PDFs to the document-analysis node and images to the vision node.
7. **Analyze PDF's / Analyze Images** — the part doing the real work. Each attachment goes to Claude, which reads it like a person would and returns the invoice number, vendor, amount, a short description, and a confidence score as clean JSON. The image node handles photos, scans, and screenshots — including card-transaction screenshots and paper receipts, which count as payable items. Two nodes, two prompts (see `claude-prompt.md`), same output schema.
8. **Combine PDF's & Images** — merges the two analysis branches back into one stream.
9. **Format Invoices** — Claude can return several invoices from one attachment (a statement with multiple line items, say). This step splits them into one row each, tags every row with the subject of the email it came from, and carries the Gmail message ID through so the email can be relabeled at the end. It also parses defensively: stray code fences get stripped, empty `[]` results (non-billing attachments) are skipped instead of crashing.
10. **IF confidence ≥ 80** — the quality gate. Anything 80 or above is treated as trustworthy; anything below gets set aside.
11. **Regular Invoices vs. Needs Review** — confident rows land in the main tab ready to use. Anything Claude wasn't sure about goes to **Needs Review** so a person can glance at it before it counts.
12. **Both Sheets Done → Unique Processed Emails** — waits for both sheet writes, then collapses the invoice rows back down to one item per source email (a statement that produced five rows still only needs its one email relabeled once).
13. **Mark Processed / Remove Invoices Label** — adds the `Processed` label and removes the watched label. The email leaves the queue *only after* its rows are safely in the sheet — if the run dies before the sheet write, the email keeps its label and gets picked up again.

## Reliability

Every node that talks to the network (Gmail ×4, Claude ×2, Sheets ×2) has **retry-on-fail** turned on: 3 attempts, 5 seconds apart. This matters more than it sounds — self-hosted n8n in Docker gets occasional DNS blips (`EAI_AGAIN`), and without retries those show up as failed runs or, worse, a misleading *"credential needs to be reconnected"* error when the blip lands during an OAuth token refresh. If you see that error and the next run works fine, it was the network, not your credential.

The two labeling nodes are also set to **continue on error**: if relabeling hiccups after the sheet write succeeded, the run doesn't fail — the dedupe step prevents a double-write on the next pass.

### Why keep Remove Duplicates if processed emails leave the label?

Two reasons. Emails whose attachments produce *no* invoices (a signature-only email, a non-billing PDF) never reach the sheet step, so they never get relabeled — dedupe is what stops them being re-analyzed every hour. And if the run ever fails between the sheet write and the relabel, dedupe stops the retry from writing the same rows twice.

## The files

| File | What it is |
|------|------------|
| `workflow.json` | The n8n export. Import this into your own n8n instance. Credentials are stripped. |
| `claude-prompt.md` | The two prompts Claude uses — one for PDFs, one for images. |
| `code-node.js` | The three Code nodes — attachment filtering, row formatting, and the per-email dedupe before relabeling. |

## Setup

1. Import `workflow.json` into n8n.
2. In Gmail, create two labels: one to watch (e.g. `Invoices`) and one for finished mail (e.g. `Invoices Processed`). Make a Gmail filter that applies the watched label to incoming invoice emails (or apply it by hand).
3. Connect your Gmail account on the **Get Invoices**, **Download Invoices**, **Mark Processed**, and **Remove Invoices Label** nodes (same account on all four). Point **Get Invoices** and **Remove Invoices Label** at the watched label, and **Mark Processed** at the processed label.
4. Connect your Anthropic key on **Analyze PDF's** and **Analyze Images**.
5. Connect Google Sheets on **Regular Invoices** and **Needs Review**, and point each at the right tab.
6. Turn the workflow on.

## On legal invoices

This isn't tuned for law-firm billing. Legal invoices carry prior balances, service-period dates, and trust-account lines that the prompt doesn't account for, so anything legal should be checked by hand rather than trusted straight from the sheet. See the note in the main project README for more.
