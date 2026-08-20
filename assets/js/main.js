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
