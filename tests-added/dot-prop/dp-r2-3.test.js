import test from 'ava';
import {deepKeys} from './index.js';

test('two-names-one-key: array index above MAX_ARRAY_INDEX must not be coerced to a number in deepKeys output', t => {
	// Build a sparse array with one element at index 1_000_001 (> MAX_ARRAY_INDEX = 1_000_000).
	// shouldCoerceToNumber("1000001") returns false on the original, so the key stays a
	// string and deepKeys emits it as plain dot-notation "1000001".
	// The mutant uses !Number.isNaN(parseInt(key,10)) which is true, coercing it to the
	// number 1000001, causing deepKeys to emit bracket-notation "[1000001]" instead.
	const arr = [];
	arr[1_000_001] = 'x';
	const keys = deepKeys(arr);
	t.true(keys.includes('1000001'), 'key should be the string "1000001", not a bracket-notation numeric index');
	t.false(keys.includes('[1000001]'), 'key must not be emitted as bracket-notation "[1000001]"');
});
