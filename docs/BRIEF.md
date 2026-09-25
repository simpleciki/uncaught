# uncaught — design brief

> Read this before every task. It is the single source of truth for scope. If a task seems to conflict with it, stop and ask.

## One line

**Your tests are green. Are they guarding anything?**
uncaught plants the bugs that real systems actually ship, runs your test suite, and shows which ones got through. Then it writes the tests that would have caught them.

## The workflow we improve

**Testing / code review.** Today a team changes code, CI is green, and they merge. Green only means "no test failed". It does not mean "a test would have failed if this code were wrong". Nobody checks that, because checking it by hand means breaking the code on purpose, one bug at a time, and re-running the suite each time.

- **Before:** a reviewer trusts the green badge. Blind spots are found in production.
- **After:** every blind spot is a named, reproducible bug with a test that now catches it.

## What makes it different

1. **Realistic bugs, not random edits.** Classic mutation tools flip operators (`<` to `<=`, `+` to `-`) and produce hundreds of mutants, many of them noise. uncaught plants bugs from a catalog of **failure patterns that show up in real incidents**. Examples: stale data served as fresh, an empty result treated as success, two clocks mixed, two names for the same key, a silent default replacing an error.
2. **It checks the checker.** After Bob writes the new tests, uncaught runs the same attack on Bob's own tests. The tests an AI writes get the same scrutiny as the tests a human writes.

## System under test

`subject/quick-lru/` is an unmodified copy of sindresorhus/quick-lru at commit `a2190eb` (MIT). It has 115 passing tests and runs in about 20 seconds with `npx ava`. It is widely used, and its test suite is good. That is the point: even a good suite has blind spots.

A manual probe already confirmed that the mechanism works: 3 bugs were planted by hand, 1 survived (the expiry boundary `<=` changed to `<`) and 2 were caught.

## Architecture (fixed)

```
patterns/            failure-pattern catalog (markdown, generic, no private data)
mutants/             one JSON file per planted bug: pattern id, file, find/replace edit, why it matters
runner/              Node script: for each mutant -> apply edit to a temp copy -> run tests -> record caught/survived -> discard copy
results/             runner output (JSON), one file per run: before.json, after.json, bob-tests.json
tests-added/         new tests written to kill surviving mutants
site/                static web page (plain HTML/CSS/JS, no framework, no build step) that reads results/*.json
bob_sessions/        IBM Bob task summary screenshots
```

## Hard rules

- **Never modify `subject/quick-lru/` in place.** The runner always works on a temporary copy, and the copy is deleted after each run.
- **No runtime API calls.** The site is static and reads JSON files. No keys, no secrets, no network calls from the site.
- **No new dependencies** unless the task explicitly allows them. Node 24 is available. The subject already uses `ava`.
- **Deterministic.** Running the runner twice gives the same result.
- **Every number on the site comes from a file in `results/`.** No hand-typed numbers.
- **All text, code comments, and commit messages are in English.**
- **Commits follow Conventional Commits** (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).

## Demo must show (in this order)

1. The green badge: 115 tests passing.
2. N realistic bugs planted: **caught X / N**. The number turns red.
3. Each survivor: the pattern it comes from, the one-line code change, and why it would hurt in production.
4. The new tests Bob wrote: **caught Y / N** after.
5. The same attack run on Bob's own tests: what survived.
