# AI Automations

Production-ready automation workflows for businesses, built with **n8n** and the **Anthropic Claude API**. Focused on AI-powered document extraction, back-office process automation, and integrations with the tools businesses actually use.

Each workflow in this repo is a real project — built, tested, and documented end-to-end.

## What's here

| Workflow | What it does | Stack |
|----------|--------------|-------|
| [**Invoice Extraction**](./invoice-extraction) | Email-in, structured-data-out. PDF invoices arrive in Outlook, Claude extracts the line items, and rows land in a Google Sheet. Handles statements, tax notices, credit memos, and law-firm bills with separate routing. | n8n, Claude, Outlook, Google Sheets |

More workflows coming.

## About

I build AI-powered automations for businesses that want to stop doing repetitive manual work — invoice processing, document extraction, data entry, ticket triage, anything where a person is currently retyping information that a machine could understand.

The goal isn't "use AI for the sake of AI." It's solving the right slice of a workflow with the right tool, and being honest about what it can and can't do.

**Want something built?**

- Email: [mofeatanda@outlook.com] or [mofmofcool@gmail.com]
- Reddit: [SignTraditional1806]

## Approach

A few things that show up in every project here:

**Specific over generic.** A workflow that handles a client's actual quirks beats a generic "AI parser." Custom rules, encoded once, save hours forever.

**Documented like a teammate.** Every workflow has a README explaining the problem, the design choices, and the limitations. Not just "here's the code."

**Honest about tradeoffs.** Each project lists what it doesn't do. Knowing where the edges are matters more than pretending there aren't any.

**Built to be handed off.** Workflows are exported and sanitized so anyone with an n8n instance can import them, fill in their own credentials, and run.

## Stack I work with

- **n8n** — self-hostable workflow automation
- **Anthropic Claude API** — best-in-class structured extraction and reasoning
- **Google Workspace** — Sheets, Drive, Gmail integrations
- **Microsoft 365** — Outlook, Excel, Teams integrations
- **Airtable, Notion, Slack** — where work actually lives

## License

MIT — use, learn from, fork freely. See [LICENSE](./LICENSE).