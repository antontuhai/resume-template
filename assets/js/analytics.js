(() => {
  'use strict';

  const measurementId = 'G-0DJVYF9S27';
  const storageKey = 'anton-tuhai-analytics-consent';
  const banner = document.querySelector('[data-consent-banner]');
  const allowButton = document.querySelector('[data-consent-allow]');
  const denyButton = document.querySelector('[data-consent-deny]');
  const manageButton = document.querySelector('[data-consent-manage]');
  const detailsButton = document.querySelector('[data-consent-details]');
  const detailsPanel = document.querySelector('[data-consent-details-panel]');
  const status = document.querySelector('[data-consent-status]');
  let analyticsRequested = false;

  const readConsent = () => {
    try {
      const value = localStorage.getItem(storageKey);
      return value === 'granted' || value === 'denied' ? value : null;
    } catch (error) {
      return null;
    }
  };

  let consent = readConsent();

  const writeConsent = (value) => {
    consent = value;
    try {
      localStorage.setItem(storageKey, value);
    } catch (error) {
      // The choice still applies to the current page when storage is unavailable.
    }
  };

  const updateConsentStatus = () => {
    if (!status) return;
    if (consent === 'granted') status.textContent = 'Current choice: analytics allowed.';
    else if (consent === 'denied') status.textContent = 'Current choice: necessary storage only.';
    else status.textContent = 'No analytics choice has been saved yet.';
  };

  const hideBanner = () => {
    if (banner) banner.hidden = true;
  };

  const showBanner = (focus = false) => {
    if (!banner) return;
    updateConsentStatus();
    banner.hidden = false;
    if (focus) window.requestAnimationFrame(() => (consent === 'granted' ? denyButton : allowButton)?.focus());
  };

  const clearAnalyticsCookies = () => {
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0].trim();
      if (!name.startsWith('_ga')) return;
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    });
  };

  const loadGoogleAnalytics = () => {
    if (analyticsRequested) {
      window.gtag?.('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
      return;
    }

    analyticsRequested = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };

    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted'
    });
    window.gtag('set', 'ads_data_redaction', true);
    window.gtag('set', 'url_passthrough', false);
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: 7776000,
      cookie_update: false
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.googleAnalytics = measurementId;
    document.head.append(script);
  };

  const setConsent = (value) => {
    const hadActiveAnalytics = consent === 'granted' && analyticsRequested;
    writeConsent(value);
    updateConsentStatus();

    if (value === 'granted') {
      loadGoogleAnalytics();
      hideBanner();
      return;
    }

    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
    clearAnalyticsCookies();
    hideBanner();

    if (hadActiveAnalytics) window.location.reload();
  };

  const track = (eventName, parameters = {}) => {
    const detail = { event: eventName, ...parameters };

    if (consent === 'granted' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, parameters);
    }

    window.dispatchEvent(new CustomEvent('site:analytics', { detail }));
  };

  window.siteAnalytics = Object.freeze({
    track,
    getConsent: () => consent,
    openPreferences: () => showBanner(true)
  });

  allowButton?.addEventListener('click', () => setConsent('granted'));
  denyButton?.addEventListener('click', () => setConsent('denied'));
  manageButton?.addEventListener('click', () => showBanner(true));
  detailsButton?.addEventListener('click', () => {
    const expanded = detailsButton.getAttribute('aria-expanded') === 'true';
    detailsButton.setAttribute('aria-expanded', String(!expanded));
    if (detailsPanel) detailsPanel.hidden = expanded;
  });

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-analytics-event]');
    if (!target) return;
    const linkDomain = target.protocol === 'mailto:' ? 'email' : target.hostname || 'same-page';

    track(target.dataset.analyticsEvent, {
      link_label: target.dataset.analyticsLabel || target.textContent.trim(),
      link_domain: linkDomain,
      page_path: window.location.pathname
    });
  });

  if (consent === 'granted') loadGoogleAnalytics();
  else if (consent === null) showBanner();
})();
