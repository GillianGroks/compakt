# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-04-22

### Changed
- Updated README with npm installation instructions
- Clarified model sizing guide (4x rule)

## [1.0.0] - 2026-04-22

### Added
- Initial release of Compakt plugin for OpenClaw
- Chunked context compaction for local LLMs
- CompactionProvider API implementation
- Configurable chunk size and overlap
- Support for Ollama-based summarization models
- `/context-stats` command for debugging
- AbortSignal support for cancellation
- Fallback mechanism for failed summarizations

### Performance
- **38% reduction in peak VRAM** during compaction (13.9 GB → 8.6 GB on RTX 4060 Ti 16GB)
- **Compaction time reduced from 6+ minutes to ~20 seconds**
- Near-zero processing overhead — VRAM spike is just the compaction model loading

### Technical Details
- Token estimation using character heuristic
- Chunking with configurable overlap for context continuity
- Graceful degradation with `[FALLBACK]` prefix on failures

### Attribution
- Based on [jasper-context-compactor](https://github.com/E-x-O-Entertainment-Studios-Inc/openclaw-context-compactor) by E.x.O. Entertainment Studios Inc.