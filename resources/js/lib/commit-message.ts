export interface ParsedCommitMessage {
  title: string;
  type: string | null;
  scope: string | null;
  breaking: boolean;
  pullRequest: number | null;
  branch: string | null;
}

const GITHUB_MERGE = /^Merge pull request #(\d+) from \S+?\/(\S+)/;
const GITLAB_MERGE = /^Merge branch '([^']+)' into \S+/;
const GITLAB_MERGE_REQUEST = /^See merge request \S*!(\d+)/m;
const SQUASH_PULL_REQUEST = /\s*\(#(\d+)\)$/;
const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

function conventionalParts(title: string, branch: string | null): Pick<ParsedCommitMessage, 'title' | 'type' | 'scope' | 'breaking'> {
  const match = title.match(CONVENTIONAL);
  if (match) {
    return { type: match[1].toLowerCase(), scope: match[2] ?? null, breaking: Boolean(match[3]), title: match[4] };
  }

  if (branch && title === branch && branch.includes('/')) {
    const [type, ...rest] = branch.split('/');

    return { type: type.toLowerCase(), scope: null, breaking: false, title: rest.join(' ').replace(/[-_]+/g, ' ') };
  }

  return { type: null, scope: null, breaking: false, title };
}

export function parseCommitMessage(message: string): ParsedCommitMessage {
  const lines = message.split('\n').map((line) => line.trim()).filter(Boolean);
  const subject = lines[0] ?? '';
  const githubMerge = subject.match(GITHUB_MERGE);
  const branch = githubMerge?.[2] ?? subject.match(GITLAB_MERGE)?.[1] ?? null;
  const description = lines.slice(1).find((line) => !GITLAB_MERGE_REQUEST.test(line));

  const rawTitle = branch ? (description ?? branch) : subject;
  const squashed = rawTitle.match(SQUASH_PULL_REQUEST);
  const pullRequest = Number(githubMerge?.[1] ?? message.match(GITLAB_MERGE_REQUEST)?.[1] ?? squashed?.[1]) || null;

  return {
    ...conventionalParts(rawTitle.replace(SQUASH_PULL_REQUEST, ''), branch),
    pullRequest,
    branch,
  };
}

export function pullRequestUrl(commitUrl: string | undefined, pullRequest: number): string | undefined {
  const match = commitUrl?.match(/^(https?:\/\/.+?)\/(-\/)?commit\//);
  if (!match) return undefined;

  return match[2] ? `${match[1]}/-/merge_requests/${pullRequest}` : `${match[1]}/pull/${pullRequest}`;
}

export function safeUrl(url: string | undefined | null): string | undefined {
  return url && /^https?:\/\//.test(url) ? url : undefined;
}
