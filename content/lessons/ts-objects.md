---
slug: ts-object-types
title: Interfaces, optional properties and unions in TypeScript
language: typescript
section: Types
version: v1
---
## Describing objects
An `interface` (or a `type` alias) describes the shape of an object: which properties it has and their types. A question mark marks an optional property.

```typescript
interface Learner {
  name: string;
  age: number;
  nickname?: string;   // optional
}
const sara: Learner = { name: "Sara", age: 15 };
```

Leaving out a required property, or adding one that the interface does not declare, is reported as an error.

## Union types
A union type allows one of several types, written with `|`. Before using a value as one specific type, check which one you have; TypeScript narrows the type inside the check.

```typescript
function show(id: number | string) {
  if (typeof id === "string") {
    return id.toUpperCase();   // id is a string here
  }
  return id.toFixed(0);        // id is a number here
}
```
