export const BLOG_PAGE_SIZE = 12;

export function blogPageHref(page: number): string {
  return page === 1 ? '/blog/' : `/blog/page/${page}/`;
}

export function getBlogPagination(currentPage: number, totalPages: number) {
  return {
    previousPage: currentPage > 1 ? currentPage - 1 : null,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
  };
}
