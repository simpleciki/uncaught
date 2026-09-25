# boundary

**id:** boundary  
**kind:** classic-operator  
**name:** Off-by-one on path traversal index  
**description:** A length comparison that guards whether the traversal has reached the final segment is off by one, causing the function to treat the second-to-last segment as the terminal one and return the wrong value.  
**target function:** getProperty  
**production impact:** For any path with two or more segments, `getProperty` returns the default value one level too early, so deeply nested reads always miss and callers receive the default even when the full path exists. Every read on a path like `'a.b.c'` silently returns `undefined` instead of the real value.
