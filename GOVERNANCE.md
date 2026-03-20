# Governance

This repository is public, but it is not unmanaged.

## Roles

### Maintainers

Maintainers can:
- merge PRs
- manage releases
- change policy docs
- make final decisions on roadmap, brand, and treasury questions

### Reviewers

Reviewers are trusted contributors who regularly review PRs and help maintain quality, but do not necessarily control releases.

### Collaborators

Collaborators are recurring contributors eligible for public recognition and, when applicable, revenue-share consideration under [REVENUE.md](./REVENUE.md).

### Contributors

Anyone can open issues and pull requests.

## Branch and merge policy

- `main` should stay releasable
- direct pushes should be limited to maintainers
- all other work should come through PRs

## Review rules

### Standard changes

Examples:
- docs
- copy
- non-sensitive components
- tests
- visual polish

Requirement:
- 1 maintainer approval
- green CI where applicable

### Sensitive changes

Examples:
- auth
- ranking or scoring methodology
- marketplace settlement, purchase, withdrawal, or revenue logic
- admin surfaces
- Supabase migrations and RLS
- cron or operational automation
- security headers or secrets handling

Requirement:
- maintainer approval
- explicit verification note in the PR
- screenshots or API proof where relevant
- maintainers may require extra review before merge

## Who can open PRs

Anyone.

But opening a PR does not guarantee merge. Quality, clarity, verification, and project fit matter.

## Decision style

We prefer:
- clear technical reasoning
- public discussion when practical
- written policies over backchannel ambiguity
- reversible decisions when possible

For disputed decisions, maintainers decide.

## Public accountability

Maintainers are expected to keep the following transparent:
- contribution rules
- review standards
- license and brand terms
- revenue handling and collaborator distribution policy

That transparency lives in:
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [COLLABORATORS.md](./COLLABORATORS.md)
- [REVENUE.md](./REVENUE.md)
