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
exports.SEO_RULES = void 0;
exports.getRulesForFile = getRulesForFile;
exports.formatSeoMessage = formatSeoMessage;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
exports.SEO_RULES = [
    // ─── NEXT.JS RULES ────────────────────────────────────────────────────────
    {
        id: 'NX-SEO-001',
        title: 'Use next/image instead of <img>',
        recommendation: 'Replace with Next.js <Image>',
        badCode: '<img src="...">',
        goodCode: '<Image src="..." width={500} height={300} alt="..." />',
        why: 'Next.js <Image> automatically optimizes size, lazy-loads, and serves modern formats (WebP/AVIF) to improve LCP (Largest Contentful Paint) and CLS.',
        severity: types_1.IssueSeverity.Warning,
        category: types_1.IssueCategory.Image,
        languages: ['tsx', 'jsx'],
        regex: /<img\s[^>]*>/gi,
        getQuickFix: (doc, match, index) => {
            const edit = new vscode.WorkspaceEdit();
            const importStatement = "import Image from 'next/image';\n";
            const text = doc.getText();
            if (!text.includes("from 'next/image'") && !text.includes('from "next/image"')) {
                const firstImportMatch = /^import /m.exec(text);
                const insertPos = firstImportMatch ? doc.positionAt(firstImportMatch.index) : new vscode.Position(0, 0);
                edit.insert(doc.uri, insertPos, importStatement);
            }
            const pos = doc.positionAt(index);
            const endPos = doc.positionAt(index + 4); // "<img" is 4 chars
            edit.replace(doc.uri, new vscode.Range(pos, endPos), '<Image ');
            return edit;
        }
    },
    {
        id: 'NX-SEO-002',
        title: 'Use next/link instead of raw <a> tag',
        recommendation: 'Use Next.js <Link>',
        badCode: '<a href="/about">',
        goodCode: '<Link href="/about"><a>',
        why: 'Next.js <Link> pre-fetches page bundles in the background and enables client-side routing, boosting transitions and PageSpeed scores.',
        severity: types_1.IssueSeverity.Warning,
        category: types_1.IssueCategory.SEO,
        languages: ['tsx', 'jsx'],
        regex: /<a\s[^>]*href=["'](?!\s*https?:\/\/)([^"']+)["'][^>]*>/gi,
        getQuickFix: (doc, match, index) => {
            const edit = new vscode.WorkspaceEdit();
            const importStatement = "import Link from 'next/link';\n";
            const text = doc.getText();
            if (!text.includes("from 'next/link'") && !text.includes('from "next/link"')) {
                const firstImportMatch = /^import /m.exec(text);
                const insertPos = firstImportMatch ? doc.positionAt(firstImportMatch.index) : new vscode.Position(0, 0);
                edit.insert(doc.uri, insertPos, importStatement);
            }
            const pos = doc.positionAt(index);
            const endPos = doc.positionAt(index + 2); // "<a" is 2 chars
            edit.replace(doc.uri, new vscode.Range(pos, endPos), '<Link ');
            // Replace closing tag or let user handle it.
            return edit;
        }
    },
    // ─── ANGULAR RULES ────────────────────────────────────────────────────────
    {
        id: 'NG-SEO-001',
        title: 'Use NgOptimizedImage instead of <img>',
        recommendation: 'Use Angular ngSrc',
        badCode: '<img src="...">',
        goodCode: '<img ngSrc="..." width="..." height="...">',
        why: 'Angular NgOptimizedImage directive enforces responsive sizing, prioritizes LCP images, and automatically generates preconnect resource hints.',
        severity: types_1.IssueSeverity.Warning,
        category: types_1.IssueCategory.Image,
        languages: ['html'],
        regex: /<img\s(?![^>]*ngSrc)[^>]*>/gi,
        getQuickFix: (doc, match, index) => {
            const edit = new vscode.WorkspaceEdit();
            // Find 'src=' and replace it with 'ngSrc='
            const tagText = match[0];
            const srcIndex = tagText.indexOf('src=');
            if (srcIndex !== -1) {
                const startOffset = index + srcIndex;
                const replaceRange = new vscode.Range(doc.positionAt(startOffset), doc.positionAt(startOffset + 4));
                edit.replace(doc.uri, replaceRange, 'ngSrc=');
                return edit;
            }
            return null;
        }
    },
    {
        id: 'NG-SEO-002',
        title: 'Use [routerLink] instead of raw href',
        recommendation: 'Use Angular routerLink',
        badCode: '<a href="/dashboard">',
        goodCode: '<a [routerLink]="[\'/dashboard\']">',
        why: 'Using href on internal links triggers full page reloads in Angular. Use routerLink to maintain single-page application navigation speeds.',
        severity: types_1.IssueSeverity.Warning,
        category: types_1.IssueCategory.SEO,
        languages: ['html'],
        regex: /<a\s(?![^>]*routerLink)[^>]*href=["'](?!\s*https?:\/\/)([^"']+)["'][^>]*>/gi,
        getQuickFix: (doc, match, index) => {
            const edit = new vscode.WorkspaceEdit();
            const tagText = match[0];
            const hrefMatch = /href=["']([^"']+)["']/i.exec(tagText);
            if (hrefMatch) {
                const path = hrefMatch[1];
                const startOffset = index + hrefMatch.index;
                const endOffset = startOffset + hrefMatch[0].length;
                const replaceRange = new vscode.Range(doc.positionAt(startOffset), doc.positionAt(endOffset));
                edit.replace(doc.uri, replaceRange, `[routerLink]="['${path}']"`);
                return edit;
            }
            return null;
        }
    },
    // ─── VUE / NUXT RULES ─────────────────────────────────────────────────────
    {
        id: 'VU-SEO-001',
        title: 'Use NuxtImg instead of raw <img>',
        recommendation: 'Replace with <NuxtImg>',
        badCode: '<img src="...">',
        goodCode: '<NuxtImg src="..." loading="lazy" />',
        why: 'NuxtImg integrates with Nuxt Image module to automatically resize, compress, and lazy-load assets for maximum PageSpeed ranking.',
        severity: types_1.IssueSeverity.Warning,
        category: types_1.IssueCategory.Image,
        languages: ['vue'],
        regex: /<img\s/gi,
        getQuickFix: (doc, match, index) => {
            const edit = new vscode.WorkspaceEdit();
            const pos = doc.positionAt(index);
            const endPos = doc.positionAt(index + 4); // "<img"
            edit.replace(doc.uri, new vscode.Range(pos, endPos), '<NuxtImg ');
            return edit;
        }
    },
    {
        id: 'VU-SEO-002',
        title: 'Use RouterLink or NuxtLink instead of raw <a> tag',
        recommendation: 'Use NuxtLink / RouterLink',
        badCode: '<a href="/services">',
        goodCode: '<NuxtLink to="/services">',
        why: 'Raw <a> links cause unnecessary round-trips to the server in Vue/Nuxt. RouterLink or NuxtLink enables client-side state preservation.',
        severity: types_1.IssueSeverity.Warning,
        category: types_1.IssueCategory.SEO,
        languages: ['vue'],
        regex: /<a\s[^>]*href=["'](?!\s*https?:\/\/)([^"']+)["'][^>]*>/gi,
        getQuickFix: (doc, match, index) => {
            const edit = new vscode.WorkspaceEdit();
            const tagText = match[0];
            const hrefMatch = /href=["']([^"']+)["']/i.exec(tagText);
            if (hrefMatch) {
                const path = hrefMatch[1];
                const startOffset = index + hrefMatch.index;
                const endOffset = startOffset + hrefMatch[0].length;
                const replaceRange = new vscode.Range(doc.positionAt(startOffset), doc.positionAt(endOffset));
                edit.replace(doc.uri, replaceRange, `to="${path}"`);
                // Also check if we should replace '<a' with '<NuxtLink' or '<router-link'
                const pos = doc.positionAt(index);
                const endPos = doc.positionAt(index + 2); // "<a"
                edit.replace(doc.uri, new vscode.Range(pos, endPos), '<NuxtLink ');
                return edit;
            }
            return null;
        }
    },
    // ─── GENERAL HTML RULES ───────────────────────────────────────────────────
    {
        id: 'HT-SEO-001',
        title: 'Missing image alt attribute',
        recommendation: 'Add alt attribute',
        badCode: '<img src="banner.jpg">',
        goodCode: '<img src="banner.jpg" alt="Summer promotion banner">',
        why: 'Alt text is critical for SEO image indexation (Google Images ranking) and accessibility compliance (WCAG screen readers).',
        severity: types_1.IssueSeverity.Warning,
        category: types_1.IssueCategory.SEO,
        languages: ['html', 'vue', 'tsx', 'jsx'],
        regex: /<(img|Image|NuxtImg)\s(?!.*alt=["'])([^>]*)/gi,
        getQuickFix: (doc, match, index) => {
            const edit = new vscode.WorkspaceEdit();
            const pos = doc.positionAt(index + match[0].length);
            edit.insert(doc.uri, pos, ' alt=""');
            return edit;
        }
    },
    {
        id: 'HT-SEO-002',
        title: 'Missing canonical link tag',
        recommendation: 'Add canonical tag',
        badCode: '<head></head>',
        goodCode: '<head><link rel="canonical" href="https://site.com/page" /></head>',
        why: 'Canonical links guide search engines to the preferred version of duplicate/similar pages, preventing SEO ranking dilution.',
        severity: types_1.IssueSeverity.Warning,
        category: types_1.IssueCategory.SEO,
        languages: ['html'],
        regex: /<head>(?![\s\S]*<link\s[^>]*rel=["']canonical["'])[\s\S]*?<\/head>/gi,
        getQuickFix: (doc, match, index) => {
            const edit = new vscode.WorkspaceEdit();
            const insertPos = doc.positionAt(index + 6); // After '<head>'
            edit.insert(doc.uri, insertPos, '\n  <link rel="canonical" href="https://yourdomain.com" />');
            return edit;
        }
    },
    {
        id: 'HT-SEO-003',
        title: 'Missing viewport meta tag',
        recommendation: 'Add viewport meta tag',
        badCode: '<head></head>',
        goodCode: '<head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>',
        why: 'Google ranks responsive, mobile-friendly sites higher. Viewport tags configure browsers to render sites appropriately on mobile devices.',
        severity: types_1.IssueSeverity.Error,
        category: types_1.IssueCategory.SEO,
        languages: ['html'],
        regex: /<head>(?![\s\S]*<meta\s[^>]*name=["']viewport["'])[\s\S]*?<\/head>/gi,
        getQuickFix: (doc, match, index) => {
            const edit = new vscode.WorkspaceEdit();
            const insertPos = doc.positionAt(index + 6);
            edit.insert(doc.uri, insertPos, '\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />');
            return edit;
        }
    },
    {
        id: 'HT-SEO-004',
        title: 'Missing title tag in head',
        recommendation: 'Add title tag',
        badCode: '<head></head>',
        goodCode: '<head><title>My Awesome Page</title></head>',
        why: 'The title tag is displayed in search results (SERP) and is the most important on-page ranking factor for CTR and relevancy.',
        severity: types_1.IssueSeverity.Error,
        category: types_1.IssueCategory.SEO,
        languages: ['html'],
        regex: /<head>(?![\s\S]*<title>[\s\S]*<\/title>)[\s\S]*?<\/head>/gi,
        getQuickFix: (doc, match, index) => {
            const edit = new vscode.WorkspaceEdit();
            const insertPos = doc.positionAt(index + 6);
            edit.insert(doc.uri, insertPos, '\n  <title>Your Page Title (50-60 characters)</title>');
            return edit;
        }
    },
    {
        id: 'HT-SEO-005',
        title: 'Missing meta description tag',
        recommendation: 'Add meta description',
        badCode: '<head></head>',
        goodCode: '<head><meta name="description" content="A brief summary..." /></head>',
        why: 'Meta descriptions describe your page in search results. An optimized description (150-160 chars) directly boosts search click-through rate (CTR).',
        severity: types_1.IssueSeverity.Warning,
        category: types_1.IssueCategory.SEO,
        languages: ['html'],
        regex: /<head>(?![\s\S]*<meta\s[^>]*name=["']description["'])[\s\S]*?<\/head>/gi,
        getQuickFix: (doc, match, index) => {
            const edit = new vscode.WorkspaceEdit();
            const insertPos = doc.positionAt(index + 6);
            edit.insert(doc.uri, insertPos, '\n  <meta name="description" content="Enter a search-engine friendly summary here (150-160 characters)." />');
            return edit;
        }
    },
    {
        id: 'HT-SEO-006',
        title: 'Render-blocking script in head',
        recommendation: 'Use async/defer for script',
        badCode: '<script src="app.js"></script>',
        goodCode: '<script src="app.js" defer></script>',
        why: 'Scripts without defer/async block HTML parsing. This delays First Contentful Paint (FCP) and leads to bad PageSpeed scores.',
        severity: types_1.IssueSeverity.Warning,
        category: types_1.IssueCategory.SEO,
        languages: ['html'],
        regex: /<head>[\s\S]*?<script\s(?![^>]*defer)(?![^>]*async)(?![^>]*type=["']module["'])[^>]*src=[\s\S]*?<\/head>/gi,
        getQuickFix: (doc, match, index) => {
            const edit = new vscode.WorkspaceEdit();
            // Find script inside head and append 'defer'
            const text = match[0];
            const scriptRegex = /<script\s/gi;
            let scriptMatch;
            while ((scriptMatch = scriptRegex.exec(text)) !== null) {
                const fullScriptMatch = /<script[^>]*>/gi.exec(text.substring(scriptMatch.index));
                if (fullScriptMatch) {
                    const startOffset = index + scriptMatch.index + fullScriptMatch[0].length - 1; // Position right before '>'
                    const insertPos = doc.positionAt(startOffset);
                    edit.insert(doc.uri, insertPos, ' defer');
                }
            }
            return edit;
        }
    },
    // ─── CSS RULES ────────────────────────────────────────────────────────────
    {
        id: 'CS-SEO-001',
        title: 'Avoid CSS @import in stylesheets',
        recommendation: 'Remove @import',
        badCode: '@import url("style2.css");',
        goodCode: 'Use bundler imports or HTML <link rel="stylesheet">',
        why: 'CSS @import delays render start. The browser must download and parse the main CSS before starting to fetch imported stylesheets, harming FCP.',
        severity: types_1.IssueSeverity.Warning,
        category: types_1.IssueCategory.SEO,
        languages: ['css'],
        regex: /@import\s+[^;]+;/gi,
    },
    {
        id: 'CS-SEO-002',
        title: 'Layout-shifting animation transition',
        recommendation: 'Transition transform instead',
        badCode: 'transition: width 0.3s, height 0.3s;',
        goodCode: 'transition: transform 0.3s;',
        why: 'Animating properties like width/height/top/left triggers browser layout reflows on every frame. This causes Cumulative Layout Shift (CLS) spikes.',
        severity: types_1.IssueSeverity.Warning,
        category: types_1.IssueCategory.SEO,
        languages: ['css'],
        regex: /transition\s*:\s*([^;]*(width|height|top|left|right|bottom|margin)[^;]*);/gi,
    },
    {
        id: 'CS-SEO-003',
        title: 'Font-face missing font-display: swap',
        recommendation: 'Add font-display: swap',
        badCode: '@font-face { font-family: "MyFont"; src: ... }',
        goodCode: '@font-face { font-family: "MyFont"; font-display: swap; src: ... }',
        why: 'Without font-display: swap, text remains invisible while custom fonts are loading, causing Flash of Invisible Text (FOIT) which hurts LCP.',
        severity: types_1.IssueSeverity.Warning,
        category: types_1.IssueCategory.SEO,
        languages: ['css'],
        regex: /@font-face\s*\{(?![^}]*font-display\s*:\s*swap)[^}]*\}/gi,
        getQuickFix: (doc, match, index) => {
            const edit = new vscode.WorkspaceEdit();
            // Insert font-display swap inside the first line after opening bracket
            const openBracketIndex = match[0].indexOf('{');
            if (openBracketIndex !== -1) {
                const insertPos = doc.positionAt(index + openBracketIndex + 1);
                edit.insert(doc.uri, insertPos, '\n  font-display: swap;');
                return edit;
            }
            return null;
        }
    },
    // ─── JS/TS RULES ──────────────────────────────────────────────────────────
    {
        id: 'JS-SEO-001',
        title: 'Avoid synchronous XMLHttpRequest',
        recommendation: 'Use asynchronous fetch()',
        badCode: 'xhr.open("GET", "/api", false);',
        goodCode: 'fetch("/api").then(...) or await fetch(...)',
        why: 'Synchronous network requests block the browser main thread entirely, making the page unresponsive and degrading Interaction to Next Paint (INP).',
        severity: types_1.IssueSeverity.Error,
        category: types_1.IssueCategory.SEO,
        languages: ['js', 'ts'],
        regex: /\.open\s*\(\s*["'][^"']+["']\s*,\s*["'][^"']+["']\s*,\s*false\s*\)/gi,
    }
];
function getRulesForFile(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return exports.SEO_RULES.filter((rule) => rule.languages.includes(ext));
}
function formatSeoMessage(rule) {
    return `⚡ VitalLens: [${rule.title}]\n` +
        `➡️ Yerine: ${rule.badCode}\n` +
        `👉 Kullanın: ${rule.goodCode}\n` +
        `💡 Neden?: ${rule.why}`;
}
//# sourceMappingURL=seoRules.js.map