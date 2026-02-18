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
    const slides = Array.from(track.children); // 真实 slides
    const dotsWrap = root.querySelector('.wx-carousel__dots');
    if (slides.length <= 1) return;

    const AUTOPLAY_MS = 4000;   // ✅ 改这里：自动滚动间隔（毫秒）
    const TRANSITION_MS = 500;  // ✅ 动画时长（ms），要和CSS里transition一致
    
    // ---- 1) 无缝循环：复制首尾 ----
    const firstClone = slides[0].cloneNode(true);
    const lastClone  = slides[slides.length - 1].cloneNode(true);
    firstClone.setAttribute('data-clone', '1');
    lastClone.setAttribute('data-clone', '1');
    
    track.insertBefore(lastClone, slides[0]);
    track.appendChild(firstClone);
    
    const realCount = slides.length;
    let idx = 1; // 从第1张真实图开始（因为0是lastClone）
    let timer = null;
    
    // ---- 2) dots（只给真实图建点）----
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
      const realIdx = ((idx - 1) % realCount + realCount) % realCount; // 映射到0..realCount-1
      dots.forEach((d, k) => d.classList.toggle('is-active', k === realIdx));
    };
    
    const go = (nextIdx, userAction) => {
      idx = nextIdx;
      setTransition(true);
      render();
      if (userAction) restart();
    };
    
    const goToReal = (realIdx0, userAction) => {
      // realIdx0: 0..realCount-1
      go(realIdx0 + 1, userAction);
    };
    
    const next = (userAction) => go(idx + 1, userAction);
    const prev = (userAction) => go(idx - 1, userAction);
    
    // ---- 3) 关键：动画结束后做“瞬移”以实现无缝循环 ----
    track.addEventListener('transitionend', () => {
      // 如果到了“首克隆”（最后一张真实图之后的 clone）
      if (idx === realCount + 1) {
        idx = 1;                 // 回到第一张真实图
        setTransition(false);    // 关闭动画，瞬移
        render();
      }
      // 如果到了“尾克隆”（第一张真实图之前的 clone）
      if (idx === 0) {
        idx = realCount;         // 跳到最后一张真实图
        setTransition(false);
        render();
      }
    });
    
    // ---- 4) 按钮 ----
    root.querySelector('.wx-carousel__btn--prev').addEventListener('click', () => prev(true));
    root.querySelector('.wx-carousel__btn--next').addEventListener('click', () => next(true));
    
    // ---- 5) 自动播放（循环）----
    const start = () => { timer = setInterval(() => next(false), AUTOPLAY_MS); };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    const restart = () => { stop(); start(); };
    
    // 悬停暂停（可选）
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    
    // 初始化
    setTransition(false);
    render();
    start();
  });
})();
</script>

