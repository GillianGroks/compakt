Compakt v1.0.0 Release Plan
Cleanup & Polish
Code Cleanup:
[ ] Remove debug logging we added during troubleshooting (the registry logs, buildEmbeddedExtensionFactories logs)
[ ] Keep the compression ratio logging — that's useful for users
[ ] Review DEVELOPMENT_HISTORY.md — maybe trim or move to HISTORY.md for release notes
[ ] Ensure tsconfig.json has proper production settings
[ ] Run TypeScript strict mode check
[ ] Add error handling for edge cases (empty messages, aborted signals, etc.)

Documentation:
[ ] Polish README.md with:
    - What Compakt does (one-liner)
    - Installation instructions
    - Configuration example (provider: "compakt" in openclaw.json)
    - How to verify it's working (log patterns to look for)
    - Compression stats explanation
[ ] Add CHANGELOG.md with v1.0.0 notes
[ ] Document the VRAM benefit you observed (13.9GB → 9.3GB is huge!)
[ ] Add troubleshooting section (common issues, how to check if Compakt is active)

Testing:
[ ] Document the test scenario (bloat files → overflow → compaction)
[ ] Note expected log output
[ ] Record baseline metrics (time, compression ratio, VRAM)

---

npm Publishing
Package Prep:
[ ] Verify package.json has:
    - Correct name (compakt or @openclaw/compakt?)
    - Version 1.0.0
    - Proper main/exports pointing to dist/index.js
    - files array to include only what's needed
    - repository, author, license fields
    - keywords for discoverability (openclaw, plugin, compaction, llm)
[ ] Ensure dist/ is built and committed (or add to .npmignore if building on install)
[ ] Add .npmignore to exclude dev files (src/, tests/, reviews/, etc.)
[ ] Test local install: npm install -g ./compakt
[ ] Test plugin loading in OpenClaw

Publishing:
[ ] Create npm account (if needed)
[ ] npm publish (or npm publish --access public if scoped)
[ ] Verify on npmjs.com

OpenClaw Integration:
[ ] Check if Compakt needs to be added to OpenClaw's bundled plugins list
[ ] Or document as a community plugin users can install separately

---

Distribution & Marketing
GitHub:
[ ] Create GitHub repo (if not already public)
[ ] Add proper repo description
[ ] Create v1.0.0 release with release notes
[ ] Pin the repo to your profile

Community Outreach:
[ ] OpenClaw Discord — post in #plugins or #announcements channel
[ ] OpenClaw GitHub Discussions — create announcement post
[ ] ClawHub — submit Compakt for listing on clawhub.ai
[ ] Twitter/X — thread about the problem it solves + VRAM savings
[ ] Reddit — r/LocalLLaMA, r/selfhosted, r/opensource (if they allow plugin posts)

Messaging Angles:
"Compakt cuts compaction VRAM usage by 33% (13.9GB → 9.3GB)"
"Finally, a compaction provider that doesn't melt your GPU"
"OpenClaw plugin for efficient context compaction using local models"
"No more OOM crashes during long sessions"

Demo Content:
[ ] Screenshot of compression stats from logs
[ ] Before/after VRAM comparison
[ ] Short video/gif of compaction in action (optional)

---

Post-Launch
[ ] Monitor for issues/bugs
[ ] Collect user feedback on compression ratios
[ ] Consider adding configuration options (chunk size, overlap, temperature)
[ ] Plan v1.1.0 features based on feedback

---

Questions to decide:
Should Compakt be bundled with OpenClaw core, or stay as a separate plugin?
npm scope: compakt vs @openclaw/compakt vs @gillian.groks/compakt?
Do we want a Compakt-specific Discord channel or just use OpenClaw's?

What do you want to tackle first?