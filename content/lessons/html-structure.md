---
slug: html-structure
title: HTML elements, attributes and structure
language: html_css
section: HTML
version: v1
---
## Elements and tags
HTML describes the structure of a page with elements. Most elements have an opening tag, content and a closing tag; attributes inside the opening tag add extra information.

```html
<a href="https://example.com" target="_blank">Visit</a>
<img src="cat.png" alt="A sleeping cat">
```

`<img>` has no closing tag. The `alt` text describes an image for people using screen readers and is shown if the image fails to load.

## Semantic structure
Semantic elements say what content is, which helps accessibility and search engines: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`. Use headings `<h1>`–`<h6>` in order without skipping levels, `<button>` for actions and `<a>` for navigation. A page usually has one `<h1>`.
