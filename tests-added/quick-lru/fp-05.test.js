import test from 'ava';
import QuickLRU from './index.js';

test('expiry-boundary-off-by-one: item at exact expiry millisecond must not be served', t => {
	const fixedNow = 1_000_000;
	const realDateNow = Date.now;
	Date.now = () => fixedNow;

	try {
		const lru = new QuickLRU({maxSize: 10, maxAge: 500});
		// Item is stored with expiry = fixedNow + 500 = 1_000_500.
		lru.set('k', 'v');

		// Advance time to exactly the expiry instant.
		Date.now = () => fixedNow + 500;

		// Original: expiry <= Date.now() → deleted → get returns undefined.
		// Mutant  : expiry <  Date.now() → NOT deleted → get returns 'v'.
		t.is(lru.get('k'), undefined);
	} finally {
		Date.now = realDateNow;
	}
});
