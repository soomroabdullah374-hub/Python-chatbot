---
slug: css-box-model
title: The CSS box model
language: html_css
section: CSS basics
version: v1
---
## Content, padding, border, margin
Every element is a box. From the inside out it has content, padding (space inside the border), a border, and margin (space outside the border that pushes other boxes away).

```css
.card {
  width: 200px;
  padding: 16px;
  border: 1px solid #ccc;
  margin: 24px;
}
```

## box-sizing
By default, `width` sets only the content width, so the card above is actually 234px wide (200 + 2×16 padding + 2×1 border). With `box-sizing: border-box`, `width` includes padding and border, which makes sizes easier to predict. Many stylesheets apply it to every element: `*, *::before, *::after { box-sizing: border-box; }`.
