# CI/CD Workflows Guide

> **Automated quality checks and release automation for Sherpa UI**

---

## Overview

Sherpa UI uses GitHub Actions for continuous integration, quality checks, and automated releases.

**Workflows:**
1. **CI** (`ci.yml`) — Runs on every push and PR
2. **Tokens Sync** (`tokens-sync.yml`) — Weekly check for Figma token freshness
3. **Release** (`release.yml`) — Automated NPM publishing on version tags

---

## CI Workflow

**Trigger:** Push to `main` or pull request  
**Duration:** ~3-5 minutes  
**Jobs:**

### 1. Lint & Format
- ✅ Prettier format check
- ✅ CSS linting
- ✅ JSDoc validation

### 2. Build Validation
- ✅ Full build execution
- ✅ Artifact verification (CSS, schemas, patterns)

### 3. Accessibility Tests
- ✅ WCAG 2.1 AA compliance (pa11y + axe-core)
- ✅ Uploads accessibility report artifact

### 4. Component Audit
- ✅ JSDoc completeness
- ✅ CSS structure
- ✅ Accessibility implementation
- ✅ Progressive enhancement
- ✅ Uploads audit report artifact

### 5. Summary
- ✅ Aggregates all job results
- ✅ Displays summary in GitHub UI
- ✅ Fails if any critical job fails

**Status Badge:**

```markdown
![CI](https://github.com/YOUR_ORG/sherpa-ui/workflows/CI/badge.svg)
```

---

## Tokens Sync Workflow

**Trigger:** Weekly (Monday 9am UTC) or manual  
**Purpose:** Alert when Figma tokens need updating  
**Duration:** ~1 minute

### What It Does

1. Checks age of `figma-tokens/figma-variables.json`
2. If older than 30 days:
   - Creates or updates a GitHub issue
   - Labels: `tokens-sync`, `design-system`, `maintenance`
3. Issue includes:
   - Token age
   - Update instructions
   - Impact assessment

### Manual Trigger

```bash
# Via GitHub UI
Actions → Tokens Sync Check → Run workflow

# Via gh CLI
gh workflow run tokens-sync.yml
```

### Resolving Token Sync Issues

```bash
# 1. Extract latest tokens from Figma
npm run tokens:extract

# 2. Review changes
git diff figma-tokens/figma-variables.json

# 3. Generate CSS from tokens
npm run tokens:generate

# 4. Review generated CSS
git diff css/styles/

# 5. Commit and push
git add figma-tokens/ css/styles/
git commit -m "Update design tokens from Figma"
git push

# 6. Close the issue
gh issue close <issue-number>
```

---

## Release Workflow

**Trigger:** Push version tag (e.g., `v1.2.3`)  
**Duration:** ~5-7 minutes  
**Jobs:**

### 1. Test Before Release
- ✅ All linting checks
- ✅ Full build
- ✅ Accessibility tests
- ✅ Component audit

**If any test fails, release is aborted.**

### 2. Publish to NPM
- ✅ Builds package
- ✅ Verifies package contents
- ✅ Publishes to NPM with provenance
- ✅ Public access

### 3. Create GitHub Release
- ✅ Generates changelog from commits
- ✅ Creates GitHub release
- ✅ Marks pre-releases (alpha, beta, rc)
- ✅ Links to NPM package

### Creating a Release

```bash
# 1. Update version in package.json
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0

# 2. Push version tag
git push && git push --tags

# 3. Workflow automatically:
#    - Runs all tests
#    - Publishes to NPM
#    - Creates GitHub release
```

### Pre-releases

```bash
# Alpha release
npm version prerelease --preid=alpha  # 1.0.0-alpha.0

# Beta release
npm version prerelease --preid=beta   # 1.0.0-beta.0

# Release candidate
npm version prerelease --preid=rc     # 1.0.0-rc.0

# Push tag
git push --tags
```

---

## Required Secrets

Add these secrets in **Settings → Secrets and variables → Actions**:

### NPM_TOKEN
**Required for:** Release workflow  
**Scope:** Automation token with publish permission

**Setup:**
1. Log in to [npmjs.com](https://www.npmjs.com/)
2. Go to **Access Tokens** → **Generate New Token**
3. Select **Automation** type
4. Copy token
5. Add to GitHub secrets as `NPM_TOKEN`

---

## Branch Protection Rules

**Recommended settings for `main` branch:**

### Protection Rules
- ✅ Require pull request before merging
- ✅ Require approvals: 1
- ✅ Require status checks to pass:
  - `Lint & Format`
  - `Build Validation`
  - `Accessibility Tests`
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings
- ❌ Allow force pushes: Disabled
- ❌ Allow deletions: Disabled

### Setup via GitHub UI

1. Go to **Settings → Branches**
2. Click **Add branch protection rule**
3. Branch name pattern: `main`
4. Configure protection rules above
5. Save

### Setup via API

```bash
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["Lint & Format","Build Validation","Accessibility Tests"]}' \
  --field required_pull_request_reviews='{"required_approving_review_count":1}' \
  --field enforce_admins=true \
  --field restrictions=null
```

---

## Local Testing

Run the same checks locally before pushing:

```bash
# Linting and format
npm run format:check
npm run lint:css
npm run validate:jsdoc

# Build
npm run build

# Accessibility
npm run test:a11y

# Component audit
npm run audit

# All checks
npm run format:check && \
npm run lint:css && \
npm run validate:jsdoc && \
npm run build && \
npm run test:a11y && \
npm run audit
```

---

## Workflow Status

View workflow runs:
- **GitHub UI:** Actions tab
- **API:** `gh api repos/:owner/:repo/actions/runs`
- **CLI:** `gh run list`

View specific run:
```bash
gh run view <run-id>
gh run watch <run-id>  # Watch live
```

Download artifacts:
```bash
gh run download <run-id>
```

---

## Troubleshooting

### CI Fails on Accessibility Tests

```bash
# Run locally to debug
npm run test:a11y:verbose

# View detailed report
cat test/a11y/report.json
```

### CI Fails on Build

```bash
# Clear cache and rebuild
npm run cache:clear
npm run build

# Check for errors
npm run build 2>&1 | grep -i error
```

### Release Workflow Fails on NPM Publish

1. Verify `NPM_TOKEN` secret is set
2. Check token hasn't expired
3. Verify package name is available
4. Check package.json `name` field

### Tokens Sync Creates Duplicate Issues

Labels are used to prevent duplicates. If duplicates appear:

```bash
# Close duplicates manually
gh issue list --label tokens-sync
gh issue close <issue-number>
```

---

## Extending Workflows

### Adding a New Check

Edit `.github/workflows/ci.yml`:

```yaml
new-check:
  name: New Check
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm ci
    - run: npm run your-new-check

# Add to summary job needs
summary:
  needs: [lint, build, accessibility, audit, new-check]
```

### Adding Coverage Reporting

Install coverage tool:
```bash
npm install --save-dev c8
```

Update CI workflow:
```yaml
- name: Run tests with coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/coverage-final.json
```

---

## Best Practices

1. **Always run checks locally before pushing**
2. **Keep workflows fast** (< 5 minutes ideal)
3. **Use caching** (npm cache, build cache)
4. **Fail fast** (run quick checks first)
5. **Upload artifacts** for debugging
6. **Use summary** for at-a-glance status
7. **Require PR reviews** for main branch
8. **Test releases** with pre-release tags first

---

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [NPM Publishing](https://docs.npmjs.com/cli/v10/commands/npm-publish)
- [Semantic Versioning](https://semver.org/)

---

**Last Updated:** 2026-05-28  
**Workflows Version:** 1.0.0  
**Sherpa UI Version:** 1.1.0
