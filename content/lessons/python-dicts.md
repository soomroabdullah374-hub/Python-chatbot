---
slug: python-dictionaries
title: Dictionaries in Python
language: python
section: Dictionaries
version: v1
---
## Keys and values
A dictionary stores pairs of keys and values. You look a value up by its key instead of by a position.

```python
ages = {"Sara": 15, "Ali": 17}
print(ages["Sara"])   # 15
ages["Omar"] = 16     # add a new pair
```

Keys must be unique and are usually strings or numbers. Asking for a key that does not exist raises `KeyError`. `ages.get("Zara")` returns `None` instead of raising an error, and `ages.get("Zara", 0)` returns the default `0`.

## Looping over a dictionary
Looping over a dictionary directly gives its keys. `.items()` gives each key and value together, which you can unpack into two variables.

```python
for name, age in ages.items():
    print(name, "is", age)
```

`.keys()` returns the keys and `.values()` returns the values. Use `"Sara" in ages` to check whether a key exists before reading it.
