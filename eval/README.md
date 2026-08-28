# eval/

Runs the 28 evaluation cases against `core/` directly and prints the results
table. No HTTP, no queue timing, no scenario playback — one message in, one
decision out, scored against ground truth.

```bash
yarn eval              # replays fixtures/llm-cache.json, no API key needed
yarn eval --live       # real API calls, requires a key
```

The default run must be deterministic and reproducible on a clean machine
without credentials.
