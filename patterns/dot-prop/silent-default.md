# silent-default

**id:** silent-default  
**kind:** semantic  
**name:** Missing value returns default instead of signalling absence  
**description:** When a path is empty or not found, the function returns the caller-supplied default (or the object itself) instead of a value that unambiguously signals absence, hiding the fact that nothing was looked up.  
**target function:** getProperty  
**production impact:** Callers that pass a default to detect whether a key is present silently receive the wrong value. Optional-chaining patterns built on `getProperty` cannot distinguish "key absent" from "key present with default value", leading to incorrect branching and data corruption downstream.
