---
slug: python-variables
title: Variables and assignment in Python
language: python
section: Variables
version: v1
---
## What a variable is
A variable is a name that refers to a value. You create one with the assignment operator `=`: the name goes on the left and the value on the right.

```python
age = 15
name = "Sara"
```

Python reads `age = 15` as "make the name `age` refer to the value 15". The `=` sign does not mean "is equal to" like in maths — it means "store". Comparing values uses `==` instead.

## Reassigning a variable
You can point an existing name at a new value at any time. The old value is simply forgotten by that name.

```python
score = 0
score = score + 10   # score now refers to 10
```

The right-hand side is worked out first (`0 + 10`), then the result is stored back in `score`. Python variables have no fixed type: the same name can refer to a number now and a string later, although doing that usually makes code harder to read.

## Naming rules and conventions
Names can contain letters, digits and underscores, but cannot start with a digit and cannot be a keyword such as `for` or `if`. Names are case-sensitive, so `Total` and `total` are different. Python style (PEP 8) uses lowercase words joined by underscores, like `total_score`. Using a name before assigning it raises `NameError: name 'x' is not defined`.
