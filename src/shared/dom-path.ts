export type DomPath = number[];

export function createDomPath(root: Element, target: Element): DomPath | null {
  if (root === target) return [];
  const path: number[] = [];
  let current: Element | null = target;

  while (current && current !== root) {
    const parent: Element | null = current.parentElement;
    if (!parent) return null;
    const index = [...parent.children].indexOf(current);
    if (index < 0) return null;
    path.unshift(index);
    current = parent;
  }

  return current === root ? path : null;
}

export function resolveDomPath(root: Element, path: DomPath): HTMLElement | null {
  let current: Element = root;
  for (const index of path) {
    const next = current.children[index];
    if (!next) return null;
    current = next;
  }
  return current instanceof HTMLElement ? current : null;
}
