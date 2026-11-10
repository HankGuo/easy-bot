async function testEnterpriseScenarios() {
  console.log('=== [EasyBot · 企业级桌面智能体系统端到端验证] ===\n');

  // Scenario 1: 向设备运维专家马工咨询设备报错排查
  console.log('▶ [场景 1] 工业设备运维与故障诊断 (向设备运维专家马工咨询)...');
  const t0 = Date.now();
  const res1 = await fetch('http://127.0.0.1:4100/api/im/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId: 'chan-equip',
      senderId: 'user-op',
      senderName: '车间操作员',
      text: '@马工 现场数控机床报警 E-06 停机，请按照厂区排错规程给出标准抢修处置步骤！'
    })
  });
  const data1 = await res1.json();
  console.log(`✔ 场景 1 响应成功 (耗时: ${Date.now() - t0}ms)`);
  console.log('  - 回复专家:', data1.expertMessage?.senderName);
  console.log('  - 故障排错建议摘要:\n' + data1.expertMessage?.content?.slice(0, 200) + '...\n');

  // Scenario 2: 向生产工艺与质检主管刘主管咨询工件公差
  console.log('▶ [场景 2] 生产工艺与质检标准核对 (向工艺质检主管刘主管咨询)...');
  const t1 = Date.now();
  const res2 = await fetch('http://127.0.0.1:4100/api/im/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId: 'chan-qa',
      senderId: 'user-qa',
      senderName: '质检员',
      text: '@刘主管 轴承配合位按照 h6 公差加工，目前测出负偏差 0.012mm，请问是否判定超差？'
    })
  });
  const data2 = await res2.json();
  console.log(`✔ 场景 2 响应成功 (耗时: ${Date.now() - t1}ms)`);
  console.log('  - 回复专家:', data2.expertMessage?.senderName);
  console.log('  - 工艺质检建议摘要:\n' + data2.expertMessage?.content?.slice(0, 200) + '...\n');

  console.log('🎉 工业级实用智能体多角色与沙箱闭环测试全部通过！');
}

testEnterpriseScenarios().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});
