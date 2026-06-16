"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VitalLensEngine = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
const imageAnalyzer_1 = require("../analyzers/nextjs/imageAnalyzer");
const bundleAnalyzer_1 = require("../analyzers/nextjs/bundleAnalyzer");
const redirectAnalyzer_1 = require("../analyzers/nextjs/redirectAnalyzer");
/**
 * Central analysis engine — orchestrates all analyzers and aggregates results.
 */
class VitalLensEngine {
    constructor(context) {
        this.context = context;
        this.imageAnalyzer = new imageAnalyzer_1.ImageAnalyzer(context);
        this.bundleAnalyzer = new bundleAnalyzer_1.BundleAnalyzer(context);
        this.redirectAnalyzer = new redirectAnalyzer_1.RedirectAnalyzer();
    }
    /**
     * Run full analysis on the given document.
     * Returns all issues found across all analyzers relevant to that document.
     */
    async analyzeDocument(document) {
        const issues = [];
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
        return issues;
    }
    /**
     * Run analysis across all open/relevant files in the workspace and
     * build a consolidated AnalysisResult for the sidebar panel.
     */
    async analyzeWorkspace() {
        const allIssues = [];
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
    async analyzeKeyFiles(issues) {
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
    async tryAnalyzeUri(uri, issues) {
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            const fileIssues = await this.analyzeDocument(doc);
            // Only add if not already analysed (avoid duplicates from open docs)
            for (const issue of fileIssues) {
                const duplicate = issues.some((i) => i.ruleId === issue.ruleId && i.fileUri.toString() === issue.fileUri.toString() && i.range.start.line === issue.range.start.line);
                if (!duplicate) {
                    issues.push(issue);
                }
            }
        }
        catch {
            // File doesn't exist — silently skip
        }
    }
    /** Compute an overall 0-100 score. Penalties per severity. */
    computeScore(issues) {
        let penalty = 0;
        for (const issue of issues) {
            switch (issue.severity) {
                case types_1.IssueSeverity.Error:
                    penalty += 15;
                    break;
                case types_1.IssueSeverity.Warning:
                    penalty += 7;
                    break;
                case types_1.IssueSeverity.Info:
                    penalty += 2;
                    break;
            }
        }
        return Math.max(0, 100 - penalty);
    }
    computeCategoryScores(issues) {
        const categories = [
            types_1.IssueCategory.Image,
            types_1.IssueCategory.Bundle,
            types_1.IssueCategory.Redirect,
            types_1.IssueCategory.SEO,
        ];
        const scores = { image: 100, bundle: 100, redirect: 100, seo: 100 };
        for (const cat of categories) {
            const catIssues = issues.filter((i) => i.category === cat);
            let penalty = 0;
            for (const issue of catIssues) {
                switch (issue.severity) {
                    case types_1.IssueSeverity.Error:
                        penalty += 25;
                        break;
                    case types_1.IssueSeverity.Warning:
                        penalty += 12;
                        break;
                    case types_1.IssueSeverity.Info:
                        penalty += 4;
                        break;
                }
            }
            scores[cat] = Math.max(0, 100 - penalty);
        }
        return scores;
    }
    async isNextJsProject() {
        const files = await vscode.workspace.findFiles('next.config.{js,ts,mjs}', '**/node_modules/**', 1);
        return files.length > 0;
    }
    isPackageJson(fileName) {
        return fileName.endsWith('package.json') && !fileName.includes('node_modules');
    }
    isNextConfig(fileName) {
        return /next\.config\.(js|ts|mjs)$/.test(fileName);
    }
    isJsxOrTemplate(fileName) {
        return /\.(tsx|jsx|js|ts|html)$/.test(fileName) && !fileName.includes('node_modules');
    }
}
exports.VitalLensEngine = VitalLensEngine;
//# sourceMappingURL=engine.js.map