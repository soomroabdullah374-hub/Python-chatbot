---
slug: python-for-loops
title: for loops and range in Python
language: python
section: Control flow
version: v1
---
## Looping over a collection
A `for` loop repeats a block of code once for each item in a collection. The loop variable takes each value in turn.

```python
for fruit in ["apple", "pear", "fig"]:
    print(fruit)
```

The indented lines under the `for` line form the loop body. Python uses indentation (usually 4 spaces) instead of braces, so a missing or inconsistent indent causes an `IndentationError`.

## range and counting
`range(n)` produces the numbers 0, 1, … n − 1 — it stops before `n`. `range(start, stop)` starts at `start` and still stops before `stop`.

```python
for i in range(3):
    print(i)        # 0, 1, 2
```

To loop over list positions use `range(len(items))`, which gives exactly the valid indexes. Adding 1, as in `range(len(items) + 1)`, produces one index too many and causes an `IndexError`. When you only need the items, loop over the list directly instead of using indexes.

## Looping over a string and counting
A string is a sequence of characters, so a `for` loop visits each character one at a time. A counter variable that starts at 0 and grows inside the loop is a common pattern.

```python
word = "banana"
count = 0
for letter in word:
    if letter in "aeiou":
        count += 1
print(count)   # expected output: 3
```

`count += 1` is a short way of writing `count = count + 1`.
