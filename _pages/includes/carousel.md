<div class="wx-carousel" role="region" aria-roledescription="carousel" aria-label="Research highlights">
  <div class="wx-carousel__viewport">
    <div class="wx-carousel__track">
      <figure class="wx-carousel__slide">
        <img src="{{ '/images/FEA1.webp' | relative_url }}" width="1280" height="961" alt="Highlight 1" decoding="async" fetchpriority="high">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="{{ '/images/LCE1.webp' | relative_url }}" width="1280" height="956" alt="Highlight 2" loading="lazy" decoding="async">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="{{ '/images/FEA2.webp' | relative_url }}" width="1280" height="959" alt="Highlight 3" loading="lazy" decoding="async">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="{{ '/images/ML.webp' | relative_url }}" width="1280" height="953" alt="Highlight 4" loading="lazy" decoding="async">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="{{ '/images/Soft1.webp' | relative_url }}" width="1280" height="961" alt="Highlight 5" loading="lazy" decoding="async">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="{{ '/images/Metamaterial2.webp' | relative_url }}" width="1280" height="960" alt="Highlight 6" loading="lazy" decoding="async">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="{{ '/images/Implant.webp' | relative_url }}" width="1280" height="959" alt="Highlight 7" loading="lazy" decoding="async">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="{{ '/images/Metamaterial.webp' | relative_url }}" width="1280" height="957" alt="Highlight 8" loading="lazy" decoding="async">
      </figure>
    </div>
  </div>
  <button class="wx-carousel__btn wx-carousel__btn--prev" type="button" aria-label="Previous highlight">&lsaquo;</button>
  <button class="wx-carousel__btn wx-carousel__btn--next" type="button" aria-label="Next highlight">&rsaquo;</button>
  <button class="wx-carousel__pause" type="button" aria-label="Pause slideshow">Pause</button>

  <div class="wx-carousel__dots" role="group" aria-label="Select a highlight"></div>
  <span class="wx-carousel__status screen-reader-text" role="status" aria-live="polite" aria-atomic="true"></span>
</div>

<script>
(() => {
  document.querySelectorAll('.wx-carousel').forEach((root) => {
    if (root.dataset.wxCarouselInit === '1') return;
    root.dataset.wxCarouselInit = '1';

    const track = root.querySelector('.wx-carousel__track');
    const dotsWrap = root.querySelector('.wx-carousel__dots');
    const pauseButton = root.querySelector('.wx-carousel__pause');
    const status = root.querySelector('.wx-carousel__status');
    if (!track) return;
    
    const realSlides = Array.from(track.children);
    if (realSlides.length <= 1) return;
    
    const AUTOPLAY_MS = 7000;
    const TRANSITION_MS = 500;
    
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

    // The two clones keep the loop seamless and remain hidden from assistive technology.
    const firstClone = realSlides[0].cloneNode(true);
    const lastClone  = realSlides[realSlides.length - 1].cloneNode(true);
    firstClone.dataset.clone = '1';
    lastClone.dataset.clone  = '1';
    [firstClone, lastClone].forEach((slide) => {
      slide.setAttribute('aria-hidden', 'true');
      slide.setAttribute('inert', '');
      slide.querySelectorAll('img').forEach((img) => {
        img.setAttribute('loading', 'lazy');
        img.setAttribute('fetchpriority', 'auto');
      });
    });
    
    track.insertBefore(lastClone, realSlides[0]);
    track.appendChild(firstClone);
    
    const realCount = realSlides.length;
    let idx = 1;
    let locked = false;
    let autoplayId = null;
    let unlockId = null;
    let userPaused = false;
    let userRequestedPlay = false;
    let hovered = false;
    let focused = root.contains(document.activeElement);

    realSlides.forEach((slide, k) => {
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', `${k + 1} of ${realCount}`);
    });
    
    // Dots address only the original slides.
    let dots = [];
    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      for (let k = 0; k < realCount; k++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'wx-carousel__dot';
        b.setAttribute('aria-label', `Go to highlight ${k + 1} of ${realCount}`);
        b.addEventListener('click', () => goToReal(k, true));
        dotsWrap.appendChild(b);
      }
      dots = Array.from(dotsWrap.children);
    }
    
    const setTransition = (on) => {
      track.style.transition = on && !motionPreference.matches ? `transform ${TRANSITION_MS}ms ease` : 'none';
    };
    
    const render = () => {
      track.style.transform = `translateX(-${idx * 100}%)`;
      const realIdx = ((idx - 1) % realCount + realCount) % realCount;
      dots.forEach((d, k) => {
        d.classList.toggle('is-active', k === realIdx);
        d.setAttribute('aria-current', k === realIdx ? 'true' : 'false');
      });
      realSlides.forEach((slide, k) => slide.setAttribute('aria-hidden', k === realIdx ? 'false' : 'true'));
    };
    
    const stop = () => {
      if (autoplayId !== null) clearTimeout(autoplayId);
      autoplayId = null;
    };
    
    const playbackEnabled = () => !userPaused && (!motionPreference.matches || userRequestedPlay);

    const schedule = () => {
      stop();
      if (pauseButton) {
        pauseButton.textContent = playbackEnabled() ? 'Pause' : 'Play';
        pauseButton.setAttribute('aria-label', playbackEnabled() ? 'Pause slideshow' : 'Play slideshow');
      }
      if (!playbackEnabled() || hovered || focused || document.hidden) return;
      autoplayId = setTimeout(() => {
        autoplayId = null;
        next(false);
        schedule();
      }, AUTOPLAY_MS);
    };
    
    const finishTransition = () => {
      if (unlockId !== null) clearTimeout(unlockId);
      unlockId = null;
      if (!locked) return;
      if (idx === realCount + 1 || idx === 0) {
        idx = idx === 0 ? realCount : 1;
        setTransition(false);
        render();
        // Flush the clone reset before accepting another animated navigation.
        void track.offsetHeight;
      }
      locked = false;
    };
    
    const go = (nextIdx, userAction) => {
      if (locked) return;
      // An unchanged transform produces no transitionend event.
      if (nextIdx === idx) {
        if (userAction) schedule();
        return;
      }
      locked = true;
    
      idx = nextIdx;
      setTransition(true);
      render();

      if (userAction && status) {
        status.textContent = `Highlight ${((idx - 1) % realCount + realCount) % realCount + 1} of ${realCount}`;
      }

      if (motionPreference.matches) {
        finishTransition();
      } else {
        // Recover when a browser cancels the animation or omits transitionend.
        unlockId = setTimeout(finishTransition, TRANSITION_MS + 100);
      }
    
      if (userAction) schedule();
    };
    
    const goToReal = (real0, userAction) => go(real0 + 1, userAction);
    const next = (userAction) => go(idx + 1, userAction);
    const prev = (userAction) => go(idx - 1, userAction);
    
    track.addEventListener('transitionend', (e) => {
      if (e.target === track && e.propertyName === 'transform') finishTransition();
    });
    track.addEventListener('transitioncancel', (e) => {
      if (e.target === track && e.propertyName === 'transform') finishTransition();
    });
    
    root.querySelector('.wx-carousel__btn--prev')?.addEventListener('click', () => prev(true));
    root.querySelector('.wx-carousel__btn--next')?.addEventListener('click', () => next(true));
    
    pauseButton?.addEventListener('click', () => {
      if (playbackEnabled()) {
        userPaused = true;
        userRequestedPlay = false;
      } else {
        userPaused = false;
        userRequestedPlay = true;
      }
      schedule();
    });

    root.addEventListener('mouseenter', () => { hovered = true; schedule(); });
    root.addEventListener('mouseleave', () => { hovered = false; schedule(); });
    root.addEventListener('focusin', () => { focused = true; schedule(); });
    root.addEventListener('focusout', (e) => { focused = root.contains(e.relatedTarget); schedule(); });
    root.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.key === 'ArrowLeft' ? prev(true) : next(true);
      }
    });
    document.addEventListener('visibilitychange', schedule);
    const motionChanged = () => {
      userRequestedPlay = false;
      if (motionPreference.matches) {
        setTransition(false);
        finishTransition();
      }
      schedule();
    };
    if (motionPreference.addEventListener) {
      motionPreference.addEventListener('change', motionChanged);
    } else {
      motionPreference.addListener(motionChanged);
    }
    
    // Initialize on the first original slide.
    setTransition(false);
    render();
    schedule();
  });
})();
</script>

