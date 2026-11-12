import test, { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { SkillLoader, SkillDefinition } from '../core/skill-loader.js';

describe('Unit Test: SkillLoader Package Discovery & Manifest Parser', () => {
  let testSkillsDir: string;

  beforeEach(() => {
    testSkillsDir = path.join(process.cwd(), 'workspace', 'test_skills_' + Date.now() + Math.random().toString(36).slice(2, 6));
  });

  it('14.1 should initialize directory and seed default industrial skills', () => {
    const loader = new SkillLoader(testSkillsDir);
    assert.ok(fs.existsSync(testSkillsDir));

    const skills = loader.listSkills();
    assert.ok(skills.length >= 3);
    assert.ok(skills.some(s => s.id === 'vibecoding-fullstack'));
    assert.ok(skills.some(s => s.id === 'enterprise-security-auditor'));
    assert.ok(skills.some(s => s.id === 'weknora-hybrid-researcher'));
  });

  it('14.2 should retrieve specific default skill by ID and verify schema', () => {
    const loader = new SkillLoader(testSkillsDir);
    const auditor = loader.getSkill('enterprise-security-auditor');

    assert.ok(auditor);
    assert.equal(auditor?.name, '企业级代码审计与合规卫士');
    assert.ok(auditor?.toolsRequired.includes('workspace_shell_execute'));
    assert.ok(auditor?.systemPrompt.includes('企业级网安审计专家'));
    assert.equal(auditor?.author, 'EasyBot Security Lab');
  });

  it('14.3 should dynamically load custom skill JSON placed into directory', () => {
    const loader = new SkillLoader(testSkillsDir);

    const customSkill: SkillDefinition = {
      id: 'custom-welding-inspector',
      name: '工业焊接探伤分析专家',
      description: '分析超声探伤波形并判定焊缝裂纹',
      version: '1.0.0',
      author: 'Automotive Mfg Lab',
      tags: ['Ultrasonic', 'Welding', 'DefectInspection'],
      toolsRequired: ['workspace_file_read', 'hybrid_rag_query'],
      systemPrompt: '你是焊接缺陷无损检测专家。'
    };

    fs.writeFileSync(
      path.join(testSkillsDir, `${customSkill.id}.json`),
      JSON.stringify(customSkill, null, 2),
      'utf-8'
    );

    const refreshed = loader.loadAllSkills();
    assert.ok(refreshed.some(s => s.id === 'custom-welding-inspector'));

    const fetched = loader.getSkill('custom-welding-inspector');
    assert.equal(fetched?.name, '工业焊接探伤分析专家');
  });

  it('14.4 should gracefully handle corrupted or non-JSON files in skills folder', () => {
    const loader = new SkillLoader(testSkillsDir);

    // Create a corrupted JSON file
    fs.writeFileSync(path.join(testSkillsDir, 'corrupt.json'), '{ invalid json string ...', 'utf-8');
    // Create a non-JSON file
    fs.writeFileSync(path.join(testSkillsDir, 'notes.txt'), 'random notes', 'utf-8');

    // Should not throw
    const skills = loader.loadAllSkills();
    assert.ok(skills.length >= 3);
    assert.equal(loader.getSkill('corrupt'), undefined);
  });

  it('14.5 should return undefined when querying non-existent skill ID', () => {
    const loader = new SkillLoader(testSkillsDir);
    assert.equal(loader.getSkill('unknown_skill_999'), undefined);
  });
});
