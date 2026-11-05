---
slug: python-functions
title: Functions, parameters and return in Python
language: python
section: Functions
version: v1
---
## Defining and calling a function
A function is a named block of code you can run many times. `def` defines it; calling it with parentheses runs it.

```python
def greet(name):
    return "Hello, " + name

message = greet("Ali")
print(message)   # Hello, Ali
```

`name` is a parameter: a variable that receives the value passed in the call (the argument, here `"Ali"`).

## return versus print
`return` sends a value back to the code that called the function, so it can be stored or used in a calculation. `print` only shows text on the screen. A function without a `return` statement returns `None`.

```python
def double(x):
    print(x * 2)

result = double(4)   # shows 8
print(result)        # None — nothing was returned
```

If you need the value later, use `return`. Code after a `return` inside the same block does not run.

## Common function errors
Calling a function with the wrong number of arguments raises a `TypeError`, for example `greet()` gives `TypeError: greet() missing 1 required positional argument: 'name'`. Forgetting the parentheses (`greet` instead of `greet("Ali")`) does not call the function at all; it just refers to it.
