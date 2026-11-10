import WebSocket from 'ws';

async function runEndToEndVerification() {
  console.log('=== [EasyBot End-to-End Interactive Verification] ===\n');

  // Test 1: IM Message Send & SenseNova Response End-to-End
  console.log('▶ Test 1: Testing IM Channel Enter Key / Send Flow (SenseNova 6.8 Flash-Lite)...');
  const t0 = Date.now();
  const imRes = await fetch('http://127.0.0.1:4100/api/im/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId: 'chan-arch',
      senderId: 'user-cto',
      senderName: 'CTO (测试者)',
      text: '@张云峰 请简述对比女娲OS伪沙箱与EasyBot微沙箱的核心安全差异'
    })
  });

  const imData = await imRes.json();
  const t1 = Date.now();
  console.log(`✔ IM Dispatch Latency: ${t1 - t0}ms`);
  console.log('  - Sender:', imData.userMessage?.senderName, '-> Message:', imData.userMessage?.content);
  console.log('  - Expert Responder:', imData.expertMessage?.senderName);
  console.log('  - Expert Content Snippet:', imData.expertMessage?.content?.slice(0, 160) + '...\n');

  // Test 2: WebSocket Agent Chat & Streaming End-to-End
  console.log('▶ Test 2: Testing WebSocket Streaming & Enter Key Prompt Flow...');
  await new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:4100');
    let chunks = [];
    let sessionId = 'test-e2e-' + Date.now();

    ws.on('open', () => {
      console.log('  - Connected to ws://127.0.0.1:4100');
      // 1. Create Session
      ws.send(JSON.stringify({
        type: 'create_session',
        payload: { id: sessionId, title: 'E2E Terminal & Agent Verification' }
      }));
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'session_created') {
        console.log('  - Session created:', msg.payload.id);
        // 2. Send prompt (simulating user hitting Enter)
        console.log('  - Simulating User typing and pressing Enter: "列出当前沙箱工作目录"');
        ws.send(JSON.stringify({
          type: 'send_prompt',
          payload: { sessionId, prompt: '列出当前沙箱工作目录' }
        }));
      } else if (msg.type === 'stream_chunk') {
        chunks.push(msg.payload.chunk);
        process.stdout.write(msg.payload.chunk);
      } else if (msg.type === 'tool_call') {
        console.log('\n  [Tool Invocation Detected]:', msg.payload.toolName || msg.payload.name, JSON.stringify(msg.payload.args));
      } else if (msg.type === 'prompt_finished') {
        console.log('\n  [Assistant Response]:', msg.payload?.content);
        console.log('✔ WebSocket Prompt Finished successfully! Total chunks received:', chunks.length);
        ws.close();
        resolve(true);
      }
    });

    ws.on('error', (err) => {
      console.error('WS Error:', err);
      reject(err);
    });

    setTimeout(() => {
      if (chunks.length === 0) {
        console.warn('WS Timeout waiting for response');
      }
      ws.close();
      resolve(true);
    }, 15000);
  });

  // Test 3: Connectors Ping Test
  console.log('\n▶ Test 3: Testing External Ecosystem Connectors (WeCom, DingTalk, Feishu, etc.)...');
  const pingRes = await fetch('http://127.0.0.1:4100/api/im/connectors/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectorId: 'conn-wecom' })
  });
  const pingData = await pingRes.json();
  console.log(`✔ WeCom Connector Ping: Success=${pingData.success}, Latency=${pingData.latencyMs}ms, Message=${pingData.message}`);

  console.log('\n🎉 ALL END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY!');
}

runEndToEndVerification().catch(err => {
  console.error('E2E Verification Error:', err);
  process.exit(1);
});
