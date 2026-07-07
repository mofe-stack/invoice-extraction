# 📄 Invoice Extraction → Google Sheets

An automation I built for a small accounting firm that was tired of hand-typing invoices into a spreadsheet. They were getting PDFs by email all day and keying each one in by hand, so I built an automation that does it for them.

An invoice lands in your inbox — a PDF, a scanned image, even a screenshot of a card transaction — n8n grabs it, Claude reads it and pulls out the vendor, invoice number, amount, and a short description, and the row shows up in a Google Sheet. If Claude isn't sure about a row, it gets sent to a separate "Needs Review" tab instead of going straight into your books. Once an email has been handled, it's filed into a "Processed" label, so the watched label only ever contains invoices that still need doing.

There are two versions, depending on which inbox you use:

- [**Invoice Data Extraction → Google Sheets (Gmail)**](./Invoice%20Data%20Extraction%20%E2%86%92%20Google%20Sheets%20%28Gmail%29)
- [**Invoice Data Extraction → Google Sheets (Outlook)**](./Invoice%20Data%20Extraction%20%E2%86%92%20Google%20Sheets%20%28Outlook%29)

Both versions have the same feature set: PDF **and image** extraction, transaction/receipt handling, automatic retries on network failures, and the processed filing. Gmail files finished emails by swapping labels; Outlook moves them to a folder. The Gmail version is the one running in production; the Outlook version mirrors it node-for-node in the Outlook way.

## How it works

```
Schedule Trigger (hourly)
        ↓
Get new emails from the watched label
        ↓
Remove Duplicates (backup guard against double-processing)
        ↓
Keep PDF & image attachments (drop logos, signatures, spacers)
        ↓
Split by type → Claude reads PDFs (document) and images (vision)
        ↓
Format the results into one row per invoice
        ↓
       IF confidence ≥ 80
       /              \
     yes              no
      ↓                ↓
Regular Invoices   Needs Review
   (sheet tab)       (sheet tab)
       \              /
        ↓ after both writes
Move the email to "Processed" (Gmail label swap / Outlook folder move)
```

The confidence score is the part I care about most. Claude rates how sure it is about each extraction from 0 to 100. Clean, clearly-readable invoices score high and go straight to the main tab. Anything blurry, cut off, or ambiguous scores low and lands in Needs Review so a person can glance at it before it counts. The idea is that a wrong number sitting quietly in your books is worse than one that asks for ten seconds of attention.

The processed-label step is the newest piece. Emails only leave the watched label *after* their rows are safely in the sheet, which makes the label itself the source of truth: whatever's in it still needs processing, whatever's in "Processed" is done. The Remove Duplicates step stays as a backup — it catches emails that produce no invoices at all (signature-only emails, non-billing attachments) and protects against double-writes if a run fails mid-way.

## What gets pulled out

Each invoice becomes one object:

```json
{
  "invoice_number": "1042",
  "vendor": "Mavryk",
  "details": "Janitorial services April 2026",
  "amount": 1850.00,
  "confidence": 96
}
```

Statements with several line items turn into several rows, one per item. Card-transaction screenshots and paper receipts count as payable items too — those get the transaction date (like `Jun-26`) as their invoice number, since they don't have a real one.

## Reliability

Every node that touches the network retries automatically (3 attempts, 5s apart). Self-hosted n8n in Docker occasionally hits DNS blips, and without retries those surface as failed runs — or as a misleading "credential needs to be reconnected" error when the blip lands during a token refresh. With retries, the run just pauses a few seconds and carries on.

## Cost

About 2 cents per invoice in Claude API usage. Roughly $2/month if you're doing 100 invoices. n8n hosting is separate — n8n Cloud is around $20/month, or you can self-host it for free.

## A note on legal invoices

This isn't built for law-firm bills. Legal invoices have their own quirks — prior outstanding balances listed alongside current charges, service-period dates that don't match the issue date, trust-account lines — and the prompt doesn't try to handle any of that. If you feed it a legal invoice it'll usually still extract *something*, but treat the result as a starting point, not a finished entry. Handling legal billing properly would mean its own prompt and probably its own routing.

## Stack

- [n8n](https://n8n.io) for the workflow
- [Claude](https://www.anthropic.com) (`claude-sonnet-4-6`) for reading the PDFs and images
- Gmail or Microsoft Outlook for the inbox
- Google Sheets for the output

## Using it

Each folder has the workflow export, the prompt(s), and the code node(s). Import the `workflow.json` into your own n8n instance, plug in your own Gmail/Outlook, Anthropic, and Google Sheets credentials, point it at the label/folder and sheet you want, and turn it on. The exports are sanitized, so none of my credentials come with them.

## Contacts

- Email: mofeatanda@outlook.com or mofmofcool@gmail.com
- Reddit: SignTraditional1806

## License

MIT — use, learn from, fork freely. See [LICENSE](./LICENSE).
