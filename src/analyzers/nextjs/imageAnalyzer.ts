import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IssueCategory, IssueSeverity, VitalIssue } from '../../core/types';

/**
 * Analyzes JSX/TSX/HTML files for image optimisation issues:
 * 1. Using raw <img> instead of next/image
 * 2. Referencing images that are too large (>200KB by default)
 */
export class ImageAnalyzer {
  constructor(private readonly context: vscode.ExtensionContext) {}

  public async analyze(document: vscode.TextDocument): Promise<VitalIssue[]> {
    const issues: VitalIssue[] = [];
    const text = document.getText();
    const config = vscode.workspace.getConfiguration('vitallens');
    const thresholdKB: number = config.get('imageSizeWarningKB', 200);

    // Find all <img tags (not next/image) — flag them
    this.findRawImgTags(document, text, issues);

    // Find all image src references and check file size
    await this.findOversizedImages(document, text, thresholdKB, issues);

    return issues;
  }

  /**
   * Detect usage of raw <img> element instead of next/image.
   * next/image provides lazy loading, optimisation, and WebP conversion.
   */
  private findRawImgTags(
    document: vscode.TextDocument,
    text: string,
    issues: VitalIssue[]
  ): void {
    // Match <img (but not inside a comment, and not <Image from next/image)
    const imgRegex = /<img\s/gi;
    let match: RegExpExecArray | null;

    while ((match = imgRegex.exec(text)) !== null) {
      const pos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(pos, endPos);

      issues.push({
        ruleId: 'NX-IMG-001',
        title: 'Use next/image instead of <img>',
        message:
          '⚡ Use next/image instead of <img>. Next/Image provides automatic lazy loading, WebP conversion, and responsive sizing — significantly improving LCP and CLS scores.',
        severity: IssueSeverity.Warning,
        category: IssueCategory.Image,
        fileUri: document.uri,
        range,
        fixes: [
          {
            label: 'Replace with <Image> from next/image',
            edit: this.buildNextImageReplacementEdit(document, match.index, text),
          },
        ],
        meta: { tagIndex: match.index },
      });
    }
  }

  /**
   * Scan for image src paths and check file size.
   */
  private async findOversizedImages(
    document: vscode.TextDocument,
    text: string,
    thresholdKB: number,
    issues: VitalIssue[]
  ): Promise<void> {
    // Match src="..." or src='...' inside img or Image tags
    const srcRegex = /src=["']([^"']+\.(png|jpe?g|gif|bmp|tiff?|webp|avif|svg))["']/gi;
    let match: RegExpExecArray | null;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    while ((match = srcRegex.exec(text)) !== null) {
      const srcValue = match[1];

      // Only check local paths (starting with / or ./)
      if (!srcValue.startsWith('/') && !srcValue.startsWith('./') && !srcValue.startsWith('../')) {
        continue;
      }

      // Try to resolve the file in the workspace
      const resolvedPath = this.resolveSrcPath(srcValue, workspaceFolders[0].uri.fsPath);
      if (!resolvedPath) {
        continue;
      }

      try {
        const stat = fs.statSync(resolvedPath);
        const sizeKB = stat.size / 1024;

        if (sizeKB > thresholdKB) {
          const pos = document.positionAt(match.index);
          const endPos = document.positionAt(match.index + match[0].length);

          issues.push({
            ruleId: 'NX-IMG-002',
            title: `Large image: ${Math.round(sizeKB)}KB`,
            message: `🖼️ Image "${path.basename(srcValue)}" is ${Math.round(sizeKB)}KB — exceeds the ${thresholdKB}KB threshold. This will hurt LCP (Largest Contentful Paint). Consider converting to WebP and compressing.`,
            severity: sizeKB > thresholdKB * 3 ? IssueSeverity.Error : IssueSeverity.Warning,
            category: IssueCategory.Image,
            fileUri: document.uri,
            range: new vscode.Range(pos, endPos),
            meta: {
              sizeKB: Math.round(sizeKB),
              filePath: resolvedPath,
              fileName: path.basename(srcValue),
            },
          });
        }
      } catch {
        // File not found — skip
      }
    }
  }

  private resolveSrcPath(srcValue: string, workspaceRoot: string): string | null {
    // Strip leading slash — treat as relative to the 'public' folder (Next.js convention)
    if (srcValue.startsWith('/')) {
      const inPublic = path.join(workspaceRoot, 'public', srcValue);
      if (fs.existsSync(inPublic)) {
        return inPublic;
      }
      // Fallback: relative to workspace root
      const atRoot = path.join(workspaceRoot, srcValue);
      if (fs.existsSync(atRoot)) {
        return atRoot;
      }
    }
    return null;
  }

  /**
   * Build a simple WorkspaceEdit that adds the next/image import
   * (full JSX replacement is complex — we just show the intent here).
   */
  private buildNextImageReplacementEdit(
    document: vscode.TextDocument,
    index: number,
    text: string
  ): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();

    // Add import at top of file if not already present
    const importStatement = "import Image from 'next/image';\n";
    if (!text.includes("from 'next/image'") && !text.includes('from "next/image"')) {
      // Find the first import line position
      const firstImportMatch = /^import /m.exec(text);
      const insertPos = firstImportMatch
        ? document.positionAt(firstImportMatch.index)
        : new vscode.Position(0, 0);
      edit.insert(document.uri, insertPos, importStatement);
    }

    // Replace <img  with <Image 
    const pos = document.positionAt(index);
    const endPos = document.positionAt(index + 4); // "<img" is 4 chars
    edit.replace(document.uri, new vscode.Range(pos, endPos), '<Image ');

    return edit;
  }
}
