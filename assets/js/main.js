(() => {
  'use strict';

  const root = document.documentElement;
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.primary-nav');
  const themeToggle = document.querySelector('.theme-toggle');
  const themeColor = document.querySelector('meta[name="theme-color"]');

  const closeNavigation = () => {
    if (!nav || !navToggle) return;
    nav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.querySelector('.sr-only').textContent = 'Open navigation';
    document.body.classList.remove('nav-open');
  };

  if (nav && navToggle) {
    navToggle.addEventListener('click', () => {
      const opening = navToggle.getAttribute('aria-expanded') !== 'true';
      nav.classList.toggle('is-open', opening);
      navToggle.setAttribute('aria-expanded', String(opening));
      navToggle.querySelector('.sr-only').textContent = opening ? 'Close navigation' : 'Open navigation';
      document.body.classList.toggle('nav-open', opening);
    });

    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeNavigation));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeNavigation();
    });
  }

  const getPreferredTheme = () => {
    if (root.dataset.theme) return root.dataset.theme;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  };

  const setTheme = (theme) => {
    root.dataset.theme = theme;
    if (themeToggle) {
      const light = theme === 'light';
      themeToggle.setAttribute('aria-pressed', String(light));
      themeToggle.setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} theme`);
    }
    if (themeColor) themeColor.setAttribute('content', theme === 'light' ? '#f6f8fc' : '#0b1424');
  };

  setTheme(getPreferredTheme());

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = root.dataset.theme === 'light' ? 'dark' : 'light';
      setTheme(nextTheme);
      try {
        localStorage.setItem('anton-tuhai-theme', nextTheme);
      } catch (error) {
        // Theme switching still works for the current visit.
      }
    });
  }

  const searchDialog = document.querySelector('[data-search-dialog]');
  const searchOpenButtons = Array.from(document.querySelectorAll('[data-search-open]'));
  const searchCloseButton = searchDialog?.querySelector('[data-search-close]');
  const searchForm = searchDialog?.querySelector('[data-site-search]');
  const searchInput = searchDialog?.querySelector('[data-search-input]');
  const searchStatus = searchDialog?.querySelector('[data-search-status]');
  const searchResults = searchDialog?.querySelector('[data-search-results]');
  const searchEmpty = searchDialog?.querySelector('[data-search-empty]');
  const searchSuggestions = searchDialog?.querySelector('[data-search-suggestions]');
  const searchSuggestionButtons = Array.from(searchDialog?.querySelectorAll('[data-search-suggestion]') || []);
  let searchTrigger = null;
  let currentSearchMatches = [];

  const normalizeSearchText = (value) => value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const searchSectionLabels = {
    top: 'Profile',
    approach: 'Approach',
    impact: 'Impact',
    experience: 'Experience',
    work: 'Selected work',
    feedback: 'Feedback & recognition',
    capabilities: 'Capabilities',
    education: 'Education & languages',
    contact: 'Contact'
  };

  const searchableNodes = Array.from(document.querySelectorAll([
    '#top .hero-copy',
    '#approach .model-card',
    '#approach .lens-panel',
    '#impact .impact-card',
    '#experience .timeline-item',
    '#work .work-card',
    '#work .growth-band',
    '#feedback .feedback-card',
    '#capabilities .capability-groups article',
    '#education .education-card article',
    '#education .language-card',
    '#contact .contact-grid > div'
  ].join(',')));

  const searchIndex = searchableNodes.map((node, index) => {
    const section = node.closest('section[id]');
    const sectionId = section?.id || 'top';
    const heading = node.querySelector('h1, h2, h3, h4');
    const title = heading?.textContent.trim() || searchSectionLabels[sectionId] || 'Profile detail';
    const content = node.textContent.replace(/\s+/g, ' ').trim();
    if (!node.id) node.id = `profile-search-target-${index + 1}`;

    return {
      target: node,
      targetId: node.id,
      title,
      normalizedTitle: normalizeSearchText(title),
      content,
      normalizedContent: normalizeSearchText(content),
      section: searchSectionLabels[sectionId] || sectionId
    };
  });

  const getSearchScore = (item, phrase, tokens) => {
    let score = 0;
    if (item.normalizedTitle === phrase) score += 80;
    else if (item.normalizedTitle.includes(phrase)) score += 45;
    if (item.normalizedContent.includes(phrase)) score += 25;

    tokens.forEach((token) => {
      if (item.normalizedTitle.includes(token)) score += 10;
      if (item.normalizedContent.includes(token)) score += 3;
    });

    return score;
  };

  const getSearchExcerpt = (item, tokens) => {
    const sentences = item.content.split(/(?<=[.!?])\s+/);
    const bestSentence = sentences.find((sentence) => {
      const normalizedSentence = normalizeSearchText(sentence);
      return tokens.some((token) => normalizedSentence.includes(token));
    }) || sentences[0] || item.content;
    const compact = bestSentence.replace(/\s+/g, ' ').trim();
    return compact.length > 190 ? `${compact.slice(0, 187).trimEnd()}…` : compact;
  };

  const sanitizeSearchTermForAnalytics = (value) => {
    const compact = value.replace(/\s+/g, ' ').trim().slice(0, 60);
    const mayContainPersonalData = /@|(?:\+?\d[\d\s().-]{6,})/.test(compact);
    return mayContainPersonalData ? '[redacted]' : compact;
  };

  const renderSearchResults = (value) => {
    if (!searchResults || !searchStatus || !searchEmpty || !searchSuggestions) return [];
    const phrase = normalizeSearchText(value);
    const tokens = phrase.split(' ').filter((token) => token.length > 1);
    searchResults.replaceChildren();
    searchSuggestions.hidden = Boolean(phrase);

    if (!phrase || !tokens.length) {
      searchStatus.textContent = 'Start typing to search the full profile.';
      searchEmpty.hidden = true;
      currentSearchMatches = [];
      return currentSearchMatches;
    }

    currentSearchMatches = searchIndex
      .map((item) => ({ item, score: getSearchScore(item, phrase, tokens) }))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
      .slice(0, 8);

    searchStatus.textContent = `${currentSearchMatches.length} ${currentSearchMatches.length === 1 ? 'result' : 'results'} for “${value.trim()}”`;
    searchEmpty.hidden = currentSearchMatches.length > 0;

    currentSearchMatches.forEach(({ item }, index) => {
      const listItem = document.createElement('li');
      const link = document.createElement('a');
      const meta = document.createElement('span');
      const title = document.createElement('strong');
      const excerpt = document.createElement('p');

      link.className = 'search-result-link';
      link.href = `#${item.targetId}`;
      link.dataset.searchResult = '';
      link.dataset.searchPosition = String(index + 1);
      meta.className = 'search-result-meta';
      meta.textContent = item.section;
      title.className = 'search-result-title';
      title.textContent = item.title;
      excerpt.className = 'search-result-excerpt';
      excerpt.textContent = getSearchExcerpt(item, tokens);
      link.append(meta, title, excerpt);
      listItem.append(link);
      searchResults.append(listItem);
    });

    return currentSearchMatches;
  };

  const trackSearch = () => {
    const query = searchInput?.value.trim() || '';
    if (query.length < 2) return;
    window.siteAnalytics?.track('view_search_results', {
      search_term: sanitizeSearchTermForAnalytics(query),
      result_count: currentSearchMatches.length,
      page_path: window.location.pathname
    });
  };

  const openSearch = () => {
    if (!searchDialog || typeof searchDialog.showModal !== 'function') return;
    closeNavigation();
    searchTrigger = document.activeElement;
    searchDialog.showModal();
    document.body.classList.add('search-open');
    renderSearchResults(searchInput?.value || '');
    window.siteAnalytics?.track('site_search_open', { page_path: window.location.pathname });
    requestAnimationFrame(() => searchInput?.focus());
  };

  const closeSearch = () => {
    if (searchDialog?.open) searchDialog.close();
  };

  searchOpenButtons.forEach((button) => button.addEventListener('click', openSearch));
  searchCloseButton?.addEventListener('click', closeSearch);
  searchDialog?.addEventListener('click', (event) => {
    if (event.target === searchDialog) closeSearch();
  });
  searchDialog?.addEventListener('close', () => {
    document.body.classList.remove('search-open');
    searchTrigger?.focus();
    searchTrigger = null;
  });

  searchInput?.addEventListener('input', () => renderSearchResults(searchInput.value));
  searchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    renderSearchResults(searchInput?.value || '');
    trackSearch();
  });

  searchSuggestionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (!searchInput) return;
      searchInput.value = button.dataset.searchSuggestion || '';
      renderSearchResults(searchInput.value);
      trackSearch();
      searchInput.focus();
    });
  });

  searchResults?.addEventListener('click', (event) => {
    const link = event.target.closest('[data-search-result]');
    if (!link) return;
    event.preventDefault();
    const target = document.getElementById(link.hash.slice(1));
    const matchedItem = currentSearchMatches[Number(link.dataset.searchPosition) - 1]?.item;

    window.siteAnalytics?.track('search_result_click', {
      search_term: sanitizeSearchTermForAnalytics(searchInput?.value || ''),
      result_title: matchedItem?.title,
      result_section: matchedItem?.section,
      result_position: Number(link.dataset.searchPosition),
      page_path: window.location.pathname
    });

    if (target?.matches('.lens-panel')) {
      document.querySelector(`[aria-controls="${target.id}"]`)?.click();
    }

    closeSearch();
    requestAnimationFrame(() => {
      target?.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center', inline: 'center' });
      target?.classList.add('search-target-active');
      window.setTimeout(() => target?.classList.remove('search-target-active'), 1900);
    });
  });

  document.addEventListener('keydown', (event) => {
    const typing = event.target.matches('input, textarea, select, [contenteditable="true"]');
    const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('en') === 'k';
    const slashShortcut = event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (!shortcut && !slashShortcut) return;
    event.preventDefault();
    openSearch();
  });

  document.querySelectorAll('[data-lens-block]').forEach((block) => {
    const tabs = Array.from(block.querySelectorAll('[role="tab"]'));
    const panels = Array.from(block.querySelectorAll('[role="tabpanel"]'));
    block.classList.add('is-enhanced');

    const selectTab = (tab, focus = false) => {
      tabs.forEach((candidate) => {
        const selected = candidate === tab;
        candidate.setAttribute('aria-selected', String(selected));
        candidate.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((panel) => panel.classList.toggle('is-active', panel.id === tab.getAttribute('aria-controls')));
      if (focus) tab.focus();
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectTab(tab));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let nextIndex = index;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        selectTab(tabs[nextIndex], true);
      });
    });
  });

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll('[data-feedback-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('[data-feedback-track]');
    const slides = Array.from(carousel.querySelectorAll('.feedback-card'));
    const controls = carousel.parentElement?.querySelector('[data-feedback-controls]');
    const previousButton = controls?.querySelector('[data-feedback-prev]');
    const nextButton = controls?.querySelector('[data-feedback-next]');
    const status = controls?.querySelector('[data-feedback-status]');
    let currentIndex = 0;
    let scrollFrame = 0;

    if (!track || !slides.length || !previousButton || !nextButton || !status) return;

    const getVisibleCount = () => Math.max(1, Math.round(track.clientWidth / slides[0].getBoundingClientRect().width));
    const getMaximumIndex = () => Math.max(0, slides.length - getVisibleCount());

    const updateControls = () => {
      const visibleCount = getVisibleCount();
      currentIndex = Math.min(currentIndex, getMaximumIndex());
      const firstVisible = currentIndex + 1;
      const lastVisible = Math.min(slides.length, currentIndex + visibleCount);
      status.textContent = firstVisible === lastVisible ? `${firstVisible} of ${slides.length}` : `${firstVisible}–${lastVisible} of ${slides.length}`;
      previousButton.disabled = currentIndex === 0;
      nextButton.disabled = currentIndex >= getMaximumIndex();
    };

    const goToSlide = (index) => {
      currentIndex = Math.max(0, Math.min(index, getMaximumIndex()));
      const left = slides[currentIndex].offsetLeft - track.offsetLeft;
      track.scrollTo({ left, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      updateControls();
    };

    previousButton.addEventListener('click', () => goToSlide(currentIndex - getVisibleCount()));
    nextButton.addEventListener('click', () => goToSlide(currentIndex + getVisibleCount()));

    track.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'ArrowLeft') goToSlide(currentIndex - getVisibleCount());
      if (event.key === 'ArrowRight') goToSlide(currentIndex + getVisibleCount());
      if (event.key === 'Home') goToSlide(0);
      if (event.key === 'End') goToSlide(getMaximumIndex());
    });

    track.addEventListener('scroll', () => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        currentIndex = slides.reduce((nearestIndex, slide, index) => {
          const distance = Math.abs((slide.offsetLeft - track.offsetLeft) - track.scrollLeft);
          const nearestDistance = Math.abs((slides[nearestIndex].offsetLeft - track.offsetLeft) - track.scrollLeft);
          return distance < nearestDistance ? index : nearestIndex;
        }, 0);
        updateControls();
      });
    }, { passive: true });

    window.addEventListener('resize', updateControls);
    updateControls();
  });

  const feedbackDialog = document.querySelector('[data-feedback-dialog]');
  const feedbackDialogImage = feedbackDialog?.querySelector('[data-feedback-dialog-image]');
  const feedbackDialogTitle = feedbackDialog?.querySelector('[data-feedback-dialog-title]');
  const feedbackDialogClose = feedbackDialog?.querySelector('[data-feedback-close]');
  let feedbackTrigger = null;

  document.querySelectorAll('[data-feedback-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const source = button.dataset.feedbackSrc;
      if (!feedbackDialog || !feedbackDialogImage || !feedbackDialogTitle || typeof feedbackDialog.showModal !== 'function') {
        window.open(source, '_blank', 'noopener');
        return;
      }

      feedbackTrigger = button;
      feedbackDialogImage.src = source;
      feedbackDialogImage.alt = button.dataset.feedbackAlt || 'Original feedback or recognition';
      feedbackDialogTitle.textContent = button.dataset.feedbackTitle || 'Feedback or recognition';
      feedbackDialog.showModal();
    });
  });

  feedbackDialogClose?.addEventListener('click', () => feedbackDialog.close());
  feedbackDialog?.addEventListener('click', (event) => {
    if (event.target === feedbackDialog) feedbackDialog.close();
  });
  feedbackDialog?.addEventListener('close', () => {
    feedbackTrigger?.focus();
    feedbackTrigger = null;
  });

  const navLinks = Array.from(document.querySelectorAll('.primary-nav a[href^="#"]'));
  const navTargets = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window && navTargets.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          const active = link.getAttribute('href') === `#${entry.target.id}`;
          if (active) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
    navTargets.forEach((section) => sectionObserver.observe(section));
  }

  document.querySelectorAll('[data-current-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 896) closeNavigation();
  });
})();
