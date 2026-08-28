# CONTRACT: EXTERNAL-SOURCES-ARE-RECORDED

**Status:** active · **Enforced by:** `dev/contracts/checks/sources.test.ts`

## Scope

The whole repository. Anything that came into it from outside — a protocol, a template,
a guide, the challenge brief, a snippet of code, a decision made because an external
document said so. If it was not invented here, this contract governs how it is written
down.

## The agreement

1. The **root `README.md`** names every external source this repository draws on. It is
   the first thing an outsider reads, so nothing may be borrowed here and mentioned only
   somewhere deeper in the tree.
2. The detail is recorded next to the material itself, in a `## Sources` table — in the
   README of the folder it shaped, or in the file itself when the whole file is the copy.
3. A row names **what** was taken, links the **upstream**, and **pins** it: a commit sha,
   or a retrieval date when the source has no commits.
4. The reverse also holds: a file that announces it was copied, adapted, vendored or
   quoted from somewhere must be declared. A copy may not sit in the tree unrecorded.
5. Upstream stays the source of truth. A vendored copy is never edited in place; it is
   re-copied, and the pin moves in the same commit as the content.
6. Nothing is recorded from memory. A source that cannot be linked is not written down as
   a source — write down what is actually known instead.

## Why

A link arrives in a chat window, the work gets done from it, and the link is never
written down. Six weeks later the structure is still there and nobody can say where it
came from, whether upstream has moved, or which version this repo matched. The material
survives; the provenance evaporates with the session.

This project is a hackathon submission, which makes the failure sharper: the brief, the
constraints and the grading criteria all arrive from outside. Anything remembered rather
than recorded is gone the moment the conversation closes, and what remains is a
repository whose rules nobody can trace.

## Traps

- Pasting a URL into a chat, acting on it, and never writing it into the repository.
- Recording the link but not the version, so upstream drift becomes undetectable.
- Vendoring a file with no line about it in the folder's README.
- Paraphrasing an external requirement from memory instead of quoting the source.
- Editing a vendored copy in place, so it forks from upstream silently.
- Treating "everyone on the team knows where this came from" as a record.

## Enforcement

- **Test:** `dev/contracts/checks/sources.test.ts` — asserts every `## Sources` table in
  the repository is well formed (what, upstream link, pin), that every path a row names
  exists, that every file announcing a copy is declared in one of those tables, and that
  every upstream declared anywhere is also named in the root `README.md` under its
  prior-work section.
- Red here means something arrived from outside and left no trace, or a trace it left no
  longer points anywhere.
- Rule 5 (never edit a vendored copy in place) and rule 6 (never record from memory) are
  **judgment**: a diff can look identical whether or not it came from upstream. The audit
  prompt below covers them.

## Audit prompt (paste into a fresh agent session)

> Here is the **EXTERNAL-SOURCES-ARE-RECORDED** contract:
> `dev/contracts/EXTERNAL-SOURCES-ARE-RECORDED.md`. Read the root `README.md`, every
> other `README.md` in the repository, `dev/GUIDES.md`, and `dev/contracts/`.
> For each numbered rule, decide whether it is currently honoured. Look especially for
> material that reads as though it came from elsewhere — a protocol, a template, a
> requirement, a borrowed structure — with no `## Sources` row behind it, and for pins
> that no longer match upstream.
> Report every suspected violation with `file:line` and the rule number. When unsure,
> report it rather than staying silent — a false alarm is cheaper than a silent breach.
