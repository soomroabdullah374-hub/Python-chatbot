---
slug: python-lists
title: Lists and indexes in Python
language: python
section: Lists
version: v1
---
## Creating and reading a list
A list is an ordered collection of values written in square brackets. Each item has a position called an index, and indexes start at 0.

```python
fruits = ["apple", "pear", "fig"]
print(fruits[0])    # apple
print(fruits[2])    # fig
print(len(fruits))  # 3
```

A list of 3 items has indexes 0, 1 and 2. The last valid index is always `len(fruits) - 1`. Negative indexes count from the end: `fruits[-1]` is the last item.

## Changing a list
Lists are mutable, which means you can change them after creating them. `append` adds one item to the end; assigning to an index replaces an item.

```python
fruits.append("kiwi")   # ['apple', 'pear', 'fig', 'kiwi']
fruits[1] = "plum"      # ['apple', 'plum', 'fig', 'kiwi']
```

`append` changes the list in place and returns `None`, so `fruits = fruits.append("kiwi")` is a common mistake: it replaces your list with `None`.

## IndexError: list index out of range
Asking for a position that does not exist raises `IndexError: list index out of range`. With `scores = [72, 88, 95]`, `scores[3]` fails because the last index is 2. This often comes from loops that run one step too far, for example `range(len(scores) + 1)`. Check which index the failing line uses and compare it with `len(...) - 1`.
