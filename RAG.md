# CodeBloom Retrieval Specification

RAG supplies relevant approved material before generation. It does not guarantee correctness.

## Corpus
Prefer original instructional content and approved official docs with documented rights to store, transform and display. Record provenance and permissions before ingestion. Manifest fields: source id, title, URL, language, version/retrieval date, license note, content hash, embedding model/version, status.

## Ingestion lifecycle
draft -> validated -> chunked -> embedded -> checked -> published. Failures never expose partial content.

## Preprocessing and chunking
Remove navigation/scripts; keep headings, code indentation and surrounding explanation; dedupe by source+hash; never ingest secrets or user conversations. Starting target ~180-300 tokens per chunk with small overlap only where meaning requires (starting parameters, not proven optimal). Split on headings/paragraphs, keep examples with explanations, never silently truncate beyond the model limit.

## Embedding adapter
embedQuery(text), embedDocuments(chunks). gte-small, 384 dims, mean pooling, normalization, identical for both paths. Changing models requires a new embedding version and full re-embed.

## Query and retrieval
Embed latest question plus minimal context (and bounded code excerpt). Validate language filter -> embed -> search published, version-compatible chunks -> filter in SQL -> bounded candidates -> dedupe -> up to 5 chunks within budget -> server-assigned labels S1..Sn. Threshold must come from evaluation, not a tutorial default.

## Weak retrieval
Do not invent references; allow general explanation; no "verified" label; state limits on version-sensitive questions; ask for version when needed.

## Attribution
Model may cite only supplied labels. Post-generation: parse labels, reject unknown, map to stored metadata, display only validated URLs from approved hosts. "References used" is not "independently verified".

## Multilingual
English first. Roman Urdu needs a dedicated eval set; do not assume an English embedding model works. Migrate via new embedding version.

## Security
Retrieved text is untrusted: separate from system instructions, ignore embedded instructions, no credentials, no tools, verify URL schemes/hosts.

## Evaluation
Human-reviewed cases: definitions, near-synonym terms, syntax, pasted code, version differences, no-answer, injection text, English/Roman Urdu. Metrics: recall@k, precision@k, source relevance, label validity, correctness, clarity, latency, embedding failures. Record by corpus/embedding/model/prompt version.

## Later (only if measured need)
Hybrid keyword+vector, reranking, multilingual embeddings, version routing, private learner documents.
