---
slug: js-arrays-loops
title: Arrays and loops in JavaScript
language: javascript
section: Arrays
version: v1
---
## Arrays and indexes
An array is an ordered list of values. Indexes start at 0, and `length` gives the number of items, so the last index is `length - 1`.

```javascript
const scores = [72, 88, 95];
console.log(scores[0]);       // 72
console.log(scores.length);   // 3
console.log(scores[3]);       // undefined (no error in JavaScript)
```

Unlike Python, reading past the end of an array does not throw an error — it gives `undefined`, which can silently turn a sum into `NaN`.

## Ways to loop
A classic `for` loop uses an index; `for...of` visits each value directly; `forEach` and `map` take a function.

```javascript
for (let i = 0; i < scores.length; i++) { console.log(scores[i]); }
for (const s of scores) { console.log(s); }
const doubled = scores.map((s) => s * 2);   // [144, 176, 190]
```

Using `i <= scores.length` instead of `<` runs one step too far and reads `undefined`.
