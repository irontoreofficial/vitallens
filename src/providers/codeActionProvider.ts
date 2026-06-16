import * as vscode from 'vscode';
import { VitalIssue } from '../core/types';

const COMMAND_ID = 'vitallens.applyFix';

/**
 * Provides Quick Fix code actions for VitalLens diagnostics.
 * When the user clicks the lightbulb on a VitalLens diagnostic, this
 * provider returns the available WorkspaceEdit fixes.
 */
export class VitalLensCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  constructor(private issueStore: Map<string, VitalIssue[]>) {}

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'VitalLens') {
        continue;
      }

      // Find the matching VitalIssue
      const fileIssues = this.issueStore.get(document.uri.toString()) ?? [];
      const issue = fileIssues.find(
        (i) =>
          i.range.start.line === diagnostic.range.start.line &&
          i.ruleId === diagnostic.code
      );

      if (!issue?.fixes) {
        continue;
      }

      for (const fix of issue.fixes) {
        const action = new vscode.CodeAction(fix.label, vscode.CodeActionKind.QuickFix);
        action.diagnostics = [diagnostic];
        action.isPreferred = fix === issue.fixes[0]; // Mark first fix as preferred

        if (fix.edit) {
          action.edit = fix.edit;
        } else if (fix.command) {
          action.command = fix.command;
        }

        actions.push(action);
      }
    }

    return actions;
  }

  /** Update the issue store when re-analysis completes. */
  public updateIssues(uri: vscode.Uri, issues: VitalIssue[]): void {
    this.issueStore.set(uri.toString(), issues);
  }
}
