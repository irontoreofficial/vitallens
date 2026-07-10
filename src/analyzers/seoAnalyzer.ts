import * as vscode from 'vscode';
import { VitalIssue } from '../core/types';
import { getRulesForFile, formatSeoMessage } from '../core/seoRules';

/**
 * Analyzes multi-language source files (React, Vue, Angular, HTML, CSS, JS/TS)
 * for SEO and performance violations using the SEO rules engine.
 */
export class SeoAnalyzer {
  public async analyze(document: vscode.TextDocument): Promise<VitalIssue[]> {
    const issues: VitalIssue[] = [];
    const text = document.getText();
    const rules = getRulesForFile(document.fileName);

    for (const rule of rules) {
      // Ensure regex is global to find all occurrences
      const regex = new RegExp(rule.regex.source, rule.regex.flags.includes('g') ? rule.regex.flags : rule.regex.flags + 'g');
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        const formattedMessage = formatSeoMessage(rule);
        const fixes: VitalIssue['fixes'] = [];

        if (rule.getQuickFix) {
          const edit = rule.getQuickFix(document, match, match.index);
          if (edit) {
            fixes.push({
              label: rule.recommendation,
              edit
            });
          }
        }

        issues.push({
          ruleId: rule.id,
          title: rule.title,
          message: formattedMessage,
          severity: rule.severity,
          category: rule.category,
          fileUri: document.uri,
          range,
          fixes,
          meta: {
            badCode: rule.badCode,
            goodCode: rule.goodCode,
            why: rule.why,
            recommendation: rule.recommendation
          }
        });
      }
    }

    return issues;
  }
}
