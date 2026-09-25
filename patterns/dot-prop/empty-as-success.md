# empty-as-success

**id:** empty-as-success  
**kind:** semantic  
**name:** Empty path or empty object treated as a valid hit  
**description:** An early-return guard that should signal "nothing to look up" is changed so it returns a success value instead, making callers believe a lookup succeeded on an empty input.  
**target function:** hasProperty / deepKeysIterator  
**production impact:** `hasProperty(obj, '')` returns `true` instead of `false`, so conditional writes that check existence before overwriting proceed unconditionally, silently corrupting keys that were never meant to be set. In `deepKeys`, an empty object yields a key path instead of an empty array, causing downstream code to iterate over phantom keys.
