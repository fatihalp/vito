import React, { ReactNode } from 'react';

/**
 * Strips all ANSI escape sequences and orphaned bracketed codes from text.
 */
export function stripAnsi(text: string): string {
  return text
    .replace(/(?:\u001b\[|\x1b\[)[0-9;?]*[a-zA-Z]/g, '')
    .replace(/(?:\u001b\]|\x1b\])[^\u0007\u001b]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\[(?:\d{1,3}(?:;\d{1,3})*)?m/g, '');
}

const STATUSES = ['DONE', 'FAIL', 'FAILED', 'SKIPPED', 'OK', 'SUCCESS', 'WARN', 'WARNING', 'INFO', 'RUNNING', 'PENDING', 'ERROR'];
const STATUS_REGEX = new RegExp(`^(${STATUSES.join('|')})$`, 'i');
const DURATION_REGEX = /^~?\s*\d+(?:\.\d+)?\s*(?:ms|s|m|h)$/i;
const DURATION_STATUS_REGEX = new RegExp(`^(~?\\s*\\d+(?:\\.\\d+)?\\s*(?:ms|s|m|h))\\s+(${STATUSES.join('|')})$`, 'i');

function formatTaskLine(description: string, duration: string, status: string): string {
  const trimmedDesc = description.trimEnd().replace(/\s*\.{2,}\s*$/, '').trimEnd();
  const descLen = stripAnsi(trimmedDesc).length;
  const dotCount = Math.max(3, 45 - descLen);
  const dots = '.'.repeat(dotCount);
  const upperStatus = status.trim().toUpperCase();
  const isSuccess = ['DONE', 'OK', 'SUCCESS'].includes(upperStatus);
  const isFail = ['FAIL', 'FAILED', 'ERROR'].includes(upperStatus);
  const statusColor = isSuccess ? '\u001b[32;1m' : isFail ? '\u001b[31;1m' : '\u001b[33;1m';

  let result = `${trimmedDesc} \u001b[90m${dots}\u001b[39m`;
  if (duration && duration.trim()) {
    result += ` \u001b[90m${duration.trim()}\u001b[39m`;
  }
  result += ` ${statusColor}${status.trim()}\u001b[39;22m`;
  return result;
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

  for (let i = 0; i < total; i++) {
    let line = lines[i];

    // Resolve carriage return overwrites (\r)
    if (line.includes('\r')) {
      const parts = line.split('\r').filter((p) => p.length > 0);
      if (parts.length > 1) {
        const last = parts[parts.length - 1]!;
        const lastPlain = stripAnsi(last).trim();
        if (/^\.{3,}/.test(lastPlain)) {
          const prevDesc = parts.slice(0, -1).reverse().find((p) => !stripAnsi(p).trim().startsWith('.'));
          if (prevDesc) {
            line = prevDesc.trimEnd() + ' ' + last.trimStart();
          } else {
            line = last;
          }
        } else {
          line = last;
        }
      } else {
        line = parts[0] ?? '';
      }
    }

    const plain = stripAnsi(line).trim();

    // 1. Lookahead: Check if line i is a task description and following lines contain dots/duration/status
    if (plain.length > 0 && !plain.startsWith('.') && i + 1 < total) {
      const nextPlain = stripAnsi(lines[i + 1]).trim();

      // Case 1A: next line is only dots (e.g. ".....................")
      if (nextPlain.length >= 3 && /^\.+$/.test(nextPlain)) {
        if (i + 2 < total) {
          const line2Plain = stripAnsi(lines[i + 2]).trim();

          // line2 is duration + status (e.g. "0.97ms DONE")
          const dsMatch = line2Plain.match(DURATION_STATUS_REGEX);
          if (dsMatch) {
            output.push(formatTaskLine(line, dsMatch[1], dsMatch[2]));
            i += 2;
            continue;
          }

          // line2 is duration only (e.g. "29.20ms") and line3 is status (e.g. "DONE")
          if (DURATION_REGEX.test(line2Plain) && i + 3 < total) {
            const line3Plain = stripAnsi(lines[i + 3]).trim();
            if (STATUS_REGEX.test(line3Plain)) {
              output.push(formatTaskLine(line, line2Plain, line3Plain));
              i += 3;
              continue;
            }
          }

          // line2 is status only (e.g. "DONE")
          if (STATUS_REGEX.test(line2Plain)) {
            output.push(formatTaskLine(line, '', line2Plain));
            i += 2;
            continue;
          }
        }
      }

      // Case 1B: next line has dots + duration + status (e.g. "....... 1.84ms DONE")
      const dotsDsMatch = nextPlain.match(
        new RegExp(`^(\\.{3,})\\s*(~?\\s*\\d+(?:\\.\\d+)?\\s*(?:ms|s|m|h))\\s+(${STATUSES.join('|')})$`, 'i'),
      );
      if (dotsDsMatch) {
        output.push(formatTaskLine(line, dotsDsMatch[2], dotsDsMatch[3]));
        i += 1;
        continue;
      }

      // Case 1C: next line has dots + duration and line2 has status
      const dotsDurMatch = nextPlain.match(/^(\.{3,})\s*(~?\s*\d+(?:\.\d+)?\s*(?:ms|s|m|h))$/i);
      if (dotsDurMatch && i + 2 < total) {
        const line2Plain = stripAnsi(lines[i + 2]).trim();
        if (STATUS_REGEX.test(line2Plain)) {
          output.push(formatTaskLine(line, dotsDurMatch[2], line2Plain));
          i += 2;
          continue;
        }
      }

      // Case 1D: next line has dots + status (e.g. "....... DONE")
      const dotsStatusMatch = nextPlain.match(new RegExp(`^(\\.{3,})\\s+(${STATUSES.join('|')})$`, 'i'));
      if (dotsStatusMatch) {
        output.push(formatTaskLine(line, '', dotsStatusMatch[2]));
        i += 1;
        continue;
      }
    }

    // 2. Backward-looking fallback: current line is dots, merge with previous line in output if available
    if (plain.length >= 3 && /^\.+$/.test(plain) && output.length > 0) {
      const prevLine = output[output.length - 1];
      const prevPlain = stripAnsi(prevLine).trim();
      if (prevPlain.length > 0 && !prevPlain.startsWith('.')) {
        if (i + 1 < total) {
          const nextPlain = stripAnsi(lines[i + 1]).trim();
          const dsMatch = nextPlain.match(DURATION_STATUS_REGEX);
          if (dsMatch) {
            output.pop();
            output.push(formatTaskLine(prevLine, dsMatch[1], dsMatch[2]));
            i += 1;
            continue;
          }
          if (DURATION_REGEX.test(nextPlain) && i + 2 < total) {
            const line2Plain = stripAnsi(lines[i + 2]).trim();
            if (STATUS_REGEX.test(line2Plain)) {
              output.pop();
              output.push(formatTaskLine(prevLine, nextPlain, line2Plain));
              i += 2;
              continue;
            }
          }
          if (STATUS_REGEX.test(nextPlain)) {
            output.pop();
            output.push(formatTaskLine(prevLine, '', nextPlain));
            i += 1;
            continue;
          }
        }
      }
    }

    // 3. Normalize single-line dot runs
    line = line.replace(/((?:\u001b\[90m|\[90m)?\.(?:\u001b\[39m|\[39m)?|\.){15,}/g, '\u001b[90m....................\u001b[39m');

    output.push(line);
  }

  return output.join('\n');
}

const ANSI_REGEX = /((?:\u001b\[|\[)(?:\d{1,3}(?:;\d{1,3})*)?m|(?:\u001b\]|\x1b\])[^\u0007\u001b]*(?:\u0007|\u001b\\)|(?:\u001b\[|\x1b\[)[0-9;?]*[a-zA-Z])/g;

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
