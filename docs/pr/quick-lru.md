# Add tests for a key held in both `#cache` and `#oldCache`

quick-lru has no bug here. This PR closes a coverage gap found by mutation testing: the scenario where a key is written after a cache rotation, leaving it in both `#cache` (live copy) and `#oldCache` (stale copy), is not exercised by the existing suite.

`fp-08-class.test.js` (11 tests) covers correctness of every public read path under that state. Setup: `maxSize: 2`, `Date.now` frozen, fill both slots to trigger rotation, then re-insert key `a` with a longer `maxAge`. Key `a` gets a live copy in `#cache` (value `99`, 9 000 ms) alongside the stale copy in `#oldCache` (value `1`, 100 ms). Each test asserts that `get`, `peek`, `has`, `expiresIn`, `values`, `entries`, `entriesAscending`, `entriesDescending`, `forEach`, and `Symbol.iterator` return the live value.

`fp-10-class.test.js` (13 tests) covers uniqueness and counting under the same state. The dual-cache key must appear exactly once in every enumeration. One additional case verifies that `size` is not double-counted when `#oldCache` is partial: with `maxSize: 3`, deleting one `#oldCache` key and re-inserting another, the reported size must be `2`, not `3`.

Together these 24 tests pin the guard logic that skips `#oldCache` keys already present in `#cache`.

The tests are written as standalone AVA files. I am happy to fold them into `test.js` in the project's style if you prefer.
