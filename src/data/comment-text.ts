const entities: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

export const decodeHtmlEntities = (value: string) =>
  value.replace(
    /&(#(?:x[\da-f]+|\d+)|amp|apos|gt|lt|nbsp|quot);/gi,
    (match, entity: string) => {
      if (entity.toLowerCase().startsWith('#x')) {
        const codePoint = Number.parseInt(entity.slice(2), 16);
        return Number.isInteger(codePoint) && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : match;
      }
      if (entity.startsWith('#')) {
        const codePoint = Number.parseInt(entity.slice(1), 10);
        return Number.isInteger(codePoint) && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : match;
      }
      return entities[entity.toLowerCase()] || match;
    },
  );
