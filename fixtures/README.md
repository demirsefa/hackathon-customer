# fixtures/

Static data, committed to the repository.

- `cases.json` — the 28 evaluation cases with their ground truth labels, plus
  the record layer they refer to (orders, senders).
- `llm-cache.json` — recorded model responses keyed by a hash of model, prompt
  and parameters, so `yarn eval` reproduces the published numbers without an
  API key.

All data here is synthetic. No real customer information.
