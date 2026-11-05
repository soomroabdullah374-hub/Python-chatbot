---
slug: js-let-const-var
title: Declaring variables with let and const
language: javascript
section: Variables
version: v1
---
## let and const
Both `let` and `const` create a variable — a name that refers to a value. The difference is reassignment: a `let` variable can be pointed at a new value later, a `const` variable cannot.

```javascript
const name = "Sara";
let score = 0;
score = score + 10;   // fine: let can be reassigned
name = "Ali";         // TypeError: Assignment to constant variable.
```

A good default is to use `const`, and switch to `let` only when the name really needs a new value, such as a counter.

## const does not freeze the value
`const` stops the name from being reassigned, but it does not make objects or arrays read-only. A `const` array can still grow:

```javascript
const items = [1, 2];
items.push(3);        // allowed: same array, new content
items = [4];          // TypeError: the name cannot point at a new array
```

## What about var?
`var` is the older way to declare variables. It is function-scoped instead of block-scoped, so a `var` declared inside an `if` or loop block is visible outside it, and it can be declared twice without an error. Modern code uses `let` and `const` because their block scope makes mistakes easier to spot. Both `let` and `const` must be declared before use; reading them earlier throws a `ReferenceError`.
