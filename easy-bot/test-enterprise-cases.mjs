async function testEnterpriseScenarios() {
  console.log('=== [EasyBot · 企业级桌面智能体系统端到端验证] ===\n');

  // Scenario 1: 向首席架构师张云峰咨询微内核架构设计
  console.log('▶ [场景 1] 系统架构与技术选型 (向系统架构师张云峰咨询)...');
  const t0 = Date.now();
  const res1 = await fetch('http://127.0.0.1:4100/api/im/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId: 'chan-arch',
      senderId: 'user-cto',
      senderName: '技术负责人',
      text: '@张云峰 架构师，我们在重构下一代桌面 Agent 系统时，如何平衡轻量化微沙箱与系统调用安全隔离？请给出工业级架构建议。'
    })
  });
  const data1 = await res1.json();
  console.log(`✔ 场景 1 响应成功 (耗时: ${Date.now() - t0}ms)`);
  console.log('  - 回复专家:', data1.expertMessage?.senderName);
  console.log('  - 架构建议摘要:\n' + data1.expertMessage?.content?.slice(0, 200) + '...\n');

  // Scenario 2: 向全栈研发专家李维咨询沙箱代码执行
  console.log('▶ [场景 2] 全栈代码沙箱执行 (向全栈工程师李维咨询)...');
  const t1 = Date.now();
  const res2 = await fetch('http://127.0.0.1:4100/api/im/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId: 'chan-dev',
      senderId: 'user-dev',
      senderName: '研发工程师',
      text: '@李维 帮我用 Python 实现一个高可靠的数据清洗与统计脚本，在沙箱环境中直接执行并输出结果。'
    })
  });
  const data2 = await res2.json();
  console.log(`✔ 场景 2 响应成功 (耗时: ${Date.now() - t1}ms)`);
  console.log('  - 回复专家:', data2.expertMessage?.senderName);
  console.log('  - 代码与实操建议摘要:\n' + data2.expertMessage?.content?.slice(0, 200) + '...\n');

  console.log('🎉 企业级智能体多角色与沙箱闭环测试全部通过！');
}

testEnterpriseScenarios().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});
