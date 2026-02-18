<div class="wx-carousel" aria-label="Highlights">
  <div class="wx-carousel__viewport">
    <div class="wx-carousel__track">
      <figure class="wx-carousel__slide">
        <img src="./images/PhD1.png" alt="Highlight 1">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="./images/PhD2.png" alt="Highlight 2">
      </figure>
      <figure class="wx-carousel__slide">
        <img src="./images/EPhDD.png" alt="Highlight 3">
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
    if (!slides.length) return;

    let i = 0;
    let timer = null;

    // dots
    slides.forEach((_, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wx-carousel__dot';
      b.setAttribute('aria-label', `Go to slide ${idx + 1}`);
      b.addEventListener('click', () => go(idx, true));
      dotsWrap.appendChild(b);
    });
    const dots = Array.from(dotsWrap.children);

    const update = () => {
      track.style.transform = `translateX(-${i * 100}%)`;
      dots.forEach((d, idx) => d.classList.toggle('is-active', idx === i));
    };

    const go = (idx, userAction) => {
      i = (idx + slides.length) % slides.length;
      update();
      if (userAction) restart();
    };

    const start = () => { timer = setInterval(() => go(i + 1, false), 4000); };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    const restart = () => { stop(); start(); };

    root.querySelector('.wx-carousel__btn--prev').addEventListener('click', () => go(i - 1, true));
    root.querySelector('.wx-carousel__btn--next').addEventListener('click', () => go(i + 1, true));

    // hover pause (desktop)
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);

    update();
    start();
  });
})();
</script>
