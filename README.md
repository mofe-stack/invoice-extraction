# 📄 Invoice Extraction → Google Sheets

An automation I built for a small accounting firm that was tired of hand-typing invoices into a spreadsheet. They were getting PDFs by email all day and keying each one in by hand, so I built an automation that does it for them.

A PDF invoice lands in your inbox, n8n grabs it, Claude reads it and pulls out the vendor, invoice number, amount, and a short description, and the row shows up in a Google Sheet a minute or so later. If Claude isn't sure about a row, it gets sent to a separate "Needs Review" tab instead of going straight into your books.

There are two versions, depending on which inbox you use:

- [**Invoice Data Extraction → Google Sheets (Gmail)**](./Invoice%20Data%20Extraction%20%E2%86%92%20Google%20Sheets%20%28Gmail%29)
- [**Invoice Data Extraction → Google Sheets (Outlook)**](./Invoice%20Data%20Extraction%20%E2%86%92%20Google%20Sheets%20%28Outlook%29)

Both work the same way. The only real difference is the email node at the front — one reads from Gmail, the other from Outlook.

## How it works

```
Schedule Trigger (every 60s)
        ↓
Get new emails from the inbox
        ↓
Remove Duplicates (skip emails already handled)
        ↓
Keep PDF attachments
        ↓
Analyze document (Claude reads the PDF, returns JSON)
        ↓
Format the result into one row per invoice
        ↓
       IF confidence ≥ 80
       /              \
     yes              no
      ↓                ↓
Regular Invoices   Needs Review
   (sheet tab)       (sheet tab)
```

The confidence score is the part I care about most. Claude rates how sure it is about each extraction from 0 to 100. Clean, clearly-readable invoices score high and go straight to the main tab. Anything blurry, cut off, or ambiguous scores low and lands in Needs Review so a person can glance at it before it counts. The idea is that a wrong number sitting quietly in your books is worse than one that asks for ten seconds of attention.

## What gets pulled out

Each invoice becomes one object:

```json
{
  "invoice_number": "INV-1042",
  "vendor": "Mavryk",
  "details": "Janitorial services April 2026",
  "amount": 1850.00,
  "confidence": 96
}
```

Statements with several line items turn into several rows, one per item.

## Cost

About 2 cents per invoice in Claude API usage. Roughly $2/month if you're doing 100 invoices. n8n hosting is separate — n8n Cloud is around $20/month, or you can self-host it for free.

## A note on legal invoices

This isn't built for law-firm bills. Legal invoices have their own quirks — prior outstanding balances listed alongside current charges, service-period dates that don't match the issue date, trust-account lines — and the prompt doesn't try to handle any of that. If you feed it a legal invoice it'll usually still extract *something*, but treat the result as a starting point, not a finished entry. Handling legal billing properly would mean its own prompt and probably its own routing.

## Stack

- [n8n](https://n8n.io) for the workflow
- [Claude](https://www.anthropic.com) (`claude-sonnet-4-6`) for reading the PDFs
- Gmail or Microsoft Outlook for the inbox
- Google Sheets for the output

## Using it

Each folder has the workflow export, the prompt, and the code node. Import the `workflow.json` into your own n8n instance, plug in your own Gmail/Outlook, Anthropic, and Google Sheets credentials, point it at the folder and sheet you want, and turn it on. The exports are sanitized, so none of my credentials come with them.

## Contacts

- Email: mofeatanda@outlook.com or mofmofcool@gmail.com
- Reddit: SignTraditional1806

## License

MIT — use, learn from, fork freely. See [LICENSE](./LICENSE).
