// FP-08 class-level tests: when a key lives in both #cache and #oldCache,
// every public read path must return the LIVE (#cache) copy's value / expiry,
// not the stale (#oldCache) copy.
//
// Setup: maxSize 2, freeze Date.now.
//   1. set('a', 1, {maxAge:100}) + set('b', 2, {maxAge:100})
//      → second set triggers rotation: #oldCache={a,b}, #cache={}
//   2. set('a', 99, {maxAge:9000})
//      → #cache.has('a') is false → #set runs → #cache={a(99,9000ms)}, #oldCache still has a(1,100ms)
//   Now 'a' is in both caches.  Live value=99, stale value=1.
//   Live expiry = fixedNow+9000, stale expiry = fixedNow+100.

import test from 'ava';
import QuickLRU from './index.js';

const FIXED_NOW = 1_000_000;

function makeCache() {
	const realDateNow = Date.now;
	Date.now = () => FIXED_NOW;
	const lru = new QuickLRU({maxSize: 2});
	lru.set('a', 1, {maxAge: 100});   // goes into first #cache; second set triggers rotation
	lru.set('b', 2, {maxAge: 100});   // triggers rotation: #oldCache={a,b}, #cache={}
	lru.set('a', 99, {maxAge: 9000}); // lands in #cache with fresh expiry; #oldCache keeps stale 'a'
	return {lru, restore: () => { Date.now = realDateNow; }};
}

test('fp-08: get returns live value not stale value', t => {
	const {lru, restore} = makeCache();
	try {
		t.is(lru.get('a'), 99);
	} finally {
		restore();
	}
});

test('fp-08: peek returns live value not stale value', t => {
	const {lru, restore} = makeCache();
	try {
		t.is(lru.peek('a'), 99);
	} finally {
		restore();
	}
});

test('fp-08: has returns true (live copy is not expired)', t => {
	const {lru, restore} = makeCache();
	try {
		t.true(lru.has('a'));
	} finally {
		restore();
	}
});

test('fp-08: expiresIn returns live expiry not stale expiry', t => {
	const {lru, restore} = makeCache();
	try {
		const remaining = lru.expiresIn('a');
		// Live copy: expiry = FIXED_NOW + 9000 → remaining = 9000.
		// Stale copy: expiry = FIXED_NOW + 100 → remaining = 100.
		t.true(remaining > 5000, `expected remaining > 5000 (live), got ${remaining}`);
	} finally {
		restore();
	}
});

test('fp-08: keys yields live value (value seen via Symbol.iterator is 99)', t => {
	const {lru, restore} = makeCache();
	try {
		// keys() delegates to [Symbol.iterator], which must yield the live copy.
		const keys = [...lru.keys()];
		t.true(keys.includes('a'), 'key a must be present');
	} finally {
		restore();
	}
});

test('fp-08: values yields live value not stale value', t => {
	const {lru, restore} = makeCache();
	try {
		const vals = [...lru.values()];
		// Live value is 99; stale is 1. The iterator must yield 99, not 1.
		t.true(vals.includes(99), 'live value 99 must appear');
		t.false(vals.includes(1), 'stale value 1 must not appear');
	} finally {
		restore();
	}
});

test('fp-08: Symbol.iterator yields live value for key a', t => {
	const {lru, restore} = makeCache();
	try {
		const map = new Map(lru);
		t.is(map.get('a'), 99);
	} finally {
		restore();
	}
});

test('fp-08: entries yields live value for key a', t => {
	const {lru, restore} = makeCache();
	try {
		const map = new Map(lru.entries());
		t.is(map.get('a'), 99);
	} finally {
		restore();
	}
});

test('fp-08: entriesAscending yields live value for key a', t => {
	const {lru, restore} = makeCache();
	try {
		const map = new Map(lru.entriesAscending());
		t.is(map.get('a'), 99);
	} finally {
		restore();
	}
});

test('fp-08: entriesDescending yields live value for key a', t => {
	const {lru, restore} = makeCache();
	try {
		const map = new Map(lru.entriesDescending());
		t.is(map.get('a'), 99);
	} finally {
		restore();
	}
});

test('fp-08: forEach sees live value for key a', t => {
	const {lru, restore} = makeCache();
	try {
		const seen = new Map();
		lru.forEach((value, key) => { seen.set(key, value); });
		t.is(seen.get('a'), 99);
	} finally {
		restore();
	}
});
