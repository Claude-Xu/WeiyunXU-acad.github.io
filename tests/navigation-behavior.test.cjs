const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const repo = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(repo, 'assets/js/site.js'), 'utf8');

function createHarness() {
  const observers = [];
  let document;
  class Element {
    constructor() {
      this.attrs = {};
      this.children = [];
      this.listeners = {};
      const tokens = new Set();
      this.classList = {
        contains: token => tokens.has(token),
        add: token => tokens.add(token),
        remove: token => tokens.delete(token),
        toggle: token => tokens.has(token) ? tokens.delete(token) : tokens.add(token)
      };
    }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    dispatch(type, fields = {}) {
      const event = { target: this, preventDefault() {}, ...fields };
      (this.listeners[type] || []).forEach(fn => fn(event));
    }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name]; }
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
    removeAttribute(name) { delete this.attrs[name]; }
    contains(target) { return !!target && (this === target || this.children.some(item => item.contains(target))); }
    click() { this.dispatch('click'); }
    focus(options) { document.activeElement = this; this.focusOptions = options; }
    closest() { return this.isLink ? this : null; }
  }
  document = new Element();
  document.readyState = 'complete';
  const nav = new Element(), button = new Element(), links = new Element();
  const first = new Element(), last = new Element(), destination = new Element();
  first.isLink = last.isLink = true;
  nav.children = [button, links];
  links.children = [first, last];
  links.classList.add('hidden');
  nav.querySelector = selector => selector === 'button' ? button : links;
  links.querySelectorAll = () => links.children;
  document.getElementById = id => id === 'site-nav' ? nav : id === 'publications' ? destination : null;
  // Model the earlier click listener in the theme's existing greedy navigation.
  button.addEventListener('click', () => {
    links.classList.toggle('hidden');
    button.classList.toggle('close');
  });
  class MutationObserver {
    constructor(fn) { observers.push(fn); }
    observe() {}
  }
  vm.runInNewContext(source, { document, MutationObserver });
  const flush = () => observers.forEach(fn => fn());
  return { document, nav, button, links, first, last, destination, Element, flush };
}

let checks = 0;
function test(name, fn) { fn(); console.log('PASS '+name); checks++; }
test('theme click updates expanded state and puts focus in the open menu', () => {
  const h = createHarness();
  assert.equal(h.button.attrs['aria-expanded'], 'false');
  h.button.click();
  assert.equal(h.button.attrs['aria-expanded'], 'true');
  assert.equal(h.document.activeElement, h.first);
});
test('Escape closes the menu and restores focus to its button', () => {
  const h = createHarness();
  h.button.click();
  h.document.dispatch('keydown', { key: 'Escape' });
  assert.equal(h.button.attrs['aria-expanded'], 'false');
  assert.equal(h.document.activeElement, h.button);
  assert.equal(h.button.classList.contains('close'), false);
});
test('ArrowUp opens the menu and focuses its last link', () => {
  const h = createHarness();
  h.button.dispatch('keydown', { key: 'ArrowUp' });
  assert.equal(h.button.attrs['aria-expanded'], 'true');
  assert.equal(h.document.activeElement, h.last);
});
test('theme resize classes synchronize aria and the closed icon state', () => {
  const h = createHarness();
  h.button.click();
  h.links.classList.add('hidden');
  h.button.classList.add('hidden');
  h.flush();
  assert.equal(h.button.attrs['aria-expanded'], 'false');
  assert.equal(h.button.classList.contains('close'), false);
});
test('leaving navigation closes the dropdown without stealing focus', () => {
  const h = createHarness();
  h.button.click();
  const outside = new h.Element();
  h.document.activeElement = outside;
  h.nav.dispatch('focusout', { relatedTarget: outside });
  assert.equal(h.button.attrs['aria-expanded'], 'false');
  assert.equal(h.document.activeElement, outside);
});
test('activating a menu link closes the dropdown', () => {
  const h = createHarness();
  h.button.click();
  h.links.dispatch('click', { target: h.first });
  assert.equal(h.button.attrs['aria-expanded'], 'false');
  assert.equal(h.document.activeElement, h.button);
});
test('activating an in-page link focuses its destination without interrupting smooth scroll', () => {
  const h = createHarness();
  h.first.setAttribute('href', '#publications');
  h.button.click();
  h.links.dispatch('click', { target: h.first });
  assert.equal(h.button.attrs['aria-expanded'], 'false');
  assert.equal(h.document.activeElement, h.destination);
  assert.equal(h.destination.focusOptions.preventScroll, true);
  assert.equal(h.destination.getAttribute('tabindex'), '-1');
  h.destination.dispatch('blur');
  assert.equal(h.destination.hasAttribute('tabindex'), false);
});
console.log(`${checks} navigation behavior checks passed.`);
