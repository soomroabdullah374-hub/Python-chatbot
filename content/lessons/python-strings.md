---
slug: python-strings
title: Strings and f-strings in Python
language: python
section: Strings
version: v1
---
## Working with text
A string is text inside quotes. Single and double quotes work the same way. Strings can be joined with `+` and repeated with `*`, and `len()` gives the number of characters.

```python
first = "Code"
second = "Bloom"
print(first + second)   # CodeBloom
print(len(first))       # 4
```

You cannot add a string and a number directly: `"Age: " + 15` raises `TypeError: can only concatenate str (not "int") to str`. Convert the number with `str(15)`, or use an f-string.

## f-strings
An f-string starts with `f` before the quote and can include values inside curly braces.

```python
name = "Sara"
age = 15
print(f"{name} is {age} years old")   # Sara is 15 years old
```

## Strings cannot be changed in place
Strings are immutable: methods such as `.upper()` or `.replace()` return a new string and leave the original unchanged. Store the result if you need it: `name = name.upper()`.
