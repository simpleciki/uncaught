# two-names-one-key

**id:** two-names-one-key  
**kind:** semantic  
**name:** Two path spellings for the same key resolve differently  
**description:** Bracket-index notation (`a[0]`) and dot-numeric notation (`a.0`) are supposed to address the same element, but a broken coercion step makes one spelling resolve as a number key and the other as a string key, so they silently hit different slots.  
**target function:** shouldCoerceToNumber  
**production impact:** Users who write `'items.0'` instead of `'items[0]'` get `undefined` from `getProperty` even though the array element exists, and `setProperty` writes to a string key `'0'` instead of array index `0`, creating phantom string properties alongside the real numeric array elements.
