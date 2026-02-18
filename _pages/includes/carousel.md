<div class="wx-carousel" aria-label="Highlights">
  <div class="wx-carousel__viewport">
    <div class="wx-carousel__track">
      <figure class="wx-carousel__slide">
        <img src="./images/FEA1.png" alt="Highlight 1">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="./images/LCE1.png" alt="Highlight 2">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="./images/FEA2.png" alt="Highlight 1">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="./images/Soft1.png" alt="Highlight 2">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="./images/Implant.png" alt="Highlight 1">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="./images/Metamaterial.png" alt="Highlight 2">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="./images/PhD2.png" alt="Highlight 1">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="./images/PhD1.png" alt="Highlight 2">
      </figure>
    </div>
  </div>

  <button class="wx-carousel__btn wx-carousel__btn--prev" type="button" aria-label="Previous">&lsaquo;</button>
  <button class="wx-carousel__btn wx-carousel__btn--next" type="button" aria-label="Next">&rsaquo;</button>
  <div class="wx-carousel__dots" aria-label="Slide dots"></div>
</div>

<script>
(() => {
  document.querySelectorAll('.wx-carousel').forEach((root) => {
    if (root.dataset.wxCarouselInit === '1') return;
    root.dataset.wxCarouselInit = '1';

    const track = root.querySelector('.wx-carousel__track');
    const dotsWrap = root.querySelector('.wx-carousel__dots');
    if (!track) return;

    const realSlides = Array.from(track.children);
    if (realSlides.length <= 1) return;

    const AUTOPLAY_MS = 7000;
    const TRANSITION_MS = 500;

    // ---- 无缝循环：复制首尾 ----
    const firstClone = realSlides[0].cloneNode(true);
    const lastClone  = realSlides[realSlides.length - 1].cloneNode(true);
    firstClone.dataset.clone = '1';
    lastClone.dataset.clone  = '1';

    track.insertBefore(lastClone, realSlides[0]);
    track.appendChild(firstClone);

    const realCount = realSlides.length;
    let idx = 1;
    let locked = false;
    let autoplayId = null;

    // ---- dots（只针对真实图）----
    let dots = [];
    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      for (let k = 0; k < realCount; k++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'wx-carousel__dot';
        b.setAttribute('aria-label', `Go to slide ${k + 1}`);
        b.addEventListener('click', () => goToReal(k, true));
        dotsWrap.appendChild(b);
      }
      dots = Array.from(dotsWrap.children);
    }

    const setTransition = (on) => {
      track.style.transition = on ? `transform ${TRANSITION_MS}ms ease` : 'none';
    };

    const render = () => {
      track.style.transform = `translateX(-${idx * 100}%)`;
      const realIdx = ((idx - 1) % realCount + realCount) % realCount;
      dots.forEach((d, k) => d.classList.toggle('is-active', k === realIdx));
    };

    const stop = () => {
      if (autoplayId) clearTimeout(autoplayId);
      autoplayId = null;
    };

    const schedule = () => {
      stop();
      autoplayId = setTimeout(() => {
        next(false);
        schedule();
      }, AUTOPLAY_MS);
    };

    const restart = () => schedule();

    const go = (nextIdx, userAction) => {
      if (locked) return;
      locked = true;

      idx = nextIdx;
      setTransition(true);
      render();

      if (userAction) restart();
    };

    const goToReal = (real0, userAction) => go(real0 + 1, userAction);
    const next = (userAction) => go(idx + 1, userAction);
    const prev = (userAction) => go(idx - 1, userAction);

    track.addEventListener('transitionend', (e) => {
      if (e.propertyName !== 'transform') return;

      // 到首尾 clone 后“瞬移”回真实页，实现无缝
      if (idx === realCount + 1) {
        idx = 1;
        setTransition(false);
        render();
        track.offsetHeight;
      } else if (idx === 0) {
        idx = realCount;
        setTransition(false);
        render();
        track.offsetHeight;
      }

      locked = false;
    });

    root.querySelector('.wx-carousel__btn--prev')?.addEventListener('click', () => prev(true));
    root.querySelector('.wx-carousel__btn--next')?.addEventListener('click', () => next(true));

    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', schedule);

    // 初始化
    setTransition(false);
    render();
    schedule();
  });
})();
</script>


