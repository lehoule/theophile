import { describe, expect, it } from 'vitest';
import {
  BLOG_PAGE_SIZE,
  blogPageHref,
  getBlogPagination,
} from '../src/data/pagination';

describe('blog pagination', () => {
  it('uses the blog root for the first page and archive paths after it', () => {
    expect(BLOG_PAGE_SIZE).toBe(12);
    expect(blogPageHref(1)).toBe('/blog/');
    expect(blogPageHref(2)).toBe('/blog/page/2/');
  });

  it.each([
    [1, 3, { previousPage: null, nextPage: 2 }],
    [2, 3, { previousPage: 1, nextPage: 3 }],
    [3, 3, { previousPage: 2, nextPage: null }],
    [1, 1, { previousPage: null, nextPage: null }],
  ])(
    'returns navigation for page %i of %i',
    (currentPage, totalPages, expected) => {
      expect(getBlogPagination(currentPage, totalPages)).toEqual(expected);
    },
  );
});
