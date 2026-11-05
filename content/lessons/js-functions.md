---
slug: js-functions
title: Functions in JavaScript
language: javascript
section: Functions
version: v1
---
## Function declarations and calls
A function is a reusable block of code. You define it once and call it with parentheses, passing arguments that fill its parameters.

```javascript
function add(a, b) {
  return a + b;
}
console.log(add(2, 3));   // 5
```

`return` sends a value back to the caller and ends the function. A function without `return` gives back `undefined`.

## Arrow functions
Arrow functions are a shorter syntax that is common for small functions and callbacks. With a single expression and no braces, the value is returned automatically.

```javascript
const double = (x) => x * 2;
const greet = (name) => {
  return `Hello, ${name}`;
};
```

If you add braces to an arrow function you must write `return` yourself; forgetting it is a common reason a function returns `undefined`.
