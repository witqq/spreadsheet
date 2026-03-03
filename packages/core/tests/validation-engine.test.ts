import { describe, it, expect, vi } from 'vitest';
import { ValidationEngine } from '../src/validation/validation-engine';
import type { SpreadsheetValidationRule } from '../src/validation/validation-engine';
import { CellStore } from '../src/model/cell-store';
import { EventBus } from '../src/events/event-bus';

function createEngine() {
  const cellStore = new CellStore();
  const eventBus = new EventBus();
  const engine = new ValidationEngine({ cellStore, eventBus });
  return { cellStore, eventBus, engine };
}

describe('ValidationEngine', () => {
  describe('required validator', () => {
    it('fails for null value', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'required' }]);

      const result = engine.validate(0, 0, null);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('This field is required');
    });

    it('fails for empty string', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'required' }]);

      const result = engine.validate(0, 0, '');
      expect(result.valid).toBe(false);
    });

    it('passes for non-empty value', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'required' }]);

      expect(engine.validate(0, 0, 'hello').valid).toBe(true);
      expect(engine.validate(0, 0, 0).valid).toBe(true);
      expect(engine.validate(0, 0, false).valid).toBe(true);
    });

    it('uses custom message', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'required', message: 'Name is required' }]);

      const result = engine.validate(0, 0, null);
      expect(result.message).toBe('Name is required');
    });
  });

  describe('range validator', () => {
    it('fails when value below min', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'range', min: 18, max: 65 }]);

      const result = engine.validate(0, 0, 10);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Value must be at least 18');
    });

    it('fails when value above max', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'range', min: 18, max: 65 }]);

      const result = engine.validate(0, 0, 70);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Value must be at most 65');
    });

    it('passes when value within range', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'range', min: 18, max: 65 }]);

      expect(engine.validate(0, 0, 18).valid).toBe(true);
      expect(engine.validate(0, 0, 40).valid).toBe(true);
      expect(engine.validate(0, 0, 65).valid).toBe(true);
    });

    it('passes for empty values (range skips empty)', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'range', min: 0, max: 100 }]);

      expect(engine.validate(0, 0, null).valid).toBe(true);
      expect(engine.validate(0, 0, '').valid).toBe(true);
    });

    it('fails for non-numeric string', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'range', min: 0, max: 100 }]);

      const result = engine.validate(0, 0, 'abc');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Value must be a number');
    });

    it('validates string that is numeric', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'range', min: 0, max: 100 }]);

      expect(engine.validate(0, 0, '50').valid).toBe(true);
      expect(engine.validate(0, 0, '150').valid).toBe(false);
    });

    it('supports min-only constraint', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'range', min: 0 }]);

      expect(engine.validate(0, 0, -1).valid).toBe(false);
      expect(engine.validate(0, 0, 0).valid).toBe(true);
      expect(engine.validate(0, 0, 999999).valid).toBe(true);
    });

    it('supports max-only constraint', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'range', max: 100 }]);

      expect(engine.validate(0, 0, -999).valid).toBe(true);
      expect(engine.validate(0, 0, 100).valid).toBe(true);
      expect(engine.validate(0, 0, 101).valid).toBe(false);
    });
  });

  describe('regex validator', () => {
    it('fails when value does not match pattern', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'regex', pattern: '^[A-Z]{3}$' }]);

      const result = engine.validate(0, 0, 'ab');
      expect(result.valid).toBe(false);
    });

    it('passes when value matches pattern', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'regex', pattern: '^[A-Z]{3}$' }]);

      expect(engine.validate(0, 0, 'ABC').valid).toBe(true);
    });

    it('supports regex flags', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'regex', pattern: '^hello$', flags: 'i' }]);

      expect(engine.validate(0, 0, 'HELLO').valid).toBe(true);
      expect(engine.validate(0, 0, 'hello').valid).toBe(true);
    });

    it('passes for empty values (regex skips empty)', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'regex', pattern: '^\\d+$' }]);

      expect(engine.validate(0, 0, null).valid).toBe(true);
      expect(engine.validate(0, 0, '').valid).toBe(true);
    });

    it('converts non-string values to string for matching', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'regex', pattern: '^\\d+$' }]);

      expect(engine.validate(0, 0, 123).valid).toBe(true);
    });
  });

  describe('custom validator', () => {
    it('calls custom validation function', () => {
      const { engine } = createEngine();
      const validate = vi.fn().mockReturnValue({ valid: true });
      engine.setColumnRules(0, [{ type: 'custom', validate }]);

      engine.validate(0, 0, 'test');
      expect(validate).toHaveBeenCalledWith('test');
    });

    it('returns custom validation result', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{
        type: 'custom',
        validate: (value) => {
          if (value === 'forbidden') {
            return { valid: false, message: 'This value is not allowed' };
          }
          return { valid: true };
        },
      }]);

      expect(engine.validate(0, 0, 'forbidden').valid).toBe(false);
      expect(engine.validate(0, 0, 'allowed').valid).toBe(true);
    });

    it('uses rule message when custom result has none', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{
        type: 'custom',
        message: 'Custom error',
        validate: () => ({ valid: false }),
      }]);

      const result = engine.validate(0, 0, 'any');
      expect(result.message).toBe('Custom error');
    });
  });

  describe('multiple rules', () => {
    it('returns first failing rule result', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [
        { type: 'required' },
        { type: 'range', min: 0, max: 100 },
      ]);

      // Fails required first
      const result = engine.validate(0, 0, null);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('This field is required');
    });

    it('checks all rules in order', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [
        { type: 'required' },
        { type: 'range', min: 18, max: 65 },
      ]);

      // Passes required, fails range
      const result = engine.validate(0, 0, 10);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Value must be at least 18');
    });

    it('passes when all rules pass', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [
        { type: 'required' },
        { type: 'range', min: 18, max: 65 },
      ]);

      expect(engine.validate(0, 0, 25).valid).toBe(true);
    });
  });

  describe('column and cell rules', () => {
    it('applies column rules to any row in the column', () => {
      const { engine } = createEngine();
      engine.setColumnRules(2, [{ type: 'required' }]);

      expect(engine.validate(0, 2, null).valid).toBe(false);
      expect(engine.validate(5, 2, null).valid).toBe(false);
      expect(engine.validate(99, 2, null).valid).toBe(false);
    });

    it('applies cell-specific rules', () => {
      const { engine } = createEngine();
      engine.setCellRules(3, 1, [{ type: 'required' }]);

      expect(engine.validate(3, 1, null).valid).toBe(false);
      // Other cells in same column not affected
      expect(engine.validate(0, 1, null).valid).toBe(true);
    });

    it('combines column and cell rules', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'range', min: 0, max: 100 }]);
      engine.setCellRules(0, 0, [{ type: 'required' }]);

      // Cell (0,0) has both required + range
      expect(engine.validate(0, 0, null).valid).toBe(false); // fails range(skips) but fails required(cell)
      // Actually: column rules run first (range passes for null), then cell rules run (required fails)
      const result = engine.validate(0, 0, null);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('This field is required');

      // Cell (1,0) has only range
      expect(engine.validate(1, 0, 150).valid).toBe(false);
      expect(engine.validate(1, 0, null).valid).toBe(true); // range skips null
    });

    it('removes column rules', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'required' }]);
      expect(engine.validate(0, 0, null).valid).toBe(false);

      engine.removeColumnRules(0);
      expect(engine.validate(0, 0, null).valid).toBe(true);
    });

    it('removes cell rules', () => {
      const { engine } = createEngine();
      engine.setCellRules(0, 0, [{ type: 'required' }]);
      expect(engine.validate(0, 0, null).valid).toBe(false);

      engine.removeCellRules(0, 0);
      expect(engine.validate(0, 0, null).valid).toBe(true);
    });

    it('hasRules returns correct result', () => {
      const { engine } = createEngine();
      expect(engine.hasRules(0, 0)).toBe(false);

      engine.setColumnRules(0, [{ type: 'required' }]);
      expect(engine.hasRules(0, 0)).toBe(true);
      expect(engine.hasRules(5, 0)).toBe(true);
      expect(engine.hasRules(0, 1)).toBe(false);
    });
  });

  describe('validateCell', () => {
    it('reads value from CellStore and validates', () => {
      const { cellStore, engine } = createEngine();
      cellStore.setValue(0, 0, 10);
      engine.setColumnRules(0, [{ type: 'range', min: 18, max: 65 }]);

      const result = engine.validateCell(0, 0);
      expect(result.valid).toBe(false);
    });

    it('sets error status on cell metadata when validation fails', () => {
      const { cellStore, engine } = createEngine();
      cellStore.setValue(0, 0, 10);
      engine.setColumnRules(0, [{ type: 'range', min: 18, max: 65 }]);

      engine.validateCell(0, 0);

      const cell = cellStore.get(0, 0);
      expect(cell?.metadata?.status).toBe('error');
      expect(cell?.metadata?.errorMessage).toBe('Value must be at least 18');
    });

    it('does not set error status when validation passes', () => {
      const { cellStore, engine } = createEngine();
      cellStore.setValue(0, 0, 25);
      engine.setColumnRules(0, [{ type: 'range', min: 18, max: 65 }]);

      engine.validateCell(0, 0);

      const cell = cellStore.get(0, 0);
      expect(cell?.metadata?.status).toBeUndefined();
    });

    it('emits cellValidation event', () => {
      const { cellStore, eventBus, engine } = createEngine();
      cellStore.setValue(0, 0, 10);
      engine.setColumnRules(0, [{ type: 'range', min: 18 }]);

      const handler = vi.fn();
      eventBus.on('cellValidation', handler);

      engine.validateCell(0, 0);

      expect(handler).toHaveBeenCalledWith({
        row: 0,
        col: 0,
        result: { valid: false, message: 'Value must be at least 18', severity: 'error' },
      });
    });

    it('emits cellStatusChange event when status changes to error', () => {
      const { cellStore, eventBus, engine } = createEngine();
      cellStore.setValue(0, 0, 10);
      engine.setColumnRules(0, [{ type: 'range', min: 18 }]);

      const handler = vi.fn();
      eventBus.on('cellStatusChange', handler);

      engine.validateCell(0, 0);

      expect(handler).toHaveBeenCalledWith({
        row: 0,
        col: 0,
        oldStatus: undefined,
        newStatus: 'error',
        errorMessage: 'Value must be at least 18',
      });
    });
  });

  describe('severity', () => {
    it('uses severity from rule', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'required', severity: 'warning' }]);

      const result = engine.validate(0, 0, null);
      expect(result.severity).toBe('warning');
    });

    it('defaults to error severity', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'required' }]);

      const result = engine.validate(0, 0, null);
      expect(result.severity).toBe('error');
    });
  });

  describe('clearAllRules', () => {
    it('removes all column and cell rules', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'required' }]);
      engine.setCellRules(1, 1, [{ type: 'range', min: 0 }]);

      engine.clearAllRules();

      expect(engine.hasRules(0, 0)).toBe(false);
      expect(engine.hasRules(1, 1)).toBe(false);
    });
  });

  describe('getColumnRules and getCellRules', () => {
    it('returns empty array when no rules set', () => {
      const { engine } = createEngine();
      expect(engine.getColumnRules(0)).toEqual([]);
      expect(engine.getCellRules(0, 0)).toEqual([]);
    });

    it('returns set rules', () => {
      const { engine } = createEngine();
      const rules: SpreadsheetValidationRule[] = [{ type: 'required' }];
      engine.setColumnRules(0, rules);
      expect(engine.getColumnRules(0)).toEqual(rules);
    });

    it('clears rules when setting empty array', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'required' }]);
      engine.setColumnRules(0, []);
      expect(engine.getColumnRules(0)).toEqual([]);
      expect(engine.hasRules(0, 0)).toBe(false);
    });
  });

  describe('hasAnyRules', () => {
    it('returns false when no rules configured', () => {
      const { engine } = createEngine();
      expect(engine.hasAnyRules()).toBe(false);
    });

    it('returns true when column rules exist', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'required' }]);
      expect(engine.hasAnyRules()).toBe(true);
    });

    it('returns true when cell rules exist', () => {
      const { engine } = createEngine();
      engine.setCellRules(0, 0, [{ type: 'required' }]);
      expect(engine.hasAnyRules()).toBe(true);
    });

    it('returns false after clearing all rules', () => {
      const { engine } = createEngine();
      engine.setColumnRules(0, [{ type: 'required' }]);
      engine.clearAllRules();
      expect(engine.hasAnyRules()).toBe(false);
    });
  });

  describe('validateAll', () => {
    it('validates all rows for columns with rules', () => {
      const { engine, cellStore } = createEngine();
      cellStore.set(0, 0, { value: 'Alice' });
      cellStore.set(1, 0, { value: '' });
      cellStore.set(2, 0, { value: 'Carol' });
      engine.setColumnRules(0, [{ type: 'required' }]);

      engine.validateAll(3);

      // Row 0: valid — no error metadata
      expect(cellStore.get(0, 0)?.metadata?.status).toBeUndefined();
      // Row 1: empty string — should be error
      expect(cellStore.get(1, 0)?.metadata?.status).toBe('error');
      // Row 2: valid
      expect(cellStore.get(2, 0)?.metadata?.status).toBeUndefined();
    });

    it('validates cell-specific rules', () => {
      const { engine, cellStore } = createEngine();
      cellStore.set(2, 3, { value: -5 });
      engine.setCellRules(2, 3, [{ type: 'range', min: 0, max: 100 }]);

      engine.validateAll(5);

      expect(cellStore.get(2, 3)?.metadata?.status).toBe('error');
    });

    it('does nothing when no rules exist', () => {
      const { engine, cellStore } = createEngine();
      cellStore.set(0, 0, { value: 'test' });

      engine.validateAll(10);

      expect(cellStore.get(0, 0)?.metadata?.status).toBeUndefined();
    });

    it('emits cellValidation events for each validated cell', () => {
      const { engine, cellStore, eventBus } = createEngine();
      const handler = vi.fn();
      eventBus.on('cellValidation', handler);

      cellStore.set(0, 0, { value: 'ok' });
      cellStore.set(1, 0, { value: '' });
      engine.setColumnRules(0, [{ type: 'required' }]);

      engine.validateAll(2);

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });
});
