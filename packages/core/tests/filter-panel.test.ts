// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FilterPanel } from '../src/filter/filter-panel';
import { LayoutEngine } from '../src/renderer/layout-engine';
import { lightTheme } from '../src/themes/built-in-themes';
import type { FilterPanelConfig } from '../src/filter/filter-panel';
import type { FilterOperator } from '../src/filter/filter-engine';

function createTestSetup() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const scrollContainer = document.createElement('div');
  Object.defineProperty(scrollContainer, 'scrollLeft', { value: 0, writable: true });
  Object.defineProperty(scrollContainer, 'scrollTop', { value: 0, writable: true });
  container.appendChild(scrollContainer);

  const layoutEngine = new LayoutEngine({
    columns: [
      { key: 'a', title: 'A', width: 100 },
      { key: 'b', title: 'B', width: 150 },
      { key: 'c', title: 'C', width: 120 },
    ],
    rowCount: 100,
    rowHeight: 28,
    headerHeight: 32,
    cellPadding: 6,
    rowNumberWidth: 50,
  });

  const scrollManager = {
    scrollX: 0,
    scrollY: 0,
    getElement: () => scrollContainer,
  } as any;

  const onApply = vi.fn();
  const onClear = vi.fn();

  const config: FilterPanelConfig = {
    container,
    scrollContainer,
    layoutEngine,
    scrollManager,
    theme: lightTheme,
    onApply,
    onClear,
  };

  const panel = new FilterPanel(config);

  return { container, panel, onApply, onClear };
}

describe('FilterPanel', () => {
  let setup: ReturnType<typeof createTestSetup>;

  beforeEach(() => {
    setup = createTestSetup();
  });

  afterEach(() => {
    setup.panel.destroy();
    setup.container.remove();
  });

  it('is initially closed', () => {
    expect(setup.panel.isOpen).toBe(false);
    expect(setup.panel.currentCol).toBe(-1);
  });

  it('open() creates DOM panel and sets state', () => {
    setup.panel.open(1);
    expect(setup.panel.isOpen).toBe(true);
    expect(setup.panel.currentCol).toBe(1);

    const el = setup.container.querySelector('.wit-filter-panel');
    expect(el).not.toBeNull();
  });

  it('close() removes DOM panel and resets state', () => {
    setup.panel.open(0);
    expect(setup.panel.isOpen).toBe(true);

    setup.panel.close();
    expect(setup.panel.isOpen).toBe(false);
    expect(setup.panel.currentCol).toBe(-1);

    const el = setup.container.querySelector('.wit-filter-panel');
    expect(el).toBeNull();
  });

  it('panel contains operator select, value input, and buttons', () => {
    setup.panel.open(0);

    const el = setup.container.querySelector('.wit-filter-panel')!;
    expect(el.querySelector('select.wit-filter-operator')).not.toBeNull();
    expect(el.querySelector('input.wit-filter-value')).not.toBeNull();
    expect(el.querySelector('button.wit-filter-apply')).not.toBeNull();
    expect(el.querySelector('button.wit-filter-clear')).not.toBeNull();
  });

  it('pre-fills operator and value when provided', () => {
    setup.panel.open(0, 'contains', 'hello');

    const select = setup.container.querySelector<HTMLSelectElement>('.wit-filter-operator')!;
    const input = setup.container.querySelector<HTMLInputElement>('.wit-filter-value')!;

    expect(select.value).toBe('contains');
    expect(input.value).toBe('hello');
  });

  it('Apply button calls onApply with operator and value', () => {
    setup.panel.open(2);

    const select = setup.container.querySelector<HTMLSelectElement>('.wit-filter-operator')!;
    const input = setup.container.querySelector<HTMLInputElement>('.wit-filter-value')!;
    const apply = setup.container.querySelector<HTMLButtonElement>('.wit-filter-apply')!;

    select.value = 'greaterThan';
    input.value = '42';
    apply.click();

    expect(setup.onApply).toHaveBeenCalledWith(2, 'greaterThan', '42', undefined);
    expect(setup.panel.isOpen).toBe(false);
  });

  it('Clear button calls onClear with column index', () => {
    setup.panel.open(1);

    const clear = setup.container.querySelector<HTMLButtonElement>('.wit-filter-clear')!;
    clear.click();

    expect(setup.onClear).toHaveBeenCalledWith(1);
    expect(setup.panel.isOpen).toBe(false);
  });

  it('opening a new column closes existing panel', () => {
    setup.panel.open(0);
    expect(setup.panel.currentCol).toBe(0);

    setup.panel.open(2);
    expect(setup.panel.currentCol).toBe(2);

    // Only one panel element should exist
    const panels = setup.container.querySelectorAll('.wit-filter-panel');
    expect(panels.length).toBe(1);
  });

  it('between operator shows second value input', () => {
    setup.panel.open(0, 'between');

    const valueTo = setup.container.querySelector<HTMLInputElement>('.wit-filter-value-to')!;
    expect(valueTo.style.display).toBe('block');
  });

  it('isEmpty operator hides value inputs', () => {
    setup.panel.open(0, 'isEmpty');

    const value = setup.container.querySelector<HTMLInputElement>('.wit-filter-value')!;
    const valueTo = setup.container.querySelector<HTMLInputElement>('.wit-filter-value-to')!;
    expect(value.style.display).toBe('none');
    expect(valueTo.style.display).toBe('none');
  });

  it('destroy() closes panel', () => {
    setup.panel.open(0);
    setup.panel.destroy();
    expect(setup.panel.isOpen).toBe(false);
  });

  it('panel is positioned absolutely with z-index 30', () => {
    setup.panel.open(0);

    const el = setup.container.querySelector<HTMLDivElement>('.wit-filter-panel')!;
    expect(el.style.position).toBe('absolute');
    expect(el.style.zIndex).toBe('30');
  });

  it('Enter key in value input triggers Apply', () => {
    setup.panel.open(0);

    const input = setup.container.querySelector<HTMLInputElement>('.wit-filter-value')!;
    input.value = 'test';

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    input.dispatchEvent(event);

    expect(setup.onApply).toHaveBeenCalledWith(0, 'equals', 'test', undefined);
  });

  it('Escape key in panel closes it', () => {
    setup.panel.open(0);

    const el = setup.container.querySelector<HTMLDivElement>('.wit-filter-panel')!;
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    el.dispatchEvent(event);

    expect(setup.panel.isOpen).toBe(false);
  });

  it('keydown events inside panel do not propagate', () => {
    setup.panel.open(0);

    const el = setup.container.querySelector<HTMLDivElement>('.wit-filter-panel')!;
    const spy = vi.fn();
    setup.container.addEventListener('keydown', spy);

    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
    el.dispatchEvent(event);

    expect(spy).not.toHaveBeenCalled();
    setup.container.removeEventListener('keydown', spy);
  });
});
