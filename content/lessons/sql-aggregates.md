---
slug: sql-aggregates
title: GROUP BY, COUNT and HAVING
language: sql
section: Aggregates
version: v1
---
## Summarising rows
Aggregate functions turn many rows into one value: `COUNT`, `SUM`, `AVG`, `MIN` and `MAX`. `GROUP BY` makes one group per distinct value and applies the aggregate to each group.

```sql
SELECT city, COUNT(*) AS students
FROM students
GROUP BY city;
```

Every column in `SELECT` must either be inside an aggregate or listed in `GROUP BY`; otherwise the database cannot know which row's value to show.

## WHERE versus HAVING
`WHERE` filters individual rows before grouping. `HAVING` filters whole groups after the aggregates are calculated.

```sql
SELECT city, AVG(score) AS average
FROM students
WHERE score IS NOT NULL
GROUP BY city
HAVING COUNT(*) >= 5;
```
