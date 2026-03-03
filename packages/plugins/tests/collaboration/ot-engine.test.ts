import { describe, it, expect } from 'vitest';
import { transform, transformAgainstAll } from '../../src/collaboration/ot-engine';
import type {
  SetCellValueOp,
  InsertRowOp,
  DeleteRowOp,
} from '../../src/collaboration/ot-types';

describe('OT Transform — setCellValue × setCellValue', () => {
  it('same cell: last-writer-wins (opB wins)', () => {
    const a: SetCellValueOp = {
      type: 'setCellValue',
      row: 0,
      col: 0,
      value: 'A',
    };
    const b: SetCellValueOp = {
      type: 'setCellValue',
      row: 0,
      col: 0,
      value: 'B',
    };
    const [aPrime, bPrime] = transform(a, b);
    expect(aPrime).toBeNull();
    expect(bPrime).toEqual(
      expect.objectContaining({ type: 'setCellValue', value: 'B' }),
    );
  });

  it('different cells: no conflict', () => {
    const a: SetCellValueOp = {
      type: 'setCellValue',
      row: 0,
      col: 0,
      value: 'A',
    };
    const b: SetCellValueOp = {
      type: 'setCellValue',
      row: 1,
      col: 1,
      value: 'B',
    };
    const [aPrime, bPrime] = transform(a, b);
    expect(aPrime).toEqual(a);
    expect(bPrime).toEqual(b);
  });
});

describe('OT Transform — setCellValue × insertRow', () => {
  it('cell below insert: row shifts down', () => {
    const set: SetCellValueOp = {
      type: 'setCellValue',
      row: 5,
      col: 0,
      value: 'X',
    };
    const ins: InsertRowOp = { type: 'insertRow', row: 3, count: 2 };
    const [setPrime] = transform(set, ins);
    expect(setPrime).toEqual(expect.objectContaining({ row: 7 }));
  });

  it('cell above insert: row unchanged', () => {
    const set: SetCellValueOp = {
      type: 'setCellValue',
      row: 1,
      col: 0,
      value: 'X',
    };
    const ins: InsertRowOp = { type: 'insertRow', row: 3, count: 2 };
    const [setPrime] = transform(set, ins);
    expect(setPrime).toEqual(expect.objectContaining({ row: 1 }));
  });

  it('cell at insert position: shifts down', () => {
    const set: SetCellValueOp = {
      type: 'setCellValue',
      row: 3,
      col: 0,
      value: 'X',
    };
    const ins: InsertRowOp = { type: 'insertRow', row: 3, count: 1 };
    const [setPrime] = transform(set, ins);
    expect(setPrime).toEqual(expect.objectContaining({ row: 4 }));
  });
});

describe('OT Transform — setCellValue × deleteRow', () => {
  it('cell in deleted range: becomes no-op', () => {
    const set: SetCellValueOp = {
      type: 'setCellValue',
      row: 3,
      col: 0,
      value: 'X',
    };
    const del: DeleteRowOp = { type: 'deleteRow', row: 2, count: 3 };
    const [setPrime] = transform(set, del);
    expect(setPrime).toBeNull();
  });

  it('cell below delete range: shifts up', () => {
    const set: SetCellValueOp = {
      type: 'setCellValue',
      row: 7,
      col: 0,
      value: 'X',
    };
    const del: DeleteRowOp = { type: 'deleteRow', row: 2, count: 3 };
    const [setPrime] = transform(set, del);
    expect(setPrime).toEqual(expect.objectContaining({ row: 4 }));
  });

  it('cell above delete range: unchanged', () => {
    const set: SetCellValueOp = {
      type: 'setCellValue',
      row: 0,
      col: 0,
      value: 'X',
    };
    const del: DeleteRowOp = { type: 'deleteRow', row: 2, count: 3 };
    const [setPrime] = transform(set, del);
    expect(setPrime).toEqual(expect.objectContaining({ row: 0 }));
  });
});

describe('OT Transform — insertRow × setCellValue (symmetric)', () => {
  it('insert before cell: cell shifts down', () => {
    const ins: InsertRowOp = { type: 'insertRow', row: 2, count: 1 };
    const set: SetCellValueOp = {
      type: 'setCellValue',
      row: 5,
      col: 0,
      value: 'X',
    };
    const [insPrime, setPrime] = transform(ins, set);
    expect(insPrime).toEqual(ins);
    expect(setPrime).toEqual(expect.objectContaining({ row: 6 }));
  });
});

describe('OT Transform — insertRow × insertRow', () => {
  it('A before B: B shifts', () => {
    const a: InsertRowOp = { type: 'insertRow', row: 2, count: 1 };
    const b: InsertRowOp = { type: 'insertRow', row: 5, count: 1 };
    const [aPrime, bPrime] = transform(a, b);
    expect(aPrime).toEqual(expect.objectContaining({ row: 2 }));
    expect(bPrime).toEqual(expect.objectContaining({ row: 6 }));
  });

  it('B before A: A shifts', () => {
    const a: InsertRowOp = { type: 'insertRow', row: 5, count: 1 };
    const b: InsertRowOp = { type: 'insertRow', row: 2, count: 1 };
    const [aPrime, bPrime] = transform(a, b);
    expect(aPrime).toEqual(expect.objectContaining({ row: 6 }));
    expect(bPrime).toEqual(expect.objectContaining({ row: 2 }));
  });

  it('same position: A wins (inserts first)', () => {
    const a: InsertRowOp = { type: 'insertRow', row: 3, count: 1 };
    const b: InsertRowOp = { type: 'insertRow', row: 3, count: 1 };
    const [aPrime, bPrime] = transform(a, b);
    expect(aPrime).toEqual(expect.objectContaining({ row: 3 }));
    expect(bPrime).toEqual(expect.objectContaining({ row: 4 }));
  });
});

describe('OT Transform — insertRow × deleteRow', () => {
  it('insert before delete: delete shifts down', () => {
    const ins: InsertRowOp = { type: 'insertRow', row: 1, count: 2 };
    const del: DeleteRowOp = { type: 'deleteRow', row: 5, count: 1 };
    const [insPrime, delPrime] = transform(ins, del);
    expect(insPrime).toEqual(expect.objectContaining({ row: 1 }));
    expect(delPrime).toEqual(expect.objectContaining({ row: 7 }));
  });

  it('insert after delete: insert shifts up', () => {
    const ins: InsertRowOp = { type: 'insertRow', row: 8, count: 1 };
    const del: DeleteRowOp = { type: 'deleteRow', row: 2, count: 3 };
    const [insPrime] = transform(ins, del);
    expect(insPrime).toEqual(expect.objectContaining({ row: 5 }));
  });

  it('insert inside delete range: insert at delete start', () => {
    const ins: InsertRowOp = { type: 'insertRow', row: 4, count: 1 };
    const del: DeleteRowOp = { type: 'deleteRow', row: 3, count: 5 };
    const [insPrime] = transform(ins, del);
    expect(insPrime).toEqual(expect.objectContaining({ row: 3 }));
  });
});

describe('OT Transform — deleteRow × setCellValue (symmetric)', () => {
  it('delete containing cell: cell becomes no-op', () => {
    const del: DeleteRowOp = { type: 'deleteRow', row: 2, count: 3 };
    const set: SetCellValueOp = {
      type: 'setCellValue',
      row: 3,
      col: 0,
      value: 'X',
    };
    const [delPrime, setPrime] = transform(del, set);
    expect(delPrime).toEqual(del);
    expect(setPrime).toBeNull();
  });
});

describe('OT Transform — deleteRow × insertRow (symmetric)', () => {
  it('delete before insert: insert shifts up', () => {
    const del: DeleteRowOp = { type: 'deleteRow', row: 1, count: 2 };
    const ins: InsertRowOp = { type: 'insertRow', row: 5, count: 1 };
    const [delPrime, insPrime] = transform(del, ins);
    expect(delPrime).toEqual(expect.objectContaining({ row: 1 }));
    expect(insPrime).toEqual(expect.objectContaining({ row: 3 }));
  });
});

describe('OT Transform — deleteRow × deleteRow', () => {
  it('no overlap: A before B, B shifts up', () => {
    const a: DeleteRowOp = { type: 'deleteRow', row: 0, count: 2 };
    const b: DeleteRowOp = { type: 'deleteRow', row: 5, count: 2 };
    const [aPrime, bPrime] = transform(a, b);
    expect(aPrime).toEqual(expect.objectContaining({ row: 0, count: 2 }));
    expect(bPrime).toEqual(expect.objectContaining({ row: 3, count: 2 }));
  });

  it('no overlap: B before A, A shifts up', () => {
    const a: DeleteRowOp = { type: 'deleteRow', row: 5, count: 2 };
    const b: DeleteRowOp = { type: 'deleteRow', row: 0, count: 2 };
    const [aPrime, bPrime] = transform(a, b);
    expect(aPrime).toEqual(expect.objectContaining({ row: 3, count: 2 }));
    expect(bPrime).toEqual(expect.objectContaining({ row: 0, count: 2 }));
  });

  it('full overlap: both become no-op', () => {
    const a: DeleteRowOp = { type: 'deleteRow', row: 2, count: 3 };
    const b: DeleteRowOp = { type: 'deleteRow', row: 2, count: 3 };
    const [aPrime, bPrime] = transform(a, b);
    expect(aPrime).toBeNull();
    expect(bPrime).toBeNull();
  });

  it('partial overlap: A extends past B', () => {
    const a: DeleteRowOp = { type: 'deleteRow', row: 2, count: 5 };
    const b: DeleteRowOp = { type: 'deleteRow', row: 4, count: 2 };
    const [aPrime, bPrime] = transform(a, b);
    // A deleted rows 2-6, B deleted rows 4-5 (overlap=2), A remaining=3
    expect(aPrime).not.toBeNull();
    expect(aPrime!.type).toBe('deleteRow');
    expect((aPrime as DeleteRowOp).count).toBe(3);
    expect(bPrime).toBeNull();
  });
});

describe('transformAgainstAll', () => {
  it('transforms local op against multiple server ops', () => {
    const local: SetCellValueOp = {
      type: 'setCellValue',
      row: 5,
      col: 0,
      value: 'X',
    };
    const serverOps = [
      { type: 'insertRow' as const, row: 2, count: 1 },
      { type: 'insertRow' as const, row: 0, count: 1 },
    ];
    const result = transformAgainstAll(local, serverOps);
    expect(result).toEqual(expect.objectContaining({ row: 7 }));
  });

  it('returns null when local op is cancelled', () => {
    const local: SetCellValueOp = {
      type: 'setCellValue',
      row: 3,
      col: 0,
      value: 'X',
    };
    const serverOps = [
      { type: 'deleteRow' as const, row: 2, count: 3 },
    ];
    const result = transformAgainstAll(local, serverOps);
    expect(result).toBeNull();
  });

  it('returns original op with empty server ops array', () => {
    const local: SetCellValueOp = {
      type: 'setCellValue',
      row: 3,
      col: 0,
      value: 'X',
    };
    const result = transformAgainstAll(local, []);
    expect(result).toEqual(local);
  });
});

describe('OT Transform — unknown type pair (default case)', () => {
  it('returns both ops unchanged for unknown operation types', () => {
    const a = { type: 'unknownType', data: 123 } as any;
    const b: SetCellValueOp = {
      type: 'setCellValue',
      row: 0,
      col: 0,
      value: 'X',
    };
    const [aPrime, bPrime] = transform(a, b);
    expect(aPrime).toEqual(a);
    expect(bPrime).toEqual(b);
  });
});
