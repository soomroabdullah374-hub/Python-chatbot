---
slug: js-equality-and-errors
title: Equality, truthiness and common errors in JavaScript
language: javascript
section: Errors
version: v1
---
## == versus ===
`===` (strict equality) compares value and type without converting anything. `==` converts types first, which leads to surprises such as `0 == ""` being `true`. Use `===` and `!==` by default.

```javascript
console.log(5 === "5");   // false
console.log(5 == "5");    // true (the string is converted)
```

Falsy values are `false`, `0`, `""`, `null`, `undefined` and `NaN`; everything else is truthy in an `if`.

## Reading a TypeError and a ReferenceError
A `TypeError` means a value was used in a way its type does not allow, for example calling something that is not a function, reading a property of `undefined` (`Cannot read properties of undefined`), or reassigning a `const`. A `ReferenceError` such as `x is not defined` means the name does not exist in that scope — often a typo or a variable declared inside another block.

The browser console shows the message plus the file and line number. Start from the first error in the console, go to that line, and log the values involved with `console.log` before changing anything.
