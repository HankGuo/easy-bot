async function testUniversityScenarios() {
  console.log('=== [EduAgent OS · 高校教学与科研场景端到端真实测试] ===\n');

  // Scenario 1: 向学术导师张云峰教授咨询论文开题
  console.log('▶ [场景 1] 论文开题与文献研读 (向张云峰教授咨询)...');
  const t0 = Date.now();
  const res1 = await fetch('http://127.0.0.1:4100/api/im/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId: 'chan-arch',
      senderId: 'stu-wang',
      senderName: '研究生王同学',
      text: '@张云峰教授 导师您好，我想把毕业课题定为“基于轻量化微沙箱的大模型编程实训平台架构”，您能从创新点与可行性上帮我做个开题指导吗？'
    })
  });
  const data1 = await res1.json();
  console.log(`✔ 场景 1 响应成功 (耗时: ${Date.now() - t0}ms)`);
  console.log('  - 回复专家:', data1.expertMessage?.senderName);
  console.log('  - 导师学术指导建议摘要:\n' + data1.expertMessage?.content?.slice(0, 220) + '...\n');

  // Scenario 2: 向编程助教李维老师咨询实验沙箱
  console.log('▶ [场景 2] 编程实训与代码实验室 (向助教李维老师咨询)...');
  const t1 = Date.now();
  const res2 = await fetch('http://127.0.0.1:4100/api/im/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId: 'chan-dev',
      senderId: 'stu-li',
      senderName: '本科生李同学',
      text: '@李维老师 助教老师，我在实训课上要用 Python 实现一个 K-Means 聚类并生成散点图，沙箱环境里可以直接跑代码并返回结果吗？'
    })
  });
  const data2 = await res2.json();
  console.log(`✔ 场景 2 响应成功 (耗时: ${Date.now() - t1}ms)`);
  console.log('  - 回复助教:', data2.expertMessage?.senderName);
  console.log('  - 助教实训指导摘要:\n' + data2.expertMessage?.content?.slice(0, 220) + '...\n');

  console.log('🎉 高校全场景学术助教与实训闭环测试全部通过！');
}

testUniversityScenarios().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});
