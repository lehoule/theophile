/// <reference types="astro/client" />

interface Window {
  turnstile?: {
    render: (
      element: HTMLElement,
      options: { sitekey: string; callback: (token: string) => void },
    ) => void;
  };
  PagefindUI?: new (options: {
    element: string;
    showSubResults: boolean;
    resetStyles: boolean;
  }) => unknown;
}
