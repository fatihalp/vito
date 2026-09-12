import React, { ReactNode } from 'react';

/**
 * Strips all ANSI escape sequences and orphaned bracketed codes from text.
 */
export function stripAnsi(text: string): string {
  return text
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\[(?:\d{1,3}(?:;\d{1,3})*)?m/g, '');
}

/**
 * Normalizes noisy terminal output: merges multi-line package tasks,
 * collapses excessive dot patterns, and handles carriage return overwrites.
 */
export function cleanLogContent(raw: string): string {
  if (!raw) return '';

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];
  const total = lines.length;
  const statusList = ['DONE', 'FAIL', 'FAILED', 'SKIPPED', 'OK', 'SUCCESS'];

  for (let i = 0; i < total; i++) {
    let line = lines[i];

    // Resolve carriage return overwrites (\r)
    if (line.includes('\r')) {
      const parts = line.split('\r');
      line = parts[parts.length - 1] ?? '';
    }

    const plain = stripAnsi(line).trim();

    // Case 1: Check if line consists entirely of dots (e.g. ....) and next line is status
    if (plain.length >= 3 && /^\.+$/.test(plain)) {
      const nextLine = i + 1 < total ? stripAnsi(lines[i + 1]).trim().toUpperCase() : '';
      if (statusList.includes(nextLine)) {
        if (output.length > 0) {
          const prev = output.pop()!;
          const prevPlain = stripAnsi(prev).trim();
          const dotCount = Math.max(3, 40 - prevPlain.length);
          const dots = '.'.repeat(dotCount);
          const status = stripAnsi(lines[i + 1]).trim();
          const statusColor = ['DONE', 'OK', 'SUCCESS'].includes(nextLine) ? '\u001b[32;1m' : '\u001b[31;1m';
          output.push(`${prev.trimEnd()} \u001b[90m${dots}\u001b[39m ${statusColor}${status}\u001b[39;22m`);
          i++; // skip nextLine
          continue;
        }
      }
    }

    // Case 2: Check if line starts with dots and ends with status (e.g. ".................... DONE")
    const match = plain.match(/^(\.{3,})\s*(DONE|FAIL|FAILED|SKIPPED|OK|SUCCESS)$/i);
    if (match && output.length > 0) {
      const prev = output.pop()!;
      const prevPlain = stripAnsi(prev).trim();
      const dotCount = Math.max(3, 40 - prevPlain.length);
      const dots = '.'.repeat(dotCount);
      const statusWord = match[2].toUpperCase();
      const statusColor = ['DONE', 'OK', 'SUCCESS'].includes(statusWord) ? '\u001b[32;1m' : '\u001b[31;1m';
      output.push(`${prev.trimEnd()} \u001b[90m${dots}\u001b[39m ${statusColor}${statusWord}\u001b[39;22m`);
      continue;
    }

    // Collapse excessive dot runs within a line
    line = line.replace(/((?:\u001b\[90m|\[90m)?\.(?:\u001b\[39m|\[39m)?|\.){15,}/g, '\u001b[90m....................\u001b[39m');

    output.push(line);
  }

  return output.join('\n');
}

const ANSI_REGEX = /((?:\u001b\[|\[)(?:\d{1,3}(?:;\d{1,3})*)?m|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\))/g;

/**
 * Parses ANSI-formatted string into styled React elements.
 * Correctly interprets both standard ESC-bracket codes (\u001b[32m) and bare bracket codes ([32m).
 */
export function parseAnsi(text: string): ReactNode[] {
  if (!text) return [];

  const cleaned = cleanLogContent(text);
  const parts = cleaned.split(ANSI_REGEX);
  const elements: ReactNode[] = [];

  let isBold = false;
  let isDim = false;
  let isItalic = false;
  let isUnderline = false;
  let fgColor: string | null = null;
  let bgColor: string | null = null;

  let keyIndex = 0;

  for (const part of parts) {
    if (!part) continue;

    // Check if it is an SGR sequence (\u001b[...m or [...m)
    const sgrMatch = part.match(/^(?:\u001b\[|\[)((?:\d{1,3}(?:;\d{1,3})*)?)m$/);
    if (sgrMatch) {
      const codeStr = sgrMatch[1];
      const codes = codeStr === '' ? [0] : codeStr.split(';').map(Number);

      for (const code of codes) {
        if (code === 0) {
          isBold = false;
          isDim = false;
          isItalic = false;
          isUnderline = false;
          fgColor = null;
          bgColor = null;
        } else if (code === 1) {
          isBold = true;
        } else if (code === 2) {
          isDim = true;
        } else if (code === 3) {
          isItalic = true;
        } else if (code === 4) {
          isUnderline = true;
        } else if (code === 22) {
          isBold = false;
          isDim = false;
        } else if (code === 23) {
          isItalic = false;
        } else if (code === 24) {
          isUnderline = false;
        } else if (code === 30) {
          fgColor = 'text-black dark:text-zinc-900';
        } else if (code === 31 || code === 91) {
          fgColor = 'text-red-500 font-bold';
        } else if (code === 32 || code === 92) {
          fgColor = 'text-emerald-500 font-bold';
        } else if (code === 33 || code === 93) {
          fgColor = 'text-amber-500 font-medium';
        } else if (code === 34 || code === 94) {
          fgColor = 'text-sky-500 font-medium';
        } else if (code === 35 || code === 95) {
          fgColor = 'text-purple-500 font-medium';
        } else if (code === 36 || code === 96) {
          fgColor = 'text-cyan-500 font-medium';
        } else if (code === 37 || code === 97) {
          fgColor = 'text-white';
        } else if (code === 39) {
          fgColor = null;
        } else if (code === 90) {
          fgColor = 'text-muted-foreground/60';
        } else if (code === 40) {
          bgColor = 'bg-black text-white px-1.5 py-0.5 rounded';
        } else if (code === 41) {
          bgColor = 'bg-red-600 text-white font-bold px-1.5 py-0.5 rounded';
        } else if (code === 42) {
          bgColor = 'bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded';
        } else if (code === 43) {
          bgColor = 'bg-amber-500 text-black font-bold px-1.5 py-0.5 rounded';
        } else if (code === 44) {
          bgColor = 'bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded text-xs';
        } else if (code === 45) {
          bgColor = 'bg-purple-600 text-white font-bold px-1.5 py-0.5 rounded';
        } else if (code === 46) {
          bgColor = 'bg-cyan-600 text-white font-bold px-1.5 py-0.5 rounded';
        } else if (code === 47) {
          bgColor = 'bg-zinc-200 text-black px-1.5 py-0.5 rounded';
        } else if (code === 49) {
          bgColor = null;
        }
      }
      continue;
    }

    // Ignore other ANSI escape sequences or orphaned brackets
    if (part.startsWith('\u001b') || /^\[\d+(?:;\d+)*m$/.test(part)) {
      continue;
    }

    const classes: string[] = [];
    if (isBold) classes.push('font-bold');
    if (isDim) classes.push('opacity-70');
    if (isItalic) classes.push('italic');
    if (isUnderline) classes.push('underline');
    if (fgColor) classes.push(fgColor);
    if (bgColor) classes.push(bgColor);

    if (classes.length > 0) {
      elements.push(
        <span key={keyIndex++} className={classes.join(' ')}>
          {part}
        </span>
      );
    } else {
      elements.push(part);
    }
  }

  return elements;
}
