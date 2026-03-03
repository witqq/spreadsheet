// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  serializeToTSV,
  serializeToHTML,
  parseTSV,
  parseHTML,
} from '../src/clipboard/clipboard-serializer';

describe('serializeToTSV', () => {
  it('serializes single cell', () => {
    expect(serializeToTSV([['hello']])).toBe('hello');
  });

  it('serializes multiple columns with tabs', () => {
    expect(serializeToTSV([['a', 'b', 'c']])).toBe('a\tb\tc');
  });

  it('serializes multiple rows with newlines', () => {
    expect(serializeToTSV([['a'], ['b']])).toBe('a\nb');
  });

  it('serializes 2x3 grid', () => {
    expect(serializeToTSV([
      ['Alice', 30, true],
      ['Bob', 25, false],
    ])).toBe('Alice\t30\ttrue\nBob\t25\tfalse');
  });

  it('serializes null as empty string', () => {
    expect(serializeToTSV([[null, 'x', null]])).toBe('\tx\t');
  });

  it('serializes numbers and booleans as strings', () => {
    expect(serializeToTSV([[42, true, false, 0]])).toBe('42\ttrue\tfalse\t0');
  });
});

describe('serializeToHTML', () => {
  it('creates valid HTML table for single cell', () => {
    const html = serializeToHTML([['hello']]);
    expect(html).toBe('<table><tr><td>hello</td></tr></table>');
  });

  it('creates table with multiple rows and columns', () => {
    const html = serializeToHTML([['a', 'b'], ['c', 'd']]);
    expect(html).toBe(
      '<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>',
    );
  });

  it('escapes HTML special characters', () => {
    const html = serializeToHTML([['<script>alert("xss")</script>']]);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;xss&quot;');
    expect(html).not.toContain('<script>');
  });

  it('handles null values as empty cells', () => {
    const html = serializeToHTML([[null, 'x']]);
    expect(html).toBe('<table><tr><td></td><td>x</td></tr></table>');
  });
});

describe('parseTSV', () => {
  it('parses single cell', () => {
    expect(parseTSV('hello')).toEqual([['hello']]);
  });

  it('parses tab-separated columns', () => {
    expect(parseTSV('a\tb\tc')).toEqual([['a', 'b', 'c']]);
  });

  it('parses newline-separated rows', () => {
    expect(parseTSV('a\nb')).toEqual([['a'], ['b']]);
  });

  it('parses 2x3 grid', () => {
    expect(parseTSV('Alice\t30\ttrue\nBob\t25\tfalse')).toEqual([
      ['Alice', 30, true],
      ['Bob', 25, false],
    ]);
  });

  it('coerces numbers', () => {
    expect(parseTSV('42\t3.14\t-7')).toEqual([[42, 3.14, -7]]);
  });

  it('coerces booleans', () => {
    expect(parseTSV('true\tfalse\tTRUE\tFALSE')).toEqual([[true, false, true, false]]);
  });

  it('treats empty cells as null', () => {
    expect(parseTSV('\tx\t')).toEqual([[null, 'x', null]]);
  });

  it('handles \\r\\n line endings', () => {
    expect(parseTSV('a\r\nb')).toEqual([['a'], ['b']]);
  });

  it('strips trailing empty line', () => {
    expect(parseTSV('a\tb\n')).toEqual([['a', 'b']]);
  });

  it('returns empty array for empty string', () => {
    expect(parseTSV('')).toEqual([]);
  });
});

describe('parseHTML', () => {
  it('parses simple HTML table', () => {
    const html = '<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>';
    expect(parseHTML(html)).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('parses table with th headers', () => {
    const html = '<table><tr><th>Name</th><th>Age</th></tr><tr><td>Alice</td><td>30</td></tr></table>';
    expect(parseHTML(html)).toEqual([['Name', 'Age'], ['Alice', 30]]);
  });

  it('coerces numeric values', () => {
    const html = '<table><tr><td>42</td><td>3.14</td></tr></table>';
    expect(parseHTML(html)).toEqual([[42, 3.14]]);
  });

  it('coerces boolean values', () => {
    const html = '<table><tr><td>true</td><td>false</td></tr></table>';
    expect(parseHTML(html)).toEqual([[true, false]]);
  });

  it('returns null when no table found', () => {
    expect(parseHTML('<div>no table</div>')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseHTML('')).toBeNull();
  });

  it('handles Excel-style HTML with meta tags', () => {
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office">
      <head><meta charset="utf-8"></head>
      <body>
        <table border="0" cellpadding="0" cellspacing="0">
          <tr><td>Revenue</td><td>1000</td></tr>
          <tr><td>Cost</td><td>500</td></tr>
        </table>
      </body></html>
    `;
    expect(parseHTML(html)).toEqual([
      ['Revenue', 1000],
      ['Cost', 500],
    ]);
  });

  it('trims whitespace from cell content', () => {
    const html = '<table><tr><td>  hello  </td><td> 42 </td></tr></table>';
    expect(parseHTML(html)).toEqual([['hello', 42]]);
  });

  it('handles empty cells as null', () => {
    const html = '<table><tr><td></td><td>x</td><td></td></tr></table>';
    expect(parseHTML(html)).toEqual([[null, 'x', null]]);
  });
});

describe('TSV round-trip', () => {
  it('preserves data through serialize → parse cycle', () => {
    const original = [
      ['Alice', 30, true],
      ['Bob', 25, false],
      [null, 0, 'text'],
    ];
    const tsv = serializeToTSV(original);
    const parsed = parseTSV(tsv);
    expect(parsed).toEqual(original);
  });

  it('preserves single empty string as null', () => {
    const tsv = serializeToTSV([[null]]);
    expect(tsv).toBe('');
    // Empty string parses to empty array (no rows), not [[null]]
    // This is expected: empty clipboard = no data
    expect(parseTSV(tsv)).toEqual([]);
  });
});
