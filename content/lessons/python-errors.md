---
slug: python-reading-errors
title: Reading Python error messages
language: python
section: Errors
version: v1
---
## How to read a traceback
When Python stops with an error it prints a traceback. Read it from the bottom: the last line names the error type and a short message, and the lines just above it show the file and line number where it happened.

```text
Traceback (most recent call last):
  File "average.py", line 4, in <module>
    total += scores[i]
IndexError: list index out of range
```

Here the problem is on line 4, and the type is `IndexError`. The traceback tells you where Python noticed the problem, which is not always where the mistake was made.

## Common error types
- `NameError`: a name was used before it was assigned, or it is misspelled.
- `TypeError`: a value was used in a way its type does not allow, such as `"3" + 4`.
- `IndexError`: a list position that does not exist.
- `KeyError`: a dictionary key that does not exist.
- `IndentationError` / `SyntaxError`: the code is not valid Python, often a missing colon or inconsistent spaces.
- `ZeroDivisionError`: dividing by zero.

## A simple debugging routine
Reproduce the error, read the last line, go to the line number, and print the values involved just before that line (for example `print(i, len(scores))`). Change one thing at a time and run again. Checking the exact input that fails is usually faster than rewriting the whole program.
