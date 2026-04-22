#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function log(msg) { console.log(msg); }

function getOpenClawConfigPath() {
  // typical location: ~/.openclaw/openclaw.json
  return path.join(os.homedir(), '.openclaw', 'openclaw.json');
}

function loadConfig() {
  const cfgPath = getOpenClawConfigPath();
  if (!fs.existsSync(cfgPath)) {
    log('OpenClaw config not found at ' + cfgPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(cfgPath, 'utf8');
  return JSON.parse(raw);
}

function backupConfig(cfg) {
  const cfgPath = getOpenClawConfigPath();
  const backupPath = cfgPath + '.bak_' + Date.now();
  fs.copyFileSync(cfgPath, backupPath);
  log('Backup created at ' + backupPath);
}

function saveConfig(cfg) {
  const cfgPath = getOpenClawConfigPath();
  const data = JSON.stringify(cfg, null, 2);
  fs.writeFileSync(cfgPath, data, 'utf8');
  log('OpenClaw configuration updated.');
}

function prompt(question, defaultVal) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`${question} (${defaultVal}): `, (input) => {
      rl.close();
      resolve(input.trim() || defaultVal);
    });
  });
}

async function main() {
  // Verify OpenClaw installation (simple check)
  const openclawPath = path.join(os.homedir(), '.openclaw');
  if (!fs.existsSync(openclawPath)) {
    log('OpenClaw installation not detected. Please install OpenClaw first.');
    process.exit(1);
  }

  const config = loadConfig();
  backupConfig(config);

  const plugins = config.plugins?.entries || {};
  const compaktConfig = plugins.compakt?.config || {};

  const summaryModel = await prompt('Summary model', compaktConfig.summaryModel || 'ollama/qwen3.5-compaction-32k');
  const chunkContextWindowInput = await prompt('Chunk context window (tokens)', compaktConfig.chunkContextWindow || 32768);
  const chunkContextWindow = Number(chunkContextWindowInput);
  if (Number.isNaN(chunkContextWindow)) {
    log('Invalid number for chunk context window: ' + chunkContextWindowInput);
    process.exit(1);
  }
  const chunkOverlapInput = await prompt('Chunk overlap (tokens)', compaktConfig.chunkOverlap || 500);
  const chunkOverlap = Number(chunkOverlapInput);
  if (Number.isNaN(chunkOverlap)) {
    log('Invalid number for chunk overlap: ' + chunkOverlapInput);
    process.exit(1);
  }

  if (!config.plugins) config.plugins = {};
  if (!config.plugins.entries) config.plugins.entries = {};
  config.plugins.entries.compakt = {
    ...config.plugins.entries.compakt,
    config: {
      ...compaktConfig,
      summaryModel,
      chunkContextWindow,
      chunkOverlap,
    },
  };

  saveConfig(config);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});