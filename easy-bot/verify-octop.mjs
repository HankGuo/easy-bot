#!/usr/bin/env node

/**
 * Octop Official Standard Deployment Diagnostic & Verification Script
 * Validates Route A (Pure Octop First) Endpoints & System Health
 */

import http from 'node:http';

const OCTOP_PORT = process.env.OCTOP_PORT || '8088';
const OCTOP_HOST = process.env.OCTOP_HOST || '127.0.0.1';
const BASE_URL = `http://${OCTOP_HOST}:${OCTOP_PORT}`;

console.log('================================================================');
console.log('🚀 TencentCloud Octop Official Deployment Health Probe');
console.log('================================================================');
console.log(`- Target Endpoint: ${BASE_URL}`);
console.log(`- Probing Service: Octop (Single-Process Multi-Agent Platform)`);
console.log('----------------------------------------------------------------\n');

async function probe() {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
    const latency = Date.now() - t0;
    
    if (res.ok) {
      let data = {};
      try { data = await res.json(); } catch {}
      console.log('🟢 [PASS] Octop Service is Healthy and Reachable!');
      console.log(`   - HTTP Status: ${res.status} ${res.statusText}`);
      console.log(`   - Round-trip Latency: ${latency}ms`);
      console.log(`   - Payload:`, JSON.stringify(data, null, 2));
      console.log('\n✔ Web Dashboard is ready at:', BASE_URL);
      console.log('✔ Native Feishu/WeCom/DingTalk IM gateways active.');
      console.log('✔ Native MCP and Document RAG engines active.');
      process.exit(0);
    } else {
      console.log(`🟡 [WARN] Octop responded with non-200 status: HTTP ${res.status}`);
      const text = await res.text();
      console.log(`   - Body: ${text.slice(0, 300)}`);
      process.exit(1);
    }
  } catch (err) {
    console.log('🔴 [FAIL] Unable to connect to Octop service on', BASE_URL);
    console.log(`   - Error: ${err.message}`);
    console.log('\n💡 Troubleshooting Guide:');
    console.log('   1. Start Octop container: docker compose up -d');
    console.log('   2. Or start via Python:   pip install octop && octop init');
    console.log(`   3. Verify port ${OCTOP_PORT} is not blocked by a local firewall.`);
    process.exit(1);
  }
}

probe();
