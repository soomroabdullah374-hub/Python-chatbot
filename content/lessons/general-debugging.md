---
slug: general-debugging
title: A beginner's debugging routine
language: general
section: Debugging
version: v1
---
## Reproduce, read, locate
Debugging starts with making the problem happen reliably. Then read the whole error message: the error type and message say what went wrong, and the file and line number say where it was noticed. Go to that line before changing anything.

## Check your assumptions
Most bugs are a difference between what you think a value is and what it really is. Print or log the values just before the failing line, check their types, and test with the smallest input that still fails. Change one thing at a time so you know which change fixed it.

## Off-by-one and other classics
Loops that run one step too many or too few, comparing with `=` instead of `==`, forgetting to return a value, and misspelled names cause a large share of beginner errors. When a loop fails on its last step, compare the highest index it uses with the length minus one.
