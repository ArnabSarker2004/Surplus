# Personal money and funding flags

The **What’s in your balance?** card shows one calculation:

**Account balance − non-personal funds = your personal money**

All remaining cash is personal by default, including opening balances, gifts, refunds, transfers and deposits without a known source. There is no unassigned cash bucket or separate manual allocation form. Personal money is floored at zero when funding exceeds the current balance. Unknown balances and non-CAD, credit and other-source accounts are excluded from available cash.

## Flag deposits

Choose **Manage funding** in the balance card. Search by bank description, merchant or date; filter by cash account or show only non-personal deposits. The list includes every imported month of posted CAD deposits, with pagination. Pending deposits are excluded until they post.

Each deposit has a money-type selector:

- Personal money
- Loan
- OSAP
- Grant / bursary
- Scholarship
- RESP
- Other education funding

Selecting a funding type adds that deposit to the deduction immediately. Changing its type moves the amount between funding totals without adding it twice. Selecting **Personal money** removes the deduction and overrides automatic detection. Each selection saves automatically; failures leave the previous value and balance intact. A successful save survives reload, export and bank sync. Flags apply only to that transaction, never every payment from the same merchant. The original bank description and amount are preserved.

Automatic detection recognizes explicit funding labels, including Children’s Education Fund as RESP, OSAP, NSLSC, grants and scholarships. The balance allocation also checks reviewed merchant/display names: a bank code such as `CET MSP/DIV` renamed to Children’s Education Fund counts as RESP even if its older transaction category is Other. The opaque bank code alone is not treated as an RESP provider. Funding categories are deducted even if an older classification or unreviewed source says Review, Transfer or Unknown. An explicit Personal money, salary, refund or transfer source still overrides detection. Bank-evidence details retain the original fields.

Unknown deposits and ordinary stipends stay personal unless identified as funding. Explicit internal transfers are not new funding. The same money remains reserved across connected CAD cash accounts when moved between them.

The deduction comes directly from current transaction flags and detected funding; old `cashAllocations` remain readable for export compatibility but no longer override the result. Removed or corrected transactions are reflected on the next calculation. No database migration is required: individual funding types are stored in the existing transaction payload and validated by the API.

## Savings and forecasts

The same personal-cash calculation feeds the 30-day savings estimate and Python forecast. Bills, credit balances, goals and the minimum cushion remain separate protections; personal money is not necessarily all available to save. Future grants and loans are excluded from personal savings projections. Expected OSAP that has not arrived does not reduce the current account balance.

The account-free demo uses the same flagging UI in memory and makes no private mutation requests. Its published forecast remains a labelled sample.

## Imported history

Funding totals use all available imported history, independently of the selected semester or transaction-page month. Future and pending deposits, other data sources and duplicate transaction IDs are excluded. Sync requests the original bank description and preserves user flags on reimport.

New bank connections request 730 days of initial history, the [Plaid Transactions maximum](https://plaid.com/docs/transactions/), subject to the bank’s availability. Existing connections retain their initial history window. [Plaid’s API reference](https://plaid.com/docs/api/products/transactions/) requires a new Item to expand that window; the app does not recreate the connection automatically. [Trial limits](https://plaid.com/docs/account/billing/) count created Items even after removal.
