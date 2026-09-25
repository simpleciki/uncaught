# guard-weakened

**id:** guard-weakened  
**kind:** classic-operator  
**name:** Safety check silently narrowed  
**description:** A guard that blocks dangerous or disallowed input is weakened by an off-by-one or inverted operator, allowing some inputs that should be rejected to slip through unchecked.  
**target function:** parsePath  
**production impact:** Paths containing disallowed keys (e.g. `constructor`, `__proto__`) that are exactly at the length boundary bypass the prototype-pollution guard. An attacker can craft a path that writes to `Object.prototype` or the function constructor, corrupting all objects in the process.
