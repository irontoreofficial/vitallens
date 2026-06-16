import * as vscode from 'vscode';
import { IssueCategory, IssueSeverity, VitalIssue } from '../../core/types';

interface RedirectRule {
  source: string;
  destination: string;
  lineIndex: number;
}

/**
 * Analyzes next.config.js / next.config.ts for:
 * 1. Circular redirect chains (A → B → C → A)
 * 2. Redirect to itself (A → A)
 */
export class RedirectAnalyzer {
  public async analyze(document: vscode.TextDocument): Promise<VitalIssue[]> {
    const issues: VitalIssue[] = [];
    const text = document.getText();

    const redirects = this.extractRedirects(text, document);

    if (redirects.length === 0) {
      return issues;
    }

    // Check for self-redirects
    this.detectSelfRedirects(redirects, document, issues);

    // Check for circular chains
    this.detectCircularRedirects(redirects, document, issues);

    // Check for chained redirects (A→B, B→C — not circular but still a perf issue)
    this.detectChainedRedirects(redirects, document, issues);

    return issues;
  }

  /**
   * Extract redirect source/destination pairs from next.config.js text.
   * Uses regex-based parsing (doesn't execute the file).
   */
  private extractRedirects(text: string, document: vscode.TextDocument): RedirectRule[] {
    const redirects: RedirectRule[] = [];

    // Match source: '...' and destination: '...' pairs within a redirects block
    // This handles both single and double quotes
    const sourceRegex = /source\s*:\s*['"`]([^'"`]+)['"`]/g;
    const destRegex = /destination\s*:\s*['"`]([^'"`]+)['"`]/g;

    const sources: { value: string; index: number; lineIndex: number }[] = [];
    const dests: { value: string; index: number }[] = [];

    let m: RegExpExecArray | null;

    while ((m = sourceRegex.exec(text)) !== null) {
      const pos = document.positionAt(m.index);
      sources.push({ value: m[1], index: m.index, lineIndex: pos.line });
    }

    while ((m = destRegex.exec(text)) !== null) {
      dests.push({ value: m[1], index: m.index });
    }

    // Pair sources with their nearest following destination
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const nextSrcIndex = sources[i + 1]?.index ?? Infinity;

      const dest = dests.find((d) => d.index > src.index && d.index < nextSrcIndex);
      if (dest) {
        redirects.push({
          source: src.value,
          destination: dest.value,
          lineIndex: src.lineIndex,
        });
      }
    }

    return redirects;
  }

  private detectSelfRedirects(
    redirects: RedirectRule[],
    document: vscode.TextDocument,
    issues: VitalIssue[]
  ): void {
    for (const r of redirects) {
      if (this.normalise(r.source) === this.normalise(r.destination)) {
        const range = document.lineAt(r.lineIndex).range;
        issues.push({
          ruleId: 'NX-REDIRECT-SELF',
          title: 'Self-redirect detected',
          message: `🔄 Redirect loop: "${r.source}" redirects to itself ("${r.destination}"). This causes an infinite loop for users and search engine crawlers.`,
          severity: IssueSeverity.Error,
          category: IssueCategory.Redirect,
          fileUri: document.uri,
          range,
        });
      }
    }
  }

  private detectCircularRedirects(
    redirects: RedirectRule[],
    document: vscode.TextDocument,
    issues: VitalIssue[]
  ): void {
    // Build adjacency map: source → destination
    const graph = new Map<string, { dest: string; lineIndex: number }>();
    for (const r of redirects) {
      graph.set(this.normalise(r.source), {
        dest: this.normalise(r.destination),
        lineIndex: r.lineIndex,
      });
    }

    const visited = new Set<string>();
    const inPath = new Set<string>();
    const reportedCycles = new Set<string>();

    const dfs = (node: string, pathArr: string[]): void => {
      if (inPath.has(node)) {
        // Cycle detected — find where the cycle starts
        const cycleStart = pathArr.indexOf(node);
        const cycle = pathArr.slice(cycleStart);
        const cycleKey = [...cycle].sort().join('→');

        if (!reportedCycles.has(cycleKey)) {
          reportedCycles.add(cycleKey);
          const chainText = [...cycle, node].join(' → ');

          // Report on the first node's line
          const firstNodeInGraph = redirects.find(
            (r) => this.normalise(r.source) === node
          );
          if (firstNodeInGraph) {
            const range = document.lineAt(firstNodeInGraph.lineIndex).range;
            issues.push({
              ruleId: 'NX-REDIRECT-CYCLE',
              title: 'Circular redirect chain detected!',
              message: `🔴 Circular redirect: ${chainText}. This creates an infinite redirect loop. Users will see a browser error and search engines will deindex your pages.`,
              severity: IssueSeverity.Error,
              category: IssueCategory.Redirect,
              fileUri: document.uri,
              range,
              meta: { cycle },
            });
          }
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      inPath.add(node);
      pathArr.push(node);

      const edge = graph.get(node);
      if (edge) {
        dfs(edge.dest, pathArr);
      }

      inPath.delete(node);
      pathArr.pop();
    };

    for (const [source] of graph) {
      if (!visited.has(source)) {
        dfs(source, []);
      }
    }
  }

  private detectChainedRedirects(
    redirects: RedirectRule[],
    document: vscode.TextDocument,
    issues: VitalIssue[]
  ): void {
    // A chain is when the destination of one redirect is the source of another
    // e.g. /old → /middle AND /middle → /new — user should redirect /old → /new directly
    const sourceSet = new Set(redirects.map((r) => this.normalise(r.source)));

    for (const r of redirects) {
      const normDest = this.normalise(r.destination);
      if (sourceSet.has(normDest)) {
        // Make sure it's not already caught as a circular
        const range = document.lineAt(r.lineIndex).range;
        issues.push({
          ruleId: 'NX-REDIRECT-CHAIN',
          title: 'Chained redirect (performance issue)',
          message: `⚡ "${r.source}" → "${r.destination}" is a chained redirect. "${r.destination}" is also redirected elsewhere. Users experience an extra HTTP round-trip. Redirect directly to the final destination.`,
          severity: IssueSeverity.Warning,
          category: IssueCategory.Redirect,
          fileUri: document.uri,
          range,
          meta: { source: r.source, destination: r.destination },
        });
      }
    }
  }

  /** Normalize a path for comparison — removes trailing slash, lowercases */
  private normalise(value: string): string {
    return value.toLowerCase().replace(/\/$/, '').trim();
  }
}
