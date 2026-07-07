# Invoice Data Extraction → Google Sheets (Outlook)

The Outlook version of the invoice automation. It watches an Outlook folder, reads PDF **and image** invoices with Claude, writes the results to a Google Sheet, and then moves each handled email into a "Processed" folder so the watched folder only ever contains work that hasn't been done yet. Rows Claude is confident about go to the main tab; the rest go to a Needs Review tab.

The folder is how you tell it which emails to look at: use an Outlook rule (or drag emails by hand) so invoice emails land in, say, an `Invoices` folder, and the workflow only ever touches that folder. Once an email's invoices are in the sheet, the workflow moves it to the `Processed` folder — so `Invoices` works like an inbox/queue and `Processed` is the archive. This is the Outlook equivalent of the Gmail version's label swap, and it's actually simpler: one move does both halves.

If you use Gmail instead, grab the Gmail version in the folder next door. Same features, same prompts — the differences are just the mail nodes and how Outlook hands over attachments.

## The flow

```
Schedule Trigger (hourly)
        ↓
Get many messages (Outlook — list messages in the folder, with attachments)
        ↓
Remove Duplicates (skip messages already processed)
        ↓
Get many attachments (list attachment metadata per email)
        ↓
Keep PDF's & Images only (filter on metadata — nothing downloaded yet)
        ↓
Split PDF's & Images (route by attachment type)
       /                \
   PDFs                Images
     ↓                    ↓
Download PDF        Download Image
Attachment          Attachment
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
   Move to Processed Folder
```

### What each step is doing

1. **Schedule Trigger** — runs every hour. Nobody has to start it.
2. **Get many messages** — lists messages from the Outlook folder you point it at, filtered to ones that actually have attachments. Only that folder gets looked at, so the rest of your mailbox is left alone.
3. **Remove Duplicates** — keeps track of which emails it has already handled so the same invoice never gets processed (or written to the sheet) twice. Since processed emails now leave the folder entirely, this mostly matters as a backup — see below.
4. **Get many attachments** — lists each email's attachments as *metadata* (name, content type, size, whether it's inline). No files are downloaded yet.
5. **Keep PDF's & Images only** — the nice thing about Outlook is you can filter before downloading anything. PDFs pass straight through; images (JPEG/PNG/GIF/WebP) pass only if they don't look like email junk — Outlook's own `isInline` flag, anything under 40 KB, and inline-looking filenames (`image001`, `logo`, `signature`, `banner`…) all get dropped, so Claude never burns an API call on a company logo. This step also stamps each attachment with the email's subject and message ID (needed later for the move).
6. **Split PDF's & Images** — a Switch that routes PDFs one way and images the other.
7. **Download PDF / Image Attachment** — now the actual files get downloaded, one branch each. Because the junk was filtered on metadata first, only files worth analyzing ever get pulled.
8. **Analyze PDF's / Analyze Images** — the part doing the real work. Each attachment goes to Claude, which reads it like a person would and returns the invoice number, vendor, amount, a short description, and a confidence score as clean JSON. The image node handles photos, scans, and screenshots — including card-transaction screenshots and paper receipts, which count as payable items. Two nodes, two prompts (see `claude-prompt.md`), same output schema.
9. **Combine PDF's & Images** — merges the two analysis branches back into one stream.
10. **Format Invoices** — Claude can return several invoices from one attachment (a statement with multiple line items, say). This step splits them into one row each, tags every row with the email subject (with `Re:`/`Fwd:` prefixes stripped), and carries the message ID through for the move at the end. It also parses defensively: stray code fences get stripped, empty `[]` results (non-billing attachments) are skipped instead of crashing.
11. **IF confidence ≥ 80** — the quality gate. Anything 80 or above is treated as trustworthy; anything below gets set aside.
12. **Regular Invoices vs. Needs Review** — confident rows land in the main tab ready to use. Anything Claude wasn't sure about goes to **Needs Review** so a person can glance at it before it counts.
13. **Both Sheets Done → Unique Processed Emails** — waits for both sheet writes, then collapses the invoice rows back down to one item per source email (a statement that produced five rows still only needs its one email moved once).
14. **Move to Processed Folder** — moves the email out of the watched folder and into `Processed`. One operation does what takes the Gmail version two label nodes. The email leaves the queue *only after* its rows are safely in the sheet — if the run dies before the sheet write, the email stays put and gets picked up again.

## Reliability

Every node that talks to the network (Outlook ×4, Claude ×2, Sheets ×2) has **retry-on-fail** turned on: 3 attempts, 5 seconds apart. Self-hosted n8n in Docker gets occasional DNS blips, and without retries those show up as failed runs — or as a misleading *"credential needs to be reconnected"* error when the blip lands during an OAuth token refresh. If you see that error and the next run works fine, it was the network, not your credential.

The move node is also set to **continue on error**: if the move hiccups after the sheet write succeeded, the run doesn't fail — the dedupe step prevents a double-write on the next pass.

### Why keep Remove Duplicates if processed emails leave the folder?

Two reasons. Emails whose attachments produce *no* invoices (a signature-only email, a non-billing PDF) never reach the sheet step, so they never get moved — dedupe is what stops them being re-analyzed every hour. And if the run ever fails between the sheet write and the move, dedupe stops the retry from writing the same rows twice.

## The files

| File | What it is |
|------|------------|
| `workflow.json` | The n8n export. Import this into your own n8n instance. Credentials are stripped. |
| `claude-prompt.md` | The two prompts Claude uses — one for PDFs, one for images. |
| `code-node.js` | The three Code nodes — attachment filtering, row formatting, and the per-email dedupe before the move. |

## Setup

1. Import `workflow.json` into n8n.
2. In Outlook, create two folders: one to watch (e.g. `Invoices`) and one for finished mail (e.g. `Processed`). Set up an Outlook rule that files incoming invoice emails into the watched folder (or drag them there by hand).
3. Connect your Microsoft account on the **Get many messages**, **Get many attachments**, **Download PDF Attachment**, **Download Image Attachment**, and **Move to Processed Folder** nodes (same account on all five). Point **Get many messages** at the watched folder and **Move to Processed Folder** at the processed folder.
4. Connect your Anthropic key on **Analyze PDF's** and **Analyze Images**.
5. Connect Google Sheets on **Regular Invoices** and **Needs Review**, and point each at the right tab.
6. Turn the workflow on.

## On legal invoices

This isn't tuned for law-firm billing. Legal invoices carry prior balances, service-period dates, and trust-account lines that the prompt doesn't account for, so anything legal should be checked by hand rather than trusted straight from the sheet. See the note in the main project README for more.
