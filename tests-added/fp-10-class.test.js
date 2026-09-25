// FP-10 class-level tests: when a key lives in both #cache and #oldCache,
// every count/enumeration path must see that key EXACTLY ONCE, not twice.
//
// Same setup as fp-08-class.test.js:
//   maxSize 2, freeze Date.now.
//   After rotation 'a' is in #oldCache (value=1, stale expiry).
//   Re-inserting 'a' puts it in #cache (value=99, live expiry).
//   'b' stays only in #oldCache.
//
// Total distinct live keys: 'a' (live in #cache) and 'b' (only in #oldCache) → size should be 2.
// 'a' must appear exactly once in every enumeration.

import test from 'ava';
import QuickLRU from './index.js';

const FIXED_NOW = 1_000_000;

function makeCache() {
	const realDateNow = Date.now;
	Date.now = () => FIXED_NOW;
	const lru = new QuickLRU({maxSize: 2});
	lru.set('a', 1, {maxAge: 100});
	lru.set('b', 2, {maxAge: 100});
	lru.set('a', 99, {maxAge: 9000});
	return {lru, restore: () => { Date.now = realDateNow; }};
}

test('fp-10: entriesAscending length equals 2 not 3 (size via iteration, not .size getter)', t => {
	const {lru, restore} = makeCache();
	try {
		// #entriesAscending walks #oldCache first (skipping keys already in #cache),
		// then walks #cache.  Original: 'a' skipped in oldCache pass → yields b, a → length 2.
		// Double-counting mutant (guard removed): 'a' yielded in oldCache pass AND in cache pass
		// → yields a, b, a → length 3.
		const entries = [...lru.entriesAscending()];
		t.is(entries.length, 2, `expected 2 entries, got ${entries.length}`);
	} finally {
		restore();
	}
});

test('fp-10: size is not clamped when oldCache is partial', t => {
	// Use maxSize:3 so a partial #oldCache is reachable without filling it again.
	const realDateNow = Date.now;
	Date.now = () => FIXED_NOW;
	try {
		const lru = new QuickLRU({maxSize: 3});

		// Fill to maxSize → rotation fires on 3rd set:
		//   #oldCache = {a(1), b(2), c(3)},  #cache = {},  #size = 0
		lru.set('a', 1, {maxAge: 9000});
		lru.set('b', 2, {maxAge: 9000});
		lru.set('c', 3, {maxAge: 9000});

		// Delete 'b' (only in #oldCache) → #oldCache = {a(1), c(3)}, #cache = {}, #size = 0
		lru.delete('b');

		// Re-set 'a' with new value → #cache.has('a') is false → #set runs:
		//   #cache = {a(99)},  #size = 1,  #oldCache = {a(1), c(3)}
		// 'a' now lives in BOTH caches; #oldCache has 2 keys, not 3 (not full).
		lru.set('a', 99, {maxAge: 9000});

		// State: #size=1, #oldCache={a,c} (2 keys), maxSize=3
		// size() guard loop: counts #oldCache keys not in #cache → only 'c' → oldCacheSize=1
		// Original:          min(1 + 1, 3) = min(2, 3) = 2   ← not clamped
		// Double-count bug:  counts 'a' too → oldCacheSize=2  → min(1 + 2, 3) = min(3, 3) = 3
		t.is(lru.size, 2, `expected size 2, got ${lru.size}`);
	} finally {
		Date.now = realDateNow;
	}
});

test('fp-10: keys yields key a exactly once', t => {
	const {lru, restore} = makeCache();
	try {
		const keys = [...lru.keys()];
		const count = keys.filter(k => k === 'a').length;
		t.is(count, 1, `key 'a' must appear exactly once, got ${count}`);
	} finally {
		restore();
	}
});

test('fp-10: values yields exactly two entries (a and b each once)', t => {
	const {lru, restore} = makeCache();
	try {
		const vals = [...lru.values()];
		t.is(vals.length, 2, `expected 2 values, got ${vals.length}`);
	} finally {
		restore();
	}
});

test('fp-10: Symbol.iterator yields key a exactly once', t => {
	const {lru, restore} = makeCache();
	try {
		const entries = [...lru];
		const count = entries.filter(([k]) => k === 'a').length;
		t.is(count, 1, `key 'a' must appear exactly once, got ${count}`);
	} finally {
		restore();
	}
});

test('fp-10: Symbol.iterator yields exactly two entries total', t => {
	const {lru, restore} = makeCache();
	try {
		const entries = [...lru];
		t.is(entries.length, 2, `expected 2 entries, got ${entries.length}`);
	} finally {
		restore();
	}
});

test('fp-10: entries yields key a exactly once', t => {
	const {lru, restore} = makeCache();
	try {
		const entries = [...lru.entries()];
		const count = entries.filter(([k]) => k === 'a').length;
		t.is(count, 1, `key 'a' must appear exactly once, got ${count}`);
	} finally {
		restore();
	}
});

test('fp-10: entries yields exactly two entries total', t => {
	const {lru, restore} = makeCache();
	try {
		const entries = [...lru.entries()];
		t.is(entries.length, 2, `expected 2 entries, got ${entries.length}`);
	} finally {
		restore();
	}
});

test('fp-10: entriesAscending yields key a exactly once', t => {
	const {lru, restore} = makeCache();
	try {
		const entries = [...lru.entriesAscending()];
		const count = entries.filter(([k]) => k === 'a').length;
		t.is(count, 1, `key 'a' must appear exactly once, got ${count}`);
	} finally {
		restore();
	}
});

test('fp-10: entriesDescending yields key a exactly once', t => {
	const {lru, restore} = makeCache();
	try {
		const entries = [...lru.entriesDescending()];
		const count = entries.filter(([k]) => k === 'a').length;
		t.is(count, 1, `key 'a' must appear exactly once, got ${count}`);
	} finally {
		restore();
	}
});

test('fp-10: entriesDescending yields exactly two entries total', t => {
	const {lru, restore} = makeCache();
	try {
		const entries = [...lru.entriesDescending()];
		t.is(entries.length, 2, `expected 2 entries, got ${entries.length}`);
	} finally {
		restore();
	}
});

test('fp-10: forEach visits key a exactly once', t => {
	const {lru, restore} = makeCache();
	try {
		let count = 0;
		lru.forEach((value, key) => { if (key === 'a') count++; });
		t.is(count, 1, `key 'a' must be visited exactly once, got ${count}`);
	} finally {
		restore();
	}
});

test('fp-10: forEach visits exactly two keys total', t => {
	const {lru, restore} = makeCache();
	try {
		let count = 0;
		lru.forEach(() => { count++; });
		t.is(count, 2, `expected 2 forEach calls, got ${count}`);
	} finally {
		restore();
	}
});
