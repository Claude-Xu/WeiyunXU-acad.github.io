const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repo = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
const markup = fs.readFileSync(path.join(repo, '_pages/includes/carousel.md'), 'utf8');
const source = markup.split('<script>')[1].split('</script>')[0];
const realCount = (markup.split('<script>')[0].match(/<figure /g) || []).length;

// This small DOM models events, attributes and timers. Assertions check public
// behavior of the real page script; CSS transition events are supplied explicitly.
class Element {
  constructor(kind = 'div') {
    this.kind = kind;
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.listeners = {};
    this.attrs = {};
    this.textContent = '';
    const classes = new Set();
    this.classList = {
      add: (...tokens) => tokens.forEach(token => classes.add(token)),
      remove: (...tokens) => tokens.forEach(token => classes.delete(token)),
      contains: token => classes.has(token),
      toggle: (token, value) => value ? classes.add(token) : classes.delete(token)
    };
  }
  addEventListener(type, handler) {
    (this.listeners[type] ||= []).push(handler);
  }
  dispatch(type, extra = {}) {
    const event = { target: this, preventDefault() {}, ...extra };
    (this.listeners[type] || []).forEach(handler => handler(event));
  }
  appendChild(child) { child.parent = this; this.children.push(child); }
  insertBefore(child, sibling) {
    child.parent = this;
    this.children.splice(this.children.indexOf(sibling), 0, child);
  }
  contains(child) {
    return !!child && (child === this || this.children.some(item => item.contains(child)));
  }
  cloneNode(deep) {
    const clone = new Element(this.kind);
    if (deep) this.children.forEach(child => clone.appendChild(child.cloneNode(true)));
    return clone;
  }
  querySelectorAll(kind) {
    return this.children.flatMap(child => [ ...(child.kind === kind ? [child] : []), ...child.querySelectorAll(kind) ]);
  }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name]; }
  matches() { return false; }
}

function createHarness(reducedMotion = false) {
  let now = 0, nextTimer = 1;
  const timers = new Map();
  const root = new Element(), track = new Element(), dots = new Element();
  const prev = new Element('button'), next = new Element('button');
  const pause = new Element('button'), status = new Element('span');
  for (let i = 0; i < realCount; i++) {
    const slide = new Element('figure');
    slide.appendChild(new Element('img'));
    track.appendChild(slide);
  }
  [track, dots, prev, next, pause, status].forEach(el => root.appendChild(el));
  root.querySelector = selector => ({
    '.wx-carousel__track': track,
    '.wx-carousel__dots': dots,
    '.wx-carousel__btn--prev': prev,
    '.wx-carousel__btn--next': next,
    '.wx-carousel__pause': pause,
    '.wx-carousel__status': status
  })[selector];
  const document = new Element();
  document.activeElement = null;
  document.hidden = false;
  document.querySelectorAll = () => [root];
  document.createElement = kind => new Element(kind);
  const preference = new Element();
  preference.matches = reducedMotion;
  const setTimeout = (handler, delay) => {
    const id = nextTimer++;
    timers.set(id, { handler, time: now + delay, delay });
    return id;
  };
  const clearTimeout = id => timers.delete(id);
  vm.runInNewContext(source, { document, window: { matchMedia: () => preference }, setTimeout, clearTimeout });
  const tick = duration => {
    const end = now + duration;
    for (;;) {
      const pending = [...timers].filter(([, timer]) => timer.time <= end).sort((a, b) => a[1].time - b[1].time)[0];
      if (!pending) break;
      const [id, timer] = pending;
      now = timer.time;
      timers.delete(id);
      timer.handler();
    }
    now = end;
  };
  const finish = () => track.dispatch('transitionend', { propertyName: 'transform' });
  const autoplayCount = () => [...timers.values()].filter(timer => timer.delay === 7000).length;
  return { root, track, dots, prev, next, pause, status, preference, document, tick, finish, autoplayCount };
}

let checks = 0;
function test(name, callback) {
  callback();
  console.log('PASS ' + name);
  checks++;
}

test('eight real slides, eight dots, hidden clones and selected dot', () => {
  const h = createHarness();
  assert.equal(realCount, 8);
  assert.equal(h.track.children.length, 10);
  assert.equal(h.dots.children.length, 8);
  assert.equal(h.track.style.transform, 'translateX(-100%)');
  assert.equal(h.dots.children.filter(dot => dot.getAttribute('aria-current') === 'true').length, 1);
  [h.track.children[0], h.track.children[9]].forEach(slide => {
    assert.equal(slide.getAttribute('aria-hidden'), 'true');
    assert.equal(slide.getAttribute('inert'), '');
  });
});

test('selecting the current dot cannot freeze subsequent navigation', () => {
  const h = createHarness();
  h.dots.children[0].dispatch('click');
  h.next.dispatch('click');
  assert.equal(h.track.style.transform, 'translateX(-200%)');
  h.finish();
  assert.equal(h.dots.children[1].getAttribute('aria-current'), 'true');
});

test('missing transitionend unlocks after the safety timeout', () => {
  const h = createHarness();
  h.next.dispatch('click');
  h.tick(600);
  h.next.dispatch('click');
  assert.equal(h.track.style.transform, 'translateX(-300%)');
});

test('transition cancellation unlocks and descendant events do not unlock', () => {
  const h = createHarness();
  h.next.dispatch('click');
  h.track.dispatch('transitionend', { target: h.track.children[1], propertyName: 'transform' });
  h.next.dispatch('click');
  assert.equal(h.track.style.transform, 'translateX(-200%)');
  h.track.dispatch('transitioncancel', { propertyName: 'transform' });
  h.next.dispatch('click');
  assert.equal(h.track.style.transform, 'translateX(-300%)');
});

test('both loop boundaries reset to original slides', () => {
  const h = createHarness();
  h.prev.dispatch('click');
  h.finish();
  assert.equal(h.track.style.transform, 'translateX(-800%)');
  h.next.dispatch('click');
  h.finish();
  assert.equal(h.track.style.transform, 'translateX(-100%)');
});

test('explicit Pause persists across hover and focus changes; Play resumes', () => {
  const h = createHarness();
  h.pause.dispatch('click');
  assert.equal(h.pause.textContent, 'Play');
  h.root.dispatch('mouseenter');
  h.root.dispatch('mouseleave');
  h.root.dispatch('focusin');
  h.root.dispatch('focusout', { relatedTarget: null });
  h.tick(8000);
  assert.equal(h.track.style.transform, 'translateX(-100%)');
  assert.equal(h.autoplayCount(), 0);
  h.pause.dispatch('click');
  h.tick(7000);
  assert.equal(h.track.style.transform, 'translateX(-200%)');
});

test('hover pauses autoplay even after manual navigation', () => {
  const h = createHarness();
  h.root.dispatch('mouseenter');
  h.next.dispatch('click');
  h.finish();
  h.tick(8000);
  assert.equal(h.track.style.transform, 'translateX(-200%)');
  assert.equal(h.autoplayCount(), 0);
  h.root.dispatch('mouseleave');
  h.tick(7000);
  assert.equal(h.track.style.transform, 'translateX(-300%)');
});

test('keyboard focus pauses until it leaves the entire carousel', () => {
  const h = createHarness();
  h.root.dispatch('focusin');
  h.root.dispatch('focusout', { relatedTarget: h.next });
  assert.equal(h.autoplayCount(), 0);
  h.tick(8000);
  assert.equal(h.track.style.transform, 'translateX(-100%)');
  h.root.dispatch('focusout', { relatedTarget: new Element() });
  assert.equal(h.autoplayCount(), 1);
});

test('arrow keys navigate and announce the user-selected slide', () => {
  const h = createHarness();
  let prevented = false;
  h.root.dispatch('keydown', { key: 'ArrowRight', target: h.next, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.track.style.transform, 'translateX(-200%)');
  assert.equal(h.status.textContent, 'Highlight 2 of 8');
});

test('reduced motion starts paused and manual steps need no transition events', () => {
  const h = createHarness(true);
  assert.equal(h.pause.textContent, 'Play');
  assert.equal(h.autoplayCount(), 0);
  h.prev.dispatch('click');
  assert.equal(h.track.style.transform, 'translateX(-800%)');
  h.next.dispatch('click');
  assert.equal(h.track.style.transform, 'translateX(-100%)');
  assert.equal(h.track.style.transition, 'none');
  h.pause.dispatch('click');
  assert.equal(h.autoplayCount(), 1);
});

test('a changed motion preference pauses active autoplay and clears animation lock', () => {
  const h = createHarness();
  h.next.dispatch('click');
  h.preference.matches = true;
  h.preference.dispatch('change');
  assert.equal(h.autoplayCount(), 0);
  h.next.dispatch('click');
  assert.equal(h.track.style.transform, 'translateX(-300%)');
});

test('background tabs pause autoplay and visible tabs reschedule once', () => {
  const h = createHarness();
  h.document.hidden = true;
  h.document.dispatch('visibilitychange');
  assert.equal(h.autoplayCount(), 0);
  h.document.hidden = false;
  h.document.dispatch('visibilitychange');
  assert.equal(h.autoplayCount(), 1);
});

console.log(`${checks} carousel behavior checks passed.`);
