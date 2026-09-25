> Sent upstream as an issue (pull requests there are limited to collaborators): see the README section "Back to the maintainers". This file is the draft written during the hackathon.

# Test: array keys above MAX_ARRAY_INDEX must stay string keys in deepKeys()

dot-prop has no bug here. This pull request adds one test for a case the existing suite does not exercise. The gap was found by mutation testing.

`shouldCoerceToNumber` only coerces a segment to a number when it is a valid index no larger than `MAX_ARRAY_INDEX` (1,000,000). The test places a value at array index 1,000,001 and checks that `deepKeys` returns `'1000001'` and not `'[1000001]'`.

Why it matters: if the upper-bound check is replaced by a looser test such as `!Number.isNaN(Number.parseInt(key, 10))`, all 77 existing tests still pass, but oversized indices are emitted as bracket indices. The same looser check would also turn a non-index key like `'1abc'` on an array into index `1`, so two different keys would produce the same path. This test covers the first case; the second is not covered yet.

The test is a standalone AVA file. I am happy to fold it into `test.js` in the project's style if you prefer.
