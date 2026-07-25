export function postHref(date: Date, slug: string): string {
  return `/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${slug}/`;
}

export function categoryHref(category: string): string {
  return `/category/${slugify(category)}/`;
}

export function slugify(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
