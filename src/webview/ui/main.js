// VitalLens Webview UI — main.js
// Handles rendering and VS Code extension communication

(function () {
  'use strict';

  const vscode = acquireVsCodeApi();

  // ── DOM Refs ─────────────────────────────────────────────────
  const runBtn       = document.getElementById('runBtn');
  const ringFill     = document.getElementById('ringFill');
  const scoreValue   = document.getElementById('scoreValue');
  const loadingState = document.getElementById('loadingState');
  const issuesList   = document.getElementById('issuesList');
  const summaryBadges = document.getElementById('summaryBadges');
  const footer       = document.getElementById('footer');
  const barImage     = document.getElementById('barImage');
  const barBundle    = document.getElementById('barBundle');
  const barRedirect  = document.getElementById('barRedirect');
  const barSeo       = document.getElementById('barSeo');
  const numImage     = document.getElementById('numImage');
  const numBundle    = document.getElementById('numBundle');
  const numRedirect  = document.getElementById('numRedirect');
  const numSeo       = document.getElementById('numSeo');
  const badgeError   = document.getElementById('badgeError');
  const badgeWarn    = document.getElementById('badgeWarn');
  const badgeInfo    = document.getElementById('badgeInfo');
  const frameworkBadge = document.getElementById('frameworkBadge');

  const RING_CIRCUMFERENCE = 326.73; // 2 * π * 52

  // ── Event Listeners ──────────────────────────────────────────
  runBtn.addEventListener('click', () => {
    vscode.postMessage({ command: 'runAnalysis' });
    runBtn.classList.add('spinning');
    runBtn.disabled = true;
  });

  // ── Message Handler (from Extension) ────────────────────────
  window.addEventListener('message', (event) => {
    const msg = event.data;

    switch (msg.command) {
      case 'update':
        render(msg.data);
        break;
      case 'loading':
        showLoading();
        break;
      case 'error':
        showError(msg.message);
        break;
    }
  });

  // ── Rendering ────────────────────────────────────────────────
  function render(data) {
    stopSpinner();

    // Framework badge
    if (data.isNextJs) {
      frameworkBadge.textContent = 'Next.js';
      frameworkBadge.style.display = 'inline-block';
    } else {
      frameworkBadge.style.display = 'none';
    }

    // Score ring
    animateScore(data.score);

    // Category bars
    setCategoryScore(barImage, numImage, data.categoryScores.image);
    setCategoryScore(barBundle, numBundle, data.categoryScores.bundle);
    setCategoryScore(barRedirect, numRedirect, data.categoryScores.redirect);
    setCategoryScore(barSeo, numSeo, data.categoryScores.seo);

    // Summary badges
    summaryBadges.style.display = 'flex';
    badgeError.textContent = `${data.counts.errors} Error${data.counts.errors !== 1 ? 's' : ''}`;
    badgeWarn.textContent  = `${data.counts.warnings} Warning${data.counts.warnings !== 1 ? 's' : ''}`;
    badgeInfo.textContent  = `${data.counts.info} Info`;

    // Issues list
    const groups = [
      { key: 'bundle',   label: '📦 Bundle',    emoji: '📦', issues: data.bundleIssues   },
      { key: 'image',    label: '🖼️ Images',    emoji: '🖼️', issues: data.imageIssues    },
      { key: 'redirect', label: '🔄 Redirects', emoji: '🔄', issues: data.redirectIssues },
      { key: 'seo',      label: '🎯 SEO',       emoji: '🎯', issues: data.seoIssues      },
    ];

    const totalIssues = groups.reduce((sum, g) => sum + g.issues.length, 0);

    loadingState.style.display = 'none';
    issuesList.style.display   = 'block';
    issuesList.innerHTML       = '';

    if (totalIssues === 0) {
      issuesList.innerHTML = `
        <div class="no-issues">
          <div class="check-icon">✅</div>
          <h3>All clear!</h3>
          <p>No performance or SEO issues detected in the analyzed files.</p>
        </div>`;
    } else {
      for (const group of groups) {
        if (group.issues.length === 0) continue;
        issuesList.appendChild(buildGroup(group));
      }
    }

    // Footer
    footer.textContent = `Last analyzed: ${data.analyzedAt}`;
  }

  function buildGroup({ key, label, issues }) {
    const hasErrors   = issues.some(i => i.severity === 'error');
    const hasWarnings = issues.some(i => i.severity === 'warning');

    const section = document.createElement('div');
    section.className = 'issue-group';

    const countClass = hasErrors ? 'has-errors' : hasWarnings ? 'has-warnings' : '';

    section.innerHTML = `
      <div class="issue-group-header" data-group="${key}">
        <span class="group-title">
          <span>${label}</span>
          <span class="group-count ${countClass}">${issues.length}</span>
        </span>
        <span class="group-chevron" id="chevron-${key}">▾</span>
      </div>
      <div class="issue-list" id="list-${key}"></div>
    `;

    const listEl = section.querySelector(`#list-${key}`);
    for (const issue of issues) {
      listEl.appendChild(buildIssueItem(issue));
    }

    // Toggle collapse
    const header = section.querySelector('.issue-group-header');
    header.addEventListener('click', () => {
      const list    = section.querySelector('.issue-list');
      const chevron = section.querySelector('.group-chevron');
      list.classList.toggle('collapsed');
      chevron.classList.toggle('collapsed');
    });

    return section;
  }

  function buildIssueItem(issue) {
    const item = document.createElement('div');
    item.className = 'issue-item';
    item.title     = issue.message;

    const icon = severityIcon(issue.severity);

    let sizeBadge = '';
    if (issue.meta && issue.meta.sizeKB) {
      sizeBadge = `<span class="issue-size-badge">${issue.meta.sizeKB}KB</span>`;
    } else if (issue.meta && issue.meta.packageName && issue.meta.sizeKB !== undefined) {
      sizeBadge = `<span class="issue-size-badge">~${issue.meta.sizeKB}KB</span>`;
    }

    item.innerHTML = `
      <span class="issue-severity-icon">${icon}</span>
      <div class="issue-body">
        <div class="issue-title">${escHtml(issue.title)}</div>
        <div class="issue-meta">
          <span class="issue-file">${escHtml(issue.fileName)}</span>
          <span class="issue-line">:${issue.line}</span>
          ${sizeBadge}
        </div>
      </div>
    `;

    item.addEventListener('click', () => {
      vscode.postMessage({ command: 'openFile', filePath: issue.filePath });
    });

    return item;
  }

  function showLoading() {
    loadingState.style.display = 'flex';
    issuesList.style.display   = 'none';
    summaryBadges.style.display = 'none';
    footer.textContent = '';
  }

  function showError(message) {
    stopSpinner();
    loadingState.style.display = 'flex';
    loadingState.innerHTML = `
      <div style="font-size:24px">⚠️</div>
      <p>${escHtml(message)}</p>
    `;
  }

  function stopSpinner() {
    runBtn.classList.remove('spinning');
    runBtn.disabled = false;
  }

  // ── Score Animation ──────────────────────────────────────────
  function animateScore(score) {
    const clampedScore = Math.max(0, Math.min(100, score));
    const offset = RING_CIRCUMFERENCE - (clampedScore / 100) * RING_CIRCUMFERENCE;

    ringFill.style.strokeDashoffset = offset;
    ringFill.style.stroke = scoreColor(clampedScore);
    scoreValue.textContent = clampedScore;
    scoreValue.style.background = `linear-gradient(135deg, ${scoreColor(clampedScore)}, ${scoreColorEnd(clampedScore)})`;
    scoreValue.style.webkitBackgroundClip = 'text';
    scoreValue.style.webkitTextFillColor = 'transparent';
  }

  function setCategoryScore(barEl, numEl, score) {
    const clamped = Math.max(0, Math.min(100, score));
    barEl.style.width = clamped + '%';
    barEl.className = 'cat-bar ' + (clamped >= 80 ? 'high' : clamped >= 50 ? 'mid' : 'low');
    numEl.textContent = clamped;
  }

  function scoreColor(s) {
    if (s >= 80) return '#6C63FF';
    if (s >= 50) return '#FFD93D';
    return '#FF6B6B';
  }

  function scoreColorEnd(s) {
    if (s >= 80) return '#00D9A5';
    if (s >= 50) return '#FF8E53';
    return '#FF8E53';
  }

  function severityIcon(severity) {
    switch (severity) {
      case 'error':   return '🔴';
      case 'warning': return '🟡';
      case 'info':    return '🔵';
      default:        return '⚪';
    }
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
