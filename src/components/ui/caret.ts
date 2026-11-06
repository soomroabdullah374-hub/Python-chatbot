// rehype plugin: replaces the streaming sentinel (U+2063) with an inline blinking caret element.
// It only creates a known <span class="caret"> node; model output is never parsed as HTML.
export const CARET = '⁣';

interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

export function rehypeCaret() {
  return (tree: HastNode) => {
    const visit = (node: HastNode): boolean => {
      if (!node.children) return false;
      for (let i = 0; i < node.children.length; i += 1) {
        const child = node.children[i];
        if (child.type === 'text' && child.value?.includes(CARET)) {
          const [before, after] = child.value.split(CARET);
          const replacement: HastNode[] = [];
          if (before) replacement.push({ type: 'text', value: before });
          replacement.push({ type: 'element', tagName: 'span', properties: { className: ['caret'], ariaHidden: 'true' }, children: [] });
          if (after) replacement.push({ type: 'text', value: after });
          node.children.splice(i, 1, ...replacement);
          return true;
        }
        if (child.tagName !== 'pre' && visit(child)) return true;
      }
      return false;
    };
    visit(tree);
  };
}
