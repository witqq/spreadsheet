// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InlineEditor } from '../src/editing/inline-editor';
import { CellStore } from '../src/model/cell-store';
import { DataView } from '../src/dataview/data-view';
import { LayoutEngine } from '../src/renderer/layout-engine';
import { lightTheme } from '../src/themes/built-in-themes';
import type { InlineEditorConfig, EditorCloseReason } from '../src/editing/inline-editor';
import type { CellValue } from '../src/types/interfaces';

function createTestSetup() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const scrollContainer = document.createElement('div');
  container.appendChild(scrollContainer);

  const cellStore = new CellStore();
  cellStore.setValue(0, 0, 'Alice');
  cellStore.setValue(0, 1, 42);
  cellStore.setValue(1, 0, 'Bob');
  cellStore.setValue(1, 1, true);

  const layoutEngine = new LayoutEngine({
    columns: [
      { key: 'name', title: 'Name', width: 120 },
      { key: 'age', title: 'Age', width: 80 },
    ],
    rowCount: 10,
    rowHeight: 28,
    headerHeight: 32,
    rowNumberWidth: 50,
  });

  const scrollManager = {
    scrollX: 0,
    scrollY: 0,
    getElement: () => scrollContainer,
    scrollTo: vi.fn(),
  };

  const onCommit = vi.fn<(row: number, col: number, oldValue: CellValue, newValue: CellValue) => void>(
    (row, col, _oldValue, newValue) => {
      // Simulate the command system: onCommit is now responsible for updating the cell store
      cellStore.setValue(row, col, newValue);
    },
  );
  const onClose = vi.fn<(reason: EditorCloseReason) => void>();

  const config: InlineEditorConfig = {
    container,
    scrollContainer,
    layoutEngine,
    scrollManager: scrollManager as any,
    cellStore,
    dataView: new DataView({ totalRowCount: 10 }),
    theme: lightTheme,
    onCommit,
    onClose,
  };

  const editor = new InlineEditor(config);

  return {
    editor,
    container,
    scrollContainer,
    cellStore,
    onCommit,
    onClose,
    cleanup: () => {
      editor.destroy();
      document.body.removeChild(container);
    },
  };
}

describe('InlineEditor', () => {
  describe('opening', () => {
    it('creates textarea and appends to container', () => {
      const { editor, container, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea');
      expect(textarea).not.toBeNull();
      expect(editor.isEditing).toBe(true);

      cleanup();
    });

    it('pre-fills textarea with cell value', () => {
      const { editor, container, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Alice');

      cleanup();
    });

    it('pre-fills with number value as string', () => {
      const { editor, container, cleanup } = createTestSetup();

      editor.open(0, 1);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('42');

      cleanup();
    });

    it('pre-fills empty string for null/undefined cell', () => {
      const { editor, container, cleanup } = createTestSetup();

      editor.open(5, 0); // no data at row 5
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');

      cleanup();
    });

    it('positions textarea over cell', () => {
      const { editor, container, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      // Cell (0,0): x = rowNumberWidth(50) + colPos(0) = 50, y = headerHeight(32) + 0*28 = 32
      expect(textarea.style.left).toBe('50px');
      expect(textarea.style.top).toBe('32px');
      expect(textarea.style.width).toBe('120px'); // col 0 width
      expect(textarea.style.height).toBe('28px'); // rowHeight

      cleanup();
    });

    it('positions second column correctly', () => {
      const { editor, container, cleanup } = createTestSetup();

      editor.open(1, 1);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      // Cell (1,1): x = 50 + 120 = 170, y = 32 + 1*28 = 60
      expect(textarea.style.left).toBe('170px');
      expect(textarea.style.top).toBe('60px');
      expect(textarea.style.width).toBe('80px');

      cleanup();
    });

    it('sets isEditing to true', () => {
      const { editor, cleanup } = createTestSetup();

      expect(editor.isEditing).toBe(false);
      editor.open(0, 0);
      expect(editor.isEditing).toBe(true);

      cleanup();
    });

    it('tracks editing row and col', () => {
      const { editor, cleanup } = createTestSetup();

      editor.open(3, 1);
      expect(editor.editingRow).toBe(3);
      expect(editor.editingCol).toBe(1);

      cleanup();
    });

    it('commits previous editor before opening new one', () => {
      const { editor, container, onClose, cellStore, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'Changed';

      editor.open(1, 0); // Should commit first editor
      expect(onClose).toHaveBeenCalledWith('programmatic');
      expect(cellStore.get(0, 0)?.value).toBe('Changed');

      cleanup();
    });
  });

  describe('commit (Enter)', () => {
    it('writes changed value to cell store', () => {
      const { editor, container, cellStore, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'Charlie';

      editor.commitAndClose('enter');
      expect(cellStore.get(0, 0)?.value).toBe('Charlie');

      cleanup();
    });

    it('fires onCommit with old and new values', () => {
      const { editor, container, onCommit, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'Charlie';

      editor.commitAndClose('enter');
      expect(onCommit).toHaveBeenCalledWith(0, 0, 'Alice', 'Charlie');

      cleanup();
    });

    it('fires onClose with reason', () => {
      const { editor, container, onClose, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'Charlie';

      editor.commitAndClose('enter');
      expect(onClose).toHaveBeenCalledWith('enter');

      cleanup();
    });

    it('does not fire onCommit if value unchanged', () => {
      const { editor, onCommit, cleanup } = createTestSetup();

      editor.open(0, 0); // value is 'Alice'
      // Don't change the value

      editor.commitAndClose('enter');
      expect(onCommit).not.toHaveBeenCalled();

      cleanup();
    });

    it('sets isEditing to false after commit', () => {
      const { editor, cleanup } = createTestSetup();

      editor.open(0, 0);
      editor.commitAndClose('enter');
      expect(editor.isEditing).toBe(false);

      cleanup();
    });

    it('removes textarea from DOM after commit', () => {
      const { editor, container, cleanup } = createTestSetup();

      editor.open(0, 0);
      expect(container.querySelector('textarea')).not.toBeNull();

      editor.commitAndClose('enter');
      expect(container.querySelector('textarea')).toBeNull();

      cleanup();
    });

    it('commits empty string as null', () => {
      const { editor, container, cellStore, onCommit, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = '';

      editor.commitAndClose('enter');
      expect(cellStore.get(0, 0)?.value).toBeNull();
      expect(onCommit).toHaveBeenCalledWith(0, 0, 'Alice', null);

      cleanup();
    });
  });

  describe('cancel (Escape)', () => {
    it('closes editor without committing', () => {
      const { editor, container, cellStore, onCommit, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'ChangedButCancelled';

      editor.cancelAndClose();
      expect(cellStore.get(0, 0)?.value).toBe('Alice'); // unchanged
      expect(onCommit).not.toHaveBeenCalled();

      cleanup();
    });

    it('fires onClose with escape reason', () => {
      const { editor, onClose, cleanup } = createTestSetup();

      editor.open(0, 0);
      editor.cancelAndClose();
      expect(onClose).toHaveBeenCalledWith('escape');

      cleanup();
    });

    it('removes textarea from DOM', () => {
      const { editor, container, cleanup } = createTestSetup();

      editor.open(0, 0);
      editor.cancelAndClose();
      expect(container.querySelector('textarea')).toBeNull();

      cleanup();
    });
  });

  describe('keyboard events on textarea', () => {
    it('Enter key commits and closes', () => {
      const { editor, container, onClose, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'New';

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });
      textarea.dispatchEvent(event);

      expect(editor.isEditing).toBe(false);
      expect(onClose).toHaveBeenCalledWith('enter');

      cleanup();
    });

    it('Shift+Enter commits with shift-enter reason', () => {
      const { editor, container, onClose, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'New';

      const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });
      textarea.dispatchEvent(event);

      expect(onClose).toHaveBeenCalledWith('shift-enter');

      cleanup();
    });

    it('Escape key cancels', () => {
      const { editor, container, cellStore, onClose, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'Changed';

      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });
      textarea.dispatchEvent(event);

      expect(editor.isEditing).toBe(false);
      expect(cellStore.get(0, 0)?.value).toBe('Alice'); // unchanged
      expect(onClose).toHaveBeenCalledWith('escape');

      cleanup();
    });

    it('Tab key commits with tab reason', () => {
      const { editor, container, onClose, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'New';

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });
      textarea.dispatchEvent(event);

      expect(onClose).toHaveBeenCalledWith('tab');

      cleanup();
    });

    it('Shift+Tab commits with shift-tab reason', () => {
      const { editor, container, onClose, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'New';

      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });
      textarea.dispatchEvent(event);

      expect(onClose).toHaveBeenCalledWith('shift-tab');

      cleanup();
    });

    it('stops propagation on all keydown events', () => {
      const { editor, container, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

      const stopPropagation = vi.fn();
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      Object.defineProperty(event, 'stopPropagation', { value: stopPropagation });
      textarea.dispatchEvent(event);

      expect(stopPropagation).toHaveBeenCalled();

      cleanup();
    });
  });

  describe('scroll commits', () => {
    it('scroll event commits and closes editor', () => {
      const { editor, scrollContainer, onClose, cleanup } = createTestSetup();

      editor.open(0, 0);

      scrollContainer.dispatchEvent(new Event('scroll'));

      expect(editor.isEditing).toBe(false);
      expect(onClose).toHaveBeenCalledWith('scroll');

      cleanup();
    });
  });

  describe('value coercion', () => {
    it('coerces back to number when original was number', () => {
      const { editor, container, cellStore, cleanup } = createTestSetup();

      editor.open(0, 1); // value is 42
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = '99';

      editor.commitAndClose('enter');
      expect(cellStore.get(0, 1)?.value).toBe(99); // number, not string

      cleanup();
    });

    it('keeps string when number parse fails', () => {
      const { editor, container, cellStore, cleanup } = createTestSetup();

      editor.open(0, 1); // value is 42
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'not-a-number';

      editor.commitAndClose('enter');
      expect(cellStore.get(0, 1)?.value).toBe('not-a-number');

      cleanup();
    });

    it('coerces back to boolean when original was boolean', () => {
      const { editor, container, cellStore, cleanup } = createTestSetup();

      editor.open(1, 1); // value is true
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'false';

      editor.commitAndClose('enter');
      expect(cellStore.get(1, 1)?.value).toBe(false);

      cleanup();
    });

    it('does not create phantom commit when numeric value unchanged', () => {
      const { editor, container, onCommit, cleanup } = createTestSetup();

      editor.open(0, 1); // value is 42
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = '42'; // same value as string

      editor.commitAndClose('enter');
      expect(onCommit).not.toHaveBeenCalled();

      cleanup();
    });

    it('does not create phantom commit when boolean value unchanged', () => {
      const { editor, container, onCommit, cleanup } = createTestSetup();

      editor.open(1, 1); // value is true
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'true'; // same value as string

      editor.commitAndClose('enter');
      expect(onCommit).not.toHaveBeenCalled();

      cleanup();
    });
  });

  describe('destroy', () => {
    it('closes editor on destroy', () => {
      const { editor, onClose, cleanup } = createTestSetup();

      editor.open(0, 0);
      editor.destroy();
      expect(editor.isEditing).toBe(false);
      expect(onClose).toHaveBeenCalledWith('programmatic');

      // cleanup won't call destroy again since we already cleaned up
      document.body.removeChild(editor['config'].container);
    });

    it('does nothing if not editing', () => {
      const { editor, onClose, cleanup } = createTestSetup();

      editor.destroy(); // should not throw
      expect(onClose).not.toHaveBeenCalled();

      cleanup();
    });
  });

  describe('styling', () => {
    it('applies theme styles to textarea', () => {
      const { editor, container, cleanup } = createTestSetup();

      editor.open(0, 0);
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

      expect(textarea.style.boxSizing).toBe('border-box');
      expect(textarea.style.resize).toBe('none');
      expect(textarea.style.overflow).toBe('hidden');
      expect(textarea.style.zIndex).toBe('20');

      cleanup();
    });
  });

  describe('frozen pane positioning', () => {
    function createFrozenSetup(frozenRows: number, frozenColumns: number, scrollX = 200, scrollY = 300) {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const scrollContainer = document.createElement('div');
      container.appendChild(scrollContainer);

      const cellStore = new CellStore();
      cellStore.setValue(0, 0, 'Corner');
      cellStore.setValue(0, 2, 'FrozenRow');
      cellStore.setValue(3, 0, 'FrozenCol');
      cellStore.setValue(3, 2, 'Main');

      const layoutEngine = new LayoutEngine({
        columns: [
          { key: 'a', title: 'A', width: 100 },
          { key: 'b', title: 'B', width: 100 },
          { key: 'c', title: 'C', width: 100 },
          { key: 'd', title: 'D', width: 100 },
        ],
        rowCount: 20,
        rowHeight: 30,
        headerHeight: 32,
        rowNumberWidth: 50,
      });

      const scrollManager = {
        scrollX,
        scrollY,
        getElement: () => scrollContainer,
        scrollTo: vi.fn(),
      };

      const onCommit = vi.fn();
      const onClose = vi.fn();

      const config: InlineEditorConfig = {
        container,
        scrollContainer,
        layoutEngine,
        scrollManager: scrollManager as any,
        cellStore,
        dataView: new DataView({ totalRowCount: 20 }),
        theme: lightTheme,
        onCommit,
        onClose,
        frozenRows,
        frozenColumns,
      };

      const editor = new InlineEditor(config);
      return {
        editor,
        container,
        scrollManager,
        onCommit,
        onClose,
        cleanup: () => {
          editor.destroy();
          document.body.removeChild(container);
        },
      };
    }

    it('positions corner cell without scroll offset', () => {
      const { editor, container, cleanup } = createFrozenSetup(2, 1);
      editor.open(0, 0); // row 0, col 0 — in corner (frozen row + frozen col)

      const textarea = container.querySelector('textarea')!;
      const left = parseFloat(textarea.style.left);
      const top = parseFloat(textarea.style.top);

      // Corner cell: absolute position, no scroll offset subtracted
      // x = rowNumberWidth(50) + colX(0) - 0 = 50
      // y = headerHeight(32) + rowY(0) - 0 = 32
      expect(left).toBe(50);
      expect(top).toBe(32);
      cleanup();
    });

    it('positions frozen-row cell with scrollX offset only', () => {
      const { editor, container, cleanup } = createFrozenSetup(2, 1);
      editor.open(0, 2); // row 0, col 2 — frozen row, non-frozen col

      const textarea = container.querySelector('textarea')!;
      const left = parseFloat(textarea.style.left);
      const top = parseFloat(textarea.style.top);

      // Frozen row, non-frozen col: subtract scrollX but not scrollY
      // x = 50 + 200 - 200 = 50 (colX=200 for col 2, scrollX=200)
      // y = 32 + 0 - 0 = 32 (frozen row, no scrollY subtracted)
      expect(left).toBe(50);
      expect(top).toBe(32);
      cleanup();
    });

    it('positions frozen-col cell with scrollY offset only', () => {
      const { editor, container, cleanup } = createFrozenSetup(2, 1);
      editor.open(3, 0); // row 3, col 0 — non-frozen row, frozen col

      const textarea = container.querySelector('textarea')!;
      const left = parseFloat(textarea.style.left);
      const top = parseFloat(textarea.style.top);

      // Non-frozen row, frozen col: subtract scrollY but not scrollX
      // x = 50 + 0 - 0 = 50 (frozen col, no scrollX subtracted)
      // y = 32 + 90 - 300 = -178 (rowY(3) = 90, scrollY = 300)
      expect(left).toBe(50);
      expect(top).toBe(32 + 90 - 300);
      cleanup();
    });

    it('positions main cell with both scroll offsets', () => {
      const { editor, container, cleanup } = createFrozenSetup(2, 1, 50, 30);
      editor.open(3, 2); // row 3, col 2 — non-frozen row, non-frozen col

      const textarea = container.querySelector('textarea')!;
      const left = parseFloat(textarea.style.left);
      const top = parseFloat(textarea.style.top);

      // Main area: subtract both scrollX and scrollY
      // x = 50 + 200 - 50 = 200 (colX(2)=200, scrollX=50)
      // y = 32 + 90 - 30 = 92 (rowY(3)=90, scrollY=30)
      expect(left).toBe(200);
      expect(top).toBe(92);
      cleanup();
    });

    it('does not close on scroll when editing corner cell', () => {
      const { editor, container, onClose, cleanup } = createFrozenSetup(2, 1);
      editor.open(0, 0); // corner cell

      // Simulate scroll event
      const scrollEl = container.querySelector('div')!;
      scrollEl.dispatchEvent(new Event('scroll'));

      expect(onClose).not.toHaveBeenCalled();
      expect(editor.isEditing).toBe(true);
      cleanup();
    });

    it('closes on scroll when editing main area cell', () => {
      const { editor, onClose, cleanup } = createFrozenSetup(2, 1, 0, 0);
      editor.open(3, 2); // main area cell

      // Get the scroll container and dispatch scroll
      const scrollContainer = editor['config'].scrollContainer;
      scrollContainer.dispatchEvent(new Event('scroll'));

      expect(onClose).toHaveBeenCalledWith('scroll');
      expect(editor.isEditing).toBe(false);
      cleanup();
    });
  });
});
