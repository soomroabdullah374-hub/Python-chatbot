---
slug: ts-basics
title: What TypeScript adds to JavaScript
language: typescript
section: Types
version: v1
---
## Type annotations
TypeScript is JavaScript with types. You can describe what kind of value a variable or parameter should hold, and the TypeScript compiler checks it before the code runs.

```typescript
let count: number = 0;
function greet(name: string): string {
  return `Hello, ${name}`;
}
greet(42);   // error: Argument of type 'number' is not assignable to parameter of type 'string'.
```

These errors appear in your editor or when you compile; the types are removed from the JavaScript that actually runs.

## Type inference
You do not have to annotate everything. When you write `let count = 0`, TypeScript infers that `count` is a `number`, and later `count = "zero"` is reported as an error. Annotations are most useful on function parameters and on values whose type is not obvious.
