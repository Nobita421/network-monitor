# Network Monitor Merge Protocol (OpenCode IDE)

## Scope
This repository uses OpenCode for deep comparative merges between:

- PRIMARY TARGET (only writable):
  `D:\movies\network monitor\`

- SECONDARY SOURCE (strictly read-only):
  `D:\movies\network monitor.worktrees\worktree-2025-12-12T17-09-28\`

All final code changes must go only into PRIMARY TARGET.
Never edit, create, move, or delete anything inside SECONDARY SOURCE.

## Mission
Produce the strongest possible merged version of both codebases with zero meaningful information loss.

This means:
- Discover every meaningful feature, fix, config, script, dependency, and behavior difference.
- Merge or preserve every superior implementation.
- Keep PRIMARY internally consistent and non-regressive.
- Leave SECONDARY unchanged.
- Validate the result with lint, typecheck, tests, build, and runtime checks where available.

## OpenCode Workflow
Use this repo with a strict mode flow:

1. FORENSIC
- Read, map, compare, prove.
- No implementation.

2. PLANNING
- Build the classification matrix and merge blueprint.
- No implementation.

3. ADVERSARIAL
- Attack assumptions, blast-radius estimates, merge order, and safety.
- No implementation.

4. EXECUTOR
- Implement only what is already planned and justified.

5. VERIFIER
- Run checks, inspect failures, verify runtime wiring, and certify completion.

Never casually blend modes.
Never implement while in FORENSIC, PLANNING, or ADVERSARIAL mode.
Never claim completion outside VERIFIER mode.

## Exception Patches
- EXECUTOR exception rule:
  If implementation reveals hidden coupling, a new dependency, conflicting evidence, or a merge-order issue, temporarily return to PLANNING for that item only, update the blueprint, then resume EXECUTOR mode.

- VERIFIER exception rule:
  VERIFIER may apply minimal corrective changes only for failures directly caused by the immediately preceding checkpoint; otherwise return to EXECUTOR mode.

- Evidence sufficiency rule:
  Once classification confidence is HIGH and no contradictory evidence remains, stop digging and move forward.

## Adaptive Read Policy
Read fully to EOF:
- All source files
- All configs
- All scripts/workflows
- All tests
- Env templates/examples
- Build/test/lint setup
- CI/CD and automation files

Skim structurally only:
- Lockfiles
- Generated files
- Binaries/media
- node_modules

Never:
- Skip source because it “looks similar”
- Infer equivalence from filename, size, or shallow diff
- Stop reading a large source file before EOF

## Evidence Standard
Every classification must include:
- file path
- symbol/function/class name
- observed behavior

Valid:
- `src/foo.ts -> buildMonitor() -> reconnects websocket on failure`

Invalid:
- `foo.ts seems better`

## Required Classification States
Every meaningful feature/module/config/script/test/integration must be classified as one of:

- KEEP_PRIMARY
- PORT_FROM_SECONDARY
- UPGRADE_PRIMARY
- MERGE_BOTH
- SYNTHESIZE_NEW
- EXTRACT_PATTERN
- DEFER_WITH_REASON
- REVIEW_REQUIRED

LOW-confidence items must never silently become KEEP_PRIMARY.

## Scoring
For each important item track:

- Blast radius (1-10)
  - 1-2 isolated
  - 3-5 moderate
  - 6-8 high
  - 9-10 critical shared foundation

- Quality score (1-10)
  - correctness
  - completeness
  - error handling
  - type safety
  - clarity
  - runtime fitness
  - test support

- Confidence
  - HIGH
  - MEDIUM
  - LOW

## Mandatory Merge Order
1. Security fixes
2. Dependency and config foundations
3. Shared types/contracts/interfaces
4. Core utilities after dedup review
5. Services/data/runtime layers
6. Feature modules
7. UI/routes/integration wiring
8. Tests / missing coverage
9. Cleanup

If a change affects 3+ domains or blast 9-10 modules, re-enter ADVERSARIAL mode before editing.

## Validation Order
After each checkpoint batch (<=10 changed files), run where available:

1. Dependency install/update if needed
2. Lint
3. Typecheck
4. Targeted tests
5. Full suite after blast 6-10 changes
6. Build after integration-surface changes

Never suppress checks.
Never continue on a failing validation state.
Never stack new work on top of a broken checkpoint.

## Network Monitor Critical Paths
Always verify these after merge:
- App startup
- Monitor initialization
- Interface detection
- Live capture -> process -> display pipeline
- Socket/live-update reconnect behavior
- Alert threshold handling
- Safe env/config loading
- Auth/security guards
- Historical/persisted data flow if present
- Long-running stability and memory behavior

## OpenCode Agent Routing
Preferred routing:
- Deep repo comparison / matrix design -> `@merge-plan`
- Actual implementation / batch edits -> `@merge-build`
- Adversarial review / challenge / safety review -> `@merge-critic`
- Quick read-only code discovery -> built-in `@explore`
- Multi-step helper work when needed -> built-in `@general`

## Output Requirements
Final result must include:
1. Executive result
2. Critic findings
3. Pre-mortem guards
4. Master matrix
5. Dedup report
6. Security delta
7. Files changed
8. Dependency/config changes
9. Validation summary
10. Performance/runtime notes
11. Review/defer items
12. Final certification

## Final Certification Checks
Do not conclude unless all are true:
- All relevant files were read according to policy
- All meaningful differences were classified with evidence
- All superior implementations were handled
- PRIMARY-only critical behavior was not lost
- SECONDARY remained unchanged
- Validation completed
- Reconciliation completed

## Circuit Breakers
Halt/escalate if:
- A write targets SECONDARY
- A source file is about to be skipped
- A classification lacks evidence
- Validation is failing and new work is being added
- A large architectural change is attempted without adversarial review
- A LOW-confidence item is being silently resolved
- Completion is claimed without final reconciliation