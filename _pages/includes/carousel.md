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
        <img src="./images/PhD2.png" alt="Highlight 1">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="./images/PhD1.png" alt="Highlight 2">
      </figure>
    </div>
  </div>

  <button class="wx-carousel__btn wx-carousel__btn--prev" type="button" aria-label="Previous">‹</button>
  <button class="wx-carousel__btn wx-carousel__btn--next" type="button" aria-label="Next">›</button>
  <div class="wx-carousel__dots" aria-label="Slide dots"></div>
</div>

<script>
(() => {
  document.querySelectorAll('.wx-carousel').forEach((root) => {
    const track = root.querySelector('.wx-carousel__track');
    const slides = Array.from(track.children);
    const dotsWrap = root.querySelector('.wx-carousel__dots');
    if (slides.length <= 1) return;

    const AUTOPLAY_MS = 4000;
    const TRANSITION_MS = 500;
    
    const firstClone = slides[0].cloneNode(true);
    const lastClone  = slides[slides.length - 1].cloneNode(true);
    firstClone.setAttribute('data-clone', '1');
    lastClone.setAttribute('data-clone', '1');
    
    track.insertBefore(lastClone, slides[0]);
    track.appendChild(firstClone);
    
    const realCount = slides.length;
    let idx = 1;
    let timer = null;
    
    dotsWrap.innerHTML = '';
    for (let k = 0; k < realCount; k++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wx-carousel__dot';
      b.setAttribute('aria-label', `Go to slide ${k + 1}`);
      b.addEventListener('click', () => goToReal(k, true));
      dotsWrap.appendChild(b);
    }
    const dots = Array.from(dotsWrap.children);
    
    const setTransition = (on) => {
      track.style.transition = on ? `transform ${TRANSITION_MS}ms ease` : 'none';
    };
    
    const render = () => {
      track.style.transform = `translateX(-${idx * 100}%)`;
      const realIdx = ((idx - 1) % realCount + realCount) % realCount; 
      dots.forEach((d, k) => d.classList.toggle('is-active', k === realIdx));
    };
    
    const go = (nextIdx, userAction) => {
      idx = nextIdx;
      setTransition(true);
      render();
      if (userAction) restart();
    };
    
    const goToReal = (realIdx0, userAction) => {
      go(realIdx0 + 1, userAction);
    };
    
    const next = (userAction) => go(idx + 1, userAction);
    const prev = (userAction) => go(idx - 1, userAction);
    
    track.addEventListener('transitionend', () => {
      if (idx === realCount + 1) {
        idx = 1;
        setTransition(false);
        render();
      }
      if (idx === 0) {
        idx = realCount;
        setTransition(false);
        render();
      }
    });
    
    root.querySelector('.wx-carousel__btn--prev').addEventListener('click', () => prev(true));
    root.querySelector('.wx-carousel__btn--next').addEventListener('click', () => next(true));
    
    const start = () => { timer = setInterval(() => next(false), AUTOPLAY_MS); };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    const restart = () => { stop(); start(); };
    
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    
    setTransition(false);
    render();
    start();
  });
})();
</script>

