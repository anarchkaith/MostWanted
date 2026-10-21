import assert from 'node:assert/strict';
import test from 'node:test';
import { activateDialog } from './dialogLifecycle.js';

function fixture() {
  const doc = new EventTarget();
  doc.body = { style: { overflow: 'scroll' } };
  doc.defaultView = { getComputedStyle: item => ({ visibility: item.visibility || 'visible' }) };
  function element(visible = true) {
    const item = {
      ownerDocument: doc, isConnected: true, tabIndex: 0,
      focus() { doc.activeElement = item; },
      getClientRects: () => visible ? [{}] : [],
      closest: () => null,
    };
    return item;
  }
  function dialog(children = [element(), element()]) {
    const root = element();
    root.children = children;
    root.querySelectorAll = () => children;
    root.contains = node => node === root || children.includes(node);
    return root;
  }
  const trigger = element();
  trigger.focus();
  const key = (value, shiftKey = false) => {
    const event = new Event('keydown', { cancelable: true });
    Object.assign(event, { key: value, shiftKey });
    doc.dispatchEvent(event);
    return event;
  };
  return { doc, dialog, element, trigger, key };
}

test('dialog traps both Tab directions, skips hidden controls and restores scroll and focus', () => {
  const f = fixture();
  const first = f.element();
  const last = f.element();
  const dialog = f.dialog([first, f.element(false), last]);
  const release = activateDialog({ dialog, onClose() {} });
  assert.equal(f.doc.activeElement, first);
  assert.equal(f.doc.body.style.overflow, 'hidden');
  assert.equal(f.key('Tab', true).defaultPrevented, true);
  assert.equal(f.doc.activeElement, last);
  f.key('Tab');
  assert.equal(f.doc.activeElement, first);
  f.trigger.focus();
  f.key('Tab', true);
  assert.equal(f.doc.activeElement, last);
  release();
  assert.equal(f.doc.body.style.overflow, 'scroll');
  assert.equal(f.doc.activeElement, f.trigger);
});

test('nested Escape closes only the top dialog and preserves parent lock and focus', () => {
  const f = fixture();
  const parent = f.dialog();
  let parentCloses = 0;
  let childCloses = 0;
  const releaseParent = activateDialog({ dialog: parent, onClose() { parentCloses += 1; } });
  const parentTrigger = parent.children[1];
  parentTrigger.focus();
  const child = f.dialog();
  let releaseChild;
  releaseChild = activateDialog({ dialog: child, onClose() { childCloses += 1; releaseChild(); } });
  f.key('Escape');
  assert.equal(childCloses, 1);
  assert.equal(parentCloses, 0);
  assert.equal(f.doc.body.style.overflow, 'hidden');
  assert.equal(f.doc.activeElement, parentTrigger);
  f.key('Escape');
  assert.equal(parentCloses, 1);
  releaseParent();
  assert.equal(f.doc.body.style.overflow, 'scroll');
  assert.equal(f.doc.activeElement, f.trigger);
});

test('out-of-order unmount does not unlock scroll beneath a remaining dialog', () => {
  const f = fixture();
  const parent = f.dialog();
  const releaseParent = activateDialog({ dialog: parent, onClose() {} });
  const child = f.dialog();
  const releaseChild = activateDialog({ dialog: child, onClose() {} });
  releaseParent();
  assert.equal(f.doc.body.style.overflow, 'hidden');
  assert.equal(f.doc.activeElement, child.children[0]);
  releaseChild();
  assert.equal(f.doc.body.style.overflow, 'scroll');
});

test('an empty dialog remains a valid focus target and keyboard lock', () => {
  const f = fixture();
  const dialog = f.dialog([]);
  const release = activateDialog({ dialog, onClose() {} });
  assert.equal(f.doc.activeElement, dialog);
  f.key('Tab');
  assert.equal(f.doc.activeElement, dialog);
  release();
});

test('CSS-invisible and inert controls cannot trap focus or receive initial focus', () => {
  const f = fixture();
  const hidden = f.element();
  hidden.visibility = 'hidden';
  const collapsed = f.element();
  collapsed.visibility = 'collapse';
  const inert = f.element();
  inert.closest = () => ({ inert: true });
  const visible = f.element();
  const dialog = f.dialog([hidden, collapsed, inert, visible]);
  const release = activateDialog({ dialog, initialFocus: hidden, onClose() {} });
  assert.equal(f.doc.activeElement, visible);
  f.key('Tab');
  assert.equal(f.doc.activeElement, visible);
  release();
});
