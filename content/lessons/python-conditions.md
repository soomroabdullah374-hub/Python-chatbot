---
slug: python-conditions
title: if, elif, else and boolean logic in Python
language: python
section: Control flow
version: v1
---
## Making decisions with if
An `if` statement runs its indented block only when its condition is true. `elif` checks another condition when the earlier ones were false, and `else` runs when none of them were true.

```python
temperature = 30
if temperature > 25:
    print("hot")
elif temperature > 15:
    print("mild")
else:
    print("cold")
```

Comparison operators are `==` (equal), `!=` (not equal), `<`, `>`, `<=` and `>=`. A single `=` assigns and is a syntax error inside an `if` condition.

## The "or" trap
`letter == "a" or "e"` does not compare `letter` with both strings. Python reads it as `(letter == "a") or "e"`. A non-empty string such as `"e"` counts as true, so the whole condition is always true. Write each comparison in full, or check membership instead:

```python
if letter == "a" or letter == "e":
    ...
if letter in "aeiou":   # shorter: is letter one of these characters?
    ...
```

## Truthy and falsy values
Python treats some values as false in conditions: `False`, `0`, `0.0`, `""` (empty string), `[]` (empty list), `{}` (empty dict) and `None`. Everything else counts as true. That is why `if items:` is a common way to check that a list is not empty.
