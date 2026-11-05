---
slug: sql-joins
title: INNER JOIN and LEFT JOIN
language: sql
section: Joins
version: v1
---
## Why joins exist
Related data is often split across tables, such as `students` and `enrollments`. A join combines rows from two tables using a condition in the `ON` clause, usually matching a key.

```sql
SELECT s.name, e.course
FROM students s
JOIN enrollments e ON e.student_id = s.id;
```

`s` and `e` are table aliases — short names that make the query easier to read.

## INNER JOIN versus LEFT JOIN
`JOIN` (an inner join) keeps only rows that have a match in both tables. A student with no enrollments disappears from the result.

`LEFT JOIN` keeps every row from the left table even when there is no match; the columns from the right table are filled with `NULL`.

```sql
SELECT s.name, e.course
FROM students s
LEFT JOIN enrollments e ON e.student_id = s.id;   -- students without courses show course = NULL
```

To find rows with no match, add `WHERE e.student_id IS NULL` after a `LEFT JOIN`. Forgetting the `ON` condition, or using the wrong columns in it, multiplies rows and is a common source of surprising counts.
