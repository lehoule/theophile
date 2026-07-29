/// <reference types="astro/client" />

interface Window {
  onTheophileTurnstileLoad?: () => void;
  turnstile?: {
    render: (
      element: HTMLElement,
      options: {
        sitekey: string;
        callback: (token: string) => void;
        'error-callback': (code: string) => boolean;
        'expired-callback': () => void;
        'timeout-callback': () => void;
      },
    ) => string;
    reset: (widgetId: string) => void;
  };
  PagefindUI?: new (options: {
    element: string;
    showSubResults: boolean;
    resetStyles: boolean;
  }) => unknown;
}
