(() => {
  'use strict';

  /**
   * Privacy-safe analytics adapter.
   * No data is sent until a consent-aware analytics provider is configured.
   * When GA4 is added later, existing event names will flow through window.gtag.
   */
  const track = (eventName, parameters = {}) => {
    const detail = { event: eventName, ...parameters };

    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, parameters);
    }

    window.dispatchEvent(new CustomEvent('site:analytics', { detail }));
  };

  window.siteAnalytics = Object.freeze({ track });

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-analytics-event]');
    if (!target) return;

    track(target.dataset.analyticsEvent, {
      link_label: target.dataset.analyticsLabel || target.textContent.trim(),
      link_url: target.href || undefined,
      page_path: window.location.pathname
    });
  });
})();
