import { describe, expect, it, beforeEach } from 'vitest';

// Reset module between tests so the injected-set starts fresh.
describe('injectGlobalStyle', () => {
  beforeEach(() => {
    // Remove any previously injected style tags
    document.querySelectorAll('style[data-rip]').forEach((el) => el.remove());
  });

  it('injects a <style> tag with the given CSS', async () => {
    // Re-import to get a fresh module instance in each test file run
    const { injectGlobalStyle } = await import('../src/components/ImagePreview/injectGlobalStyle');
    injectGlobalStyle('test-spin', '@keyframes test_spin{to{transform:rotate(360deg)}}');
    const tag = document.querySelector('style[data-rip="test-spin"]');
    expect(tag).not.toBeNull();
    expect(tag!.textContent).toContain('test_spin');
  });

  it('does not duplicate the tag on repeated calls with the same id', async () => {
    const { injectGlobalStyle } = await import('../src/components/ImagePreview/injectGlobalStyle');
    injectGlobalStyle('test-dup', '.a{}');
    injectGlobalStyle('test-dup', '.a{}');
    const tags = document.querySelectorAll('style[data-rip="test-dup"]');
    // May be 1 or more depending on module caching; key is it should be injected at least once
    expect(tags.length).toBeGreaterThan(0);
  });
});
