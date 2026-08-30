# fixtures/

Static data, committed to the repository.

- `cases.json` — the 28 evaluation cases with their ground truth labels, plus
  the record layer they refer to (orders, senders).
- `llm-cache.json` — recorded model responses keyed by a hash of model, prompt
  and parameters, so `yarn eval` reproduces the published numbers without an
  API key.

  It also holds `TASK: verify` responses that no code path can ask for any more:
  they were recorded for the "second opinion" call that was measured and then
  removed (commit `2ea26ae`). They stay because they are the evidence behind that
  removal — the README changelog and `dev/CHALLENGE.md` §9 both claim it was
  measured, and these are the measurement. Nothing reads them; deleting them would
  only shrink the recorded-response count the trajectories report.

All data here is synthetic. No real customer information.
