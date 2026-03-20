# Revenue Transparency

This repository is public, and the economics around it should be public enough to inspect.

## Principle

Revenue should not be handled like a black box.

The project will publish:
- what revenue categories exist
- how net platform revenue is calculated
- how collaborator distributions are calculated
- where monthly reports are stored

## Revenue formula

### Step 1: Gross Platform Revenue

`Gross Platform Revenue` is all platform revenue collected in the reporting month.

Examples:
- sponsorship income
- platform fees
- marketplace facilitation revenue
- partnership revenue
- approved support or premium collaboration revenue

### Step 2: Net Platform Revenue

`Net Platform Revenue` is:

`Gross Platform Revenue`
`- refunds and chargebacks`
`- taxes and statutory remittances`
`- payment processor fees`
`- pass-through seller payouts`
`- direct infrastructure/tooling costs tied to delivery of the revenue period`

### Step 3: Distribution buckets

Current public policy:

- `50%` Product Treasury
- `25%` Core Operations & Maintenance
- `25%` Open Collaborator Pool

If the percentages change in the future, the change must be committed publicly here before it is used in a monthly report.

## Collaborator pool formula

`Collaborator Share(i) = Open Collaborator Pool * (Contributor Points(i) / Total Eligible Contributor Points)`

## Contributor points

Default contribution weights per reporting month:

- merged docs/community PR: `2 points`
- merged bugfix or feature PR: `5 points`
- merged performance, data-integrity, or reliability PR: `6 points`
- merged security-sensitive fix: `8 points`
- substantive review on a merged PR: `1 point`
- approved incident response or recovery work: `3 points`

Notes:
- issues and comments alone are not paid contribution units
- spammy or low-signal PRs do not earn points
- maintainers may reject gaming behavior and document the reason publicly

## Eligibility rules

To receive collaborator distribution in a month, a contributor must:
- have at least `5` eligible points in the reporting window
- have accepted work or recognized review effort in that same window
- remain in good standing under [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

## Public reporting channel

Monthly reports should be committed to:

- [`reports/revenue`](./reports/revenue)

Each report should include:
- gross revenue
- deductions
- net platform revenue
- treasury / operations / collaborator allocations
- collaborator point table
- collaborator distribution table
- maintainer sign-off

## Transparency standard

If revenue is collected but a monthly report is missing, that is a governance failure and should be corrected publicly.
