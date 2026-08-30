# src/llm/

The I/O half of the model boundary. `src/core/llm.ts` declares the port — the
`LlmClient` interface and the primitives a response is parsed with — and this folder
holds the three implementations of it.

## Why this is a fifth area

`dev/CHALLENGE.md` §12 and `src/core/README.md` promise that `src/core/` is pure: no
network, no filesystem, no clock. A client that opens an HTTPS connection and reads a
committed JSON file cannot live there without breaking that promise, and the promise
is doing real work — it is what makes both pipelines testable with a scripted fake and
what makes "this decision cost zero model calls" checkable. It cannot go inside
`src/eval/` or `src/sim/` either, because both need the same client and whichever one
owned it would become a dependency of the other. So the
port stays pure in `core/`, and the body that performs the I/O sits beside it here.

## The files

```text
key.ts        the pinned model configuration, and the cache key computed from it.
replay.ts     reads fixtures/llm-cache.json. The default for every run.
anthropic.ts  the live client. Takes the API key as an argument.
record.ts     wraps a client, keeps what it answered, writes the cache back out.
session.ts    mode in, client out. The one decision `eval/` and `sim/` share.
```

## The pinned configuration

| Setting      | Value                                           |
| ------------ | ----------------------------------------------- |
| Model        | `claude-sonnet-5`                               |
| `max_tokens` | `16000`                                         |
| Effort       | `medium`                                        |
| Thinking     | adaptive (this model's default; not overridden) |

`ANTHROPIC_MODEL` overrides the model and nothing else. It is safe to offer because a
replay miss throws: another model hashes to another cache key, so the setting can
refuse to produce a number but never quietly move one. Left unset — as it is on a
clean clone — the pinned value is what the committed cache was recorded with.

There is no `temperature`. Claude 5 removed the sampling parameters — sending
`temperature: 0` returns a 400 — and it would not have bought what it looks like it
buys: even at zero the API never promised the same bytes twice. Reproducibility here
comes from the recorded cache instead, which is a stronger guarantee than a sampling
setting: the replayed run does not call the model at all.

Server-side refusal fallbacks are deliberately **not** enabled. A fallback would let a
different model answer a request that this project reports as `claude-sonnet-5`, which is
the one thing a pinned model id exists to rule out. A refusal is raised instead.

## The cache key

```text
sha256( canonicalJson({ effort, maxTokens, model, prompt }) )
```

`canonicalJson` sorts every object's keys before serialising, so the order the params
were built in cannot move the key. Change the prompt and the key changes; change the
model or a parameter and the key changes; reorder the fields and it does not.

Each entry in `fixtures/llm-cache.json` stores those four fields beside the answer, so
an entry states its own request and a reader can recompute its key by hand.

## Composing them

Replay — the default, and what runs with no credentials present:

```ts
const llm = replayClient({ cache: readCache() });
```

Live, recording as it goes. The key is read from the environment at the entry point
and passed down; nothing under `src/llm/` reads it:

```ts
const cache = readCacheIfPresent();
const llm = recordingClient({ inner: anthropicClient({ apiKey }), cache });
// … run the harness …
writeCache(cache);
```

`recordingClient` serves a request it already holds without calling the live client, so
a re-record only spends money on what is genuinely missing.

## A miss throws

If replay is asked for a request that was never recorded, it raises an error naming the
missing key and how to record it. It does not fall through to a live call and it does
not return an empty answer. Either would let a run finish green while producing a
different number, and the person reading the output would have no way to see it
happened — which is exactly the failure the Reproducibility criterion is about.

## Which client a run uses

Entry points do not pick a client by hand. `session.ts` turns the mode into one, so
`src/eval/` and `src/sim/` cannot drift apart on the decision:

```ts
const session = openLlmSession({ live, apiKey });
// … run …
session.save(); // writes what was recorded; a no-op in replay
```

Live implies recording — there is no separate `--record` flag. The answer is already
paid for by the time it arrives, so writing it down is free, and a recording step you
have to remember is one that gets forgotten a commit before the cache is needed.
