---
slug: css-flexbox-grid
title: Flexbox and grid layouts
language: html_css
section: CSS layout
version: v1
---
## Flexbox: one direction
Flexbox lays items out in a single row or column. Set `display: flex` on the parent; the children become flex items.

```css
.navbar {
  display: flex;
  justify-content: space-between;  /* along the main axis (the row) */
  align-items: center;             /* across it (vertically in a row) */
  gap: 16px;
}
```

`justify-content` aligns items along the main axis, which is horizontal for `flex-direction: row`. `align-items` aligns them on the cross axis. Swapping the two is one of the most common flexbox mix-ups.

## Grid: two directions
CSS grid places items in rows and columns at the same time, which suits page layouts and card galleries.

```css
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);  /* three equal columns */
  gap: 16px;
}
```

A navbar is usually a flexbox job (one row of links); a gallery of cards is usually a grid job.
