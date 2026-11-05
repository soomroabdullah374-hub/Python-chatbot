# Retrieval evaluation — 2026-11-05

Corpus: `content/corpus.json` at commit `63979448` (21 documents, 52 chunks). Embeddings: gte-small,
384 dims, mean pooling + normalisation (`gte-small-384-v1`), computed inside the Supabase Edge Runtime.
Queries were embedded the same way through the operator-only `ingest-content` `search` action and
matched with `public.match_document_chunks` (published documents only, language filter + `general`).

| # | Query | Language | Result | Similarity (expected lesson, or best match for off-topic) |
|---|---|---|---|---|
| 1 | What is a variable in Python? | python | HIT @1 | 0.934 |
| 2 | When should I use let instead of const? | javascript | HIT @1 | 0.939 |
| 3 | Why do I get IndexError: list index out of range in my loop? | python | HIT @1 | 0.930 |
| 4 | How does range work in a for loop? | python | HIT @1 | 0.891 |
| 5 | my if letter == "a" or "e" condition is always true | python | HIT @1 | 0.924 |
| 6 | What is the difference between return and print? | python | HIT @1 | 0.933 |
| 7 | How do I loop over the keys and values of a dictionary? | python | HIT @1 | 0.935 |
| 8 | How do f-strings work? | python | HIT @1 | 0.859 |
| 9 | TypeError: Assignment to constant variable | javascript | HIT @1 | 0.860 |
| 10 | my arrow function returns undefined | javascript | HIT @1 | 0.929 |
| 11 | What is the difference between == and ===? | javascript | HIT @1 | 0.885 |
| 12 | How do I loop through an array? | javascript | HIT @1 | 0.871 |
| 13 | What does TypeScript add to JavaScript? | typescript | HIT @1 | 0.881 |
| 14 | How do I make a property optional in an interface? | typescript | HIT @1 | 0.869 |
| 15 | Explain this SQL query line by line: SELECT name FROM students WHERE score > 50 ORDER BY score | sql | HIT @1 | 0.889 |
| 16 | INNER JOIN vs LEFT JOIN | sql | HIT @1 | 0.930 |
| 17 | What is the difference between WHERE and HAVING? | sql | HIT @1 | 0.873 |
| 18 | justify-content vs align-items in flexbox | html_css | HIT @1 | 0.921 |
| 19 | margin vs padding | html_css | HIT @1 | 0.892 |
| 20 | Which HTML tags should I use for page structure? | html_css | HIT @1 | 0.895 |
| 21 | How do I start debugging when my program crashes? | python | HIT @1 | 0.893 |
| 22 | How do I bake sourdough bread? | python | off-topic | 0.733 |
| 23 | What is the capital of France? | any | off-topic | 0.714 |
| 24 | Write a poem about the ocean | javascript | off-topic | 0.706 |

## Metrics
- recall@1 = **21/21** on-topic queries (recall@4 = 21/21).
- On-topic similarity of the expected lesson: min **0.859**, max 0.939.
- Off-topic best match: max **0.733**.

## Threshold decision
`RETRIEVAL_MIN_SIMILARITY = 0.80` (chat function default) sits in the gap between the two ranges, so
off-topic questions get no references (the tutor answers generally and says so) while every on-topic
question keeps its lesson. This is a small, hand-written set; re-run it whenever the corpus, the
embedding model or the threshold changes (see RAG.md "Evaluation").
