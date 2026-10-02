/* Accessibility behavior for the theme's existing greedy navigation. */
(() => {
  const initializeNavigation = () => {
    const nav = document.getElementById('site-nav');
    if (!nav) return;
    const button = nav.querySelector('button');
    const links = nav.querySelector('.hidden-links');
    if (!button || !links) return;

    const isOpen = () => !button.classList.contains('hidden') && !links.classList.contains('hidden');
    const syncState = () => {
      const open = isOpen();
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
      // The theme can hide the menu after a resize while retaining the icon class.
      if (!open && button.classList.contains('close')) button.classList.remove('close');
    };
    const closeMenu = (returnFocus) => {
      links.classList.add('hidden');
      button.classList.remove('close');
      syncState();
      if (returnFocus && !button.classList.contains('hidden')) button.focus();
    };
    const focusLink = (last) => {
      const items = links.querySelectorAll('a[href]');
      if (items.length) items[last ? items.length - 1 : 0].focus();
    };

    // Observe the classes changed by jquery.greedy-navigation, without replacing it.
    const observer = new MutationObserver(syncState);
    observer.observe(button, { attributes: true, attributeFilter: ['class'] });
    observer.observe(links, { attributes: true, attributeFilter: ['class'] });
    syncState();

    button.addEventListener('click', () => {
      // Existing theme listeners run first and toggle the dropdown.
      syncState();
      if (isOpen()) focusLink(false);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      if (!isOpen()) button.click();
      focusLink(event.key === 'ArrowUp');
    });
    links.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!link) return;
      let destination = null;
      const href = link.getAttribute('href') || '';
      if (href.startsWith('#') && href.length > 1) {
        try {
          destination = document.getElementById(decodeURIComponent(href.slice(1)));
        } catch (_) {
          // A malformed fragment still closes the dropdown safely.
        }
      }
      closeMenu(!destination);
      if (destination) {
        // Do not leave keyboard focus in a menu that has just become hidden.
        // preventScroll preserves the theme's existing smooth-scroll animation.
        if (!destination.hasAttribute('tabindex')) {
          destination.setAttribute('tabindex', '-1');
          destination.addEventListener('blur', () => destination.removeAttribute('tabindex'), { once: true });
        }
        destination.focus({ preventScroll: true });
      }
    });
    nav.addEventListener('focusout', (event) => {
      if (isOpen() && !nav.contains(event.relatedTarget)) closeMenu(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) {
        event.preventDefault();
        closeMenu(true);
      }
    });
    document.addEventListener('click', (event) => {
      if (isOpen() && !nav.contains(event.target)) closeMenu(false);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNavigation);
  } else {
    initializeNavigation();
  }
})();
