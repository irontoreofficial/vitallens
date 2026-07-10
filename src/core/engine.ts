import * as vscode from 'vscode';
import {
  AnalysisResult,
  CategoryScores,
  IssueCategory,
  IssueSeverity,
  VitalIssue,
} from './types';
import { ImageAnalyzer } from '../analyzers/nextjs/imageAnalyzer';
import { BundleAnalyzer } from '../analyzers/nextjs/bundleAnalyzer';
import { RedirectAnalyzer } from '../analyzers/nextjs/redirectAnalyzer';
import { SeoAnalyzer } from '../analyzers/seoAnalyzer';

/**
 * Central analysis engine — orchestrates all analyzers and aggregates results.
 */
export class VitalLensEngine {
  private imageAnalyzer: ImageAnalyzer;
  private bundleAnalyzer: BundleAnalyzer;
  private redirectAnalyzer: RedirectAnalyzer;
  private seoAnalyzer: SeoAnalyzer;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.imageAnalyzer = new ImageAnalyzer(context);
    this.bundleAnalyzer = new BundleAnalyzer(context);
    this.redirectAnalyzer = new RedirectAnalyzer();
    this.seoAnalyzer = new SeoAnalyzer();
  }

  /**
   * Run full analysis on the given document.
   * Returns all issues found across all analyzers relevant to that document.
   */
  public async analyzeDocument(document: vscode.TextDocument): Promise<VitalIssue[]> {
    const issues: VitalIssue[] = [];
    const fileName = document.fileName.toLowerCase();

    // Route to the correct analyzers based on file type
    if (this.isPackageJson(fileName)) {
      const bundleIssues = await this.bundleAnalyzer.analyze(document);
      issues.push(...bundleIssues);
    }

    if (this.isNextConfig(fileName)) {
      const redirectIssues = await this.redirectAnalyzer.analyze(document);
      issues.push(...redirectIssues);
    }

    if (this.isJsxOrTemplate(fileName)) {
      const imageIssues = await this.imageAnalyzer.analyze(document);
      issues.push(...imageIssues);
    }

    // Run the multi-language SEO rule checks
    if (this.isSeoSupportedFile(fileName)) {
      const seoIssues = await this.seoAnalyzer.analyze(document);
      issues.push(...seoIssues);
    }

    return issues;
  }

  /**
   * Run analysis across all open/relevant files in the workspace and
   * build a consolidated AnalysisResult for the sidebar panel.
   */
  public async analyzeWorkspace(): Promise<AnalysisResult> {
    const allIssues: VitalIssue[] = [];

    // Analyse all open text documents
    for (const doc of vscode.workspace.textDocuments) {
      if (!doc.uri.scheme.startsWith('file')) {
        continue;
      }
      const issues = await this.analyzeDocument(doc);
      allIssues.push(...issues);
    }

    // Also try to find and analyze key files even if not open
    await this.analyzeKeyFiles(allIssues);

    const score = this.computeScore(allIssues);
    const categoryScores = this.computeCategoryScores(allIssues);

    return {
      issues: allIssues,
      analyzedAt: new Date(),
      isNextJs: await this.isNextJsProject(),
      score,
      categoryScores,
    };
  }

  private async analyzeKeyFiles(issues: VitalIssue[]): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    for (const folder of workspaceFolders) {
      // Try package.json
      const pkgUri = vscode.Uri.joinPath(folder.uri, 'package.json');
      await this.tryAnalyzeUri(pkgUri, issues);

      // Try next.config.js variants
      for (const cfg of ['next.config.js', 'next.config.ts', 'next.config.mjs']) {
        const cfgUri = vscode.Uri.joinPath(folder.uri, cfg);
        await this.tryAnalyzeUri(cfgUri, issues);
      }
    }
  }

  private async tryAnalyzeUri(uri: vscode.Uri, issues: VitalIssue[]): Promise<void> {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const fileIssues = await this.analyzeDocument(doc);
      // Only add if not already analysed (avoid duplicates from open docs)
      for (const issue of fileIssues) {
        const duplicate = issues.some(
          (i) => i.ruleId === issue.ruleId && i.fileUri.toString() === issue.fileUri.toString() && i.range.start.line === issue.range.start.line
        );
        if (!duplicate) {
          issues.push(issue);
        }
      }
    } catch {
      // File doesn't exist — silently skip
    }
  }

  /** Compute an overall 0-100 score. Penalties per severity. */
  private computeScore(issues: VitalIssue[]): number {
    let penalty = 0;
    for (const issue of issues) {
      switch (issue.severity) {
        case IssueSeverity.Error:
          penalty += 15;
          break;
        case IssueSeverity.Warning:
          penalty += 7;
          break;
        case IssueSeverity.Info:
          penalty += 2;
          break;
      }
    }
    return Math.max(0, 100 - penalty);
  }

  private computeCategoryScores(issues: VitalIssue[]): CategoryScores {
    const categories: IssueCategory[] = [
      IssueCategory.Image,
      IssueCategory.Bundle,
      IssueCategory.Redirect,
      IssueCategory.SEO,
    ];

    const scores: CategoryScores = { image: 100, bundle: 100, redirect: 100, seo: 100 };

    for (const cat of categories) {
      const catIssues = issues.filter((i) => i.category === cat);
      let penalty = 0;
      for (const issue of catIssues) {
        switch (issue.severity) {
          case IssueSeverity.Error:
            penalty += 25;
            break;
          case IssueSeverity.Warning:
            penalty += 12;
            break;
          case IssueSeverity.Info:
            penalty += 4;
            break;
        }
      }
      scores[cat as keyof CategoryScores] = Math.max(0, 100 - penalty);
    }

    return scores;
  }

  private async isNextJsProject(): Promise<boolean> {
    const files = await vscode.workspace.findFiles('next.config.{js,ts,mjs}', '**/node_modules/**', 1);
    return files.length > 0;
  }

  private isPackageJson(fileName: string): boolean {
    return fileName.endsWith('package.json') && !fileName.includes('node_modules');
  }

  private isNextConfig(fileName: string): boolean {
    return /next\.config\.(js|ts|mjs)$/.test(fileName);
  }

  private isJsxOrTemplate(fileName: string): boolean {
    return /\.(tsx|jsx|js|ts|html)$/.test(fileName) && !fileName.includes('node_modules');
  }

  private isSeoSupportedFile(fileName: string): boolean {
    return /\.(tsx|jsx|js|ts|html|vue|css)$/.test(fileName) && !fileName.includes('node_modules');
  }
}
