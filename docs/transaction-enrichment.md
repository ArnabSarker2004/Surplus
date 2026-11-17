# Company identification and detailed categories

Surplus uses the merchant enrichment already returned by Plaid Transactions. It does not send bank descriptions to a search engine, an LLM, a geocoder, or another enrichment vendor. It does not activate Plaid Enrich, which is a separately billed product.

## From bank entry to model input

1. Keep the original description, merchant label, amount, currency, and original Plaid categories intact.
2. Prefer a unique `merchant` counterparty, or one matching the top-level merchant entity ID. Keep payment apps, terminals, financial institutions and marketplaces separate from the seller. Multiple unmatched merchants remain unresolved.
3. Retain company-match confidence independently of category confidence. A top-level merchant name without counterparty confidence is labelled unverified. A plain bank descriptor is a fallback label, not a verified identity.
4. Use high-confidence entity IDs to join alternate bank spellings for recurring-payment and merchant-frequency analysis. Without an entity, use an exact descriptor key. Unresolved processor payments get separate transaction keys so unrelated sellers do not become one recurring merchant.
5. Accept a specific category only when its parent matches the app category and Plaid supplies high/very-high category confidence, or the user explicitly confirms it. Original low-confidence codes remain visible as evidence. Salary/wages/contractor/gig income are distinct from dividends and other irregular deposits; telephone/internet are distinct from housing.
6. Send only the selected merchant label/key, match provenance, confirmed detail code/label, and existing allowlisted financial fields to the private Python service. Merchant websites, counterparties, original bank descriptions, bank tokens and exact coordinates are excluded. The service groups recurring payments and merchant trends by the selected key, and reports 90-day detailed spending net of refunds.

## Reviewing a transaction

Open **Transactions → pencil icon**. The details dialog shows evidence, processor/marketplace context, coarse location when supplied, separate confidence labels, a company-name correction, and a category-dependent detail dropdown. Its forecast preview explains how the selected values will be used.

Corrections preserve the raw bank entry and survive sync, including pending-to-posted replacement. A merchant rule can update other uncorrected transactions and future imports in the same workspace source. Explicit individual corrections take precedence. Ambiguous processor entries allow individual corrections only. The company-match filter finds entries needing review; search also includes corrected names and detailed categories.

The browser never automatically loads third-party merchant images or sites. An optional HTTPS website link opens only when the user chooses it. A matching trading name does not establish legal ownership, exact receipt contents, or which items at a mixed retailer were groceries. The app leaves that uncertainty visible.

## Storage and refresh

The [automatic local cleanup and optional Groq pipeline](groq-merchant-enrichment.md) now applies usable merchant names and weak-category estimates with separate provenance, backed by a per-user cache through migration `004_merchant_enrichment.sql`. Select a name or category in the transaction list to make a quick correction; detailed evidence and splits remain under Details. The following describes the original Plaid metadata fields; their storage is unchanged.

Transaction and merchant-rule metadata live inside the existing user-scoped JSON payloads in PostgreSQL (or the local SQLite workspace). Existing RLS and authenticated transaction routes apply. No new credential or database migration is needed for these fields. Metadata version 2 performs one full sync replay on an existing connection before advancing the saved cursor/version, preserving corrections and avoiding partial updates on failure.

`shared/merchants.ts` owns identity resolution, category hierarchy, safe links, and correction validation. `shared/data/plaid-categories.json` contains 130 published PFC v1/v2 identifiers with labels derived from their codes, captured September 19, 2026. Unknown future codes remain reviewable rather than being forced into a made-up detail. Update the taxonomy from the official CSV when adopting new versions; test both hierarchy validation and model-input filtering.

Sources: [Plaid Transactions fields](https://plaid.com/docs/api/products/transactions/), [Plaid PFC taxonomy](https://plaid.com/documents/pfc-taxonomy-all.csv), [Plaid Enrich access and billing](https://plaid.com/docs/enrich/).
