interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hProperties?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

const IMAGE_ATTRIBUTES = /^\{\.align-(left|right)\s+width=(\d{1,4})\}/;

function findImage(node: MarkdownNode): MarkdownNode | undefined {
  if (node.type === 'image') return node;

  for (const child of node.children ?? []) {
    const image = findImage(child);
    if (image) return image;
  }
}

function applyImageAttributes(node: MarkdownNode): void {
  const children = node.children;
  if (!children) return;

  for (let index = 1; index < children.length; index += 1) {
    const attributes = children[index];
    const image = findImage(children[index - 1]);
    const match = attributes.value?.match(IMAGE_ATTRIBUTES);

    if (!image || attributes.type !== 'text' || !match) continue;

    const width = Number(match[2]);
    if (width < 1 || width > 2000) continue;

    image.data = {
      ...image.data,
      hProperties: {
        ...image.data?.hProperties,
        className: [`align-${match[1]}`],
        width,
      },
    };

    attributes.value = attributes.value?.slice(match[0].length);
    if (!attributes.value) {
      children.splice(index, 1);
      index -= 1;
    }
  }

  for (const child of children) applyImageAttributes(child);
}

export default function remarkImageAttributes() {
  return (tree: unknown): void => applyImageAttributes(tree as MarkdownNode);
}
