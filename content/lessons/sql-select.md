---
slug: sql-select-basics
title: Reading a SELECT query line by line
language: sql
section: Queries
version: v1
---
## The parts of a SELECT
A `SELECT` query asks a database for rows. Each clause has one job:

```sql
SELECT name, score          -- which columns to show
FROM students               -- which table to read
WHERE score >= 50           -- which rows to keep
ORDER BY score DESC         -- how to sort the result
LIMIT 3;                    -- how many rows to return
```

Text values go in single quotes (`WHERE city = 'Lahore'`). `SELECT *` returns every column, which is handy for exploring but fragile in real code.

## The order the database works in
The clauses are written in one order but evaluated in another: `FROM` first, then `WHERE` filters rows, `GROUP BY` forms groups, `HAVING` filters groups, `SELECT` picks the columns, `ORDER BY` sorts, and `LIMIT` cuts the list. This is why a column alias defined in `SELECT` usually cannot be used in `WHERE`.

## NULL means "unknown"
`NULL` is not zero or an empty string — it means the value is missing. Comparing with `= NULL` never matches; use `IS NULL` or `IS NOT NULL` instead.
