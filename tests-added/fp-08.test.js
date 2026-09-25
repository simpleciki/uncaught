import test from 'ava';
import QuickLRU from './index.js';

test('expiresin-wrong-cache-wins: expiresIn returns the live cache expiry not the stale oldCache expiry', t => {
	const fixedNow = 1_000_000;
	const realDateNow = Date.now;
	Date.now = () => fixedNow;

	try {
		// maxSize 2: after two sets the third triggers rotation (#cache → #oldCache).
		const lru = new QuickLRU({maxSize: 2});

		// Fill to capacity so the next set triggers rotation.
		// After these two sets #size === 2 === maxSize, so the SECOND set already
		// triggered the rotation: #oldCache = old #cache, #cache = new Map().
		// At this point 'a' and 'b' are in #oldCache, #cache is empty.
		lru.set('a', 1, {maxAge: 100}); // expiry = fixedNow + 100
		lru.set('b', 2, {maxAge: 100});

		// Now re-set 'a' with a longer maxAge.  Because #cache is empty,
		// #cache.has('a') is false so #set() is called → 'a' lands in #cache
		// with the new expiry.  #oldCache still holds 'a' with the OLD expiry.
		// Both caches now contain 'a' simultaneously.
		lru.set('a', 99, {maxAge: 9000}); // new expiry = fixedNow + 9000

		const remaining = lru.expiresIn('a');

		// Original: #cache wins → remaining ≈ 9000 (well above 200).
		// Mutant  : #oldCache wins → remaining ≈ 100 (well below 200, possibly ≤ 0).
		t.true(remaining > 5000, `expected remaining > 5000, got ${remaining}`);
	} finally {
		Date.now = realDateNow;
	}
});
