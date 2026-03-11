/**
 * 查询指定用户的模板及其使用的动作
 * 用法: tsx scripts/check-user-templates-actions.ts
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_ANON_KEY
);

interface TemplateInfo {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  actionIds: Set<string>;
  actionCount: number;
}

interface ActionUsage {
  actionId: string;
  actionName: string;
  usedInTemplates: string[];
  usageCount: number;
}

async function main() {
  const searchPhone = '18115072586';
  const searchNickname = '枭马葛';

  console.log(`\n🔍 查找用户: ${searchNickname} (${searchPhone})\n`);

  // 1. 查找用户
  let userId: string | null = null;
  let userInfo: any = null;

  // 先通过手机号查找
  const { data: userByPhone, error: phoneError } = await supabase
    .from('users')
    .select('id, phone, email, created_at')
    .eq('phone', searchPhone)
    .maybeSingle();

  if (userByPhone) {
    userId = userByPhone.id;
    userInfo = userByPhone;
    console.log(`✅ 通过手机号找到用户: ${userByPhone.id}`);
  } else {
    // 通过昵称查找
    const { data: profileByNickname, error: nicknameError } = await supabase
      .from('user_profiles')
      .select('user_id, nickname, full_name')
      .ilike('nickname', `%${searchNickname}%`)
      .limit(5);

    if (profileByNickname && profileByNickname.length > 0) {
      if (profileByNickname.length === 1) {
        userId = profileByNickname[0].user_id;
        const { data: user } = await supabase
          .from('users')
          .select('id, phone, email, created_at')
          .eq('id', userId)
          .single();
        userInfo = user;
        console.log(`✅ 通过昵称找到用户: ${userId}`);
      } else {
        console.log(`⚠️ 找到多个匹配的用户:`);
        profileByNickname.forEach(p => {
          console.log(`  - ${p.user_id}: ${p.nickname} (${p.full_name || ''})`);
        });
        // 使用第一个
        userId = profileByNickname[0].user_id;
        const { data: user } = await supabase
          .from('users')
          .select('id, phone, email, created_at')
          .eq('id', userId)
          .single();
        userInfo = user;
        console.log(`\n使用第一个用户: ${userId}\n`);
      }
    }
  }

  if (!userId) {
    console.error('❌ 未找到用户');
    return;
  }

  console.log(`\n用户信息:`);
  console.log(`  ID: ${userInfo.id}`);
  console.log(`  手机号: ${userInfo.phone || '未设置'}`);
  console.log(`  邮箱: ${userInfo.email || '未设置'}`);
  console.log(`  创建时间: ${userInfo.created_at}\n`);

  // 2. 查找该用户创建的模板
  const { data: templates, error: templatesError } = await supabase
    .from('coach_plan_templates')
    .select('id, name, description, created_at, training_days')
    .eq('coach_id', userId)
    .order('created_at', { ascending: false });

  if (templatesError) {
    console.error('❌ 查询模板失败:', templatesError);
    return;
  }

  if (!templates || templates.length === 0) {
    console.log('📭 该用户没有创建任何模板');
    return;
  }

  console.log(`\n📚 找到 ${templates.length} 个模板:\n`);

  // 3. 分析每个模板使用的动作
  const templateInfos: TemplateInfo[] = [];
  const allActionIds = new Set<string>();

  for (const template of templates) {
    const actionIds = new Set<string>();
    let trainingDays: any[] = [];

    // 解析 training_days
    try {
      trainingDays = typeof template.training_days === 'string'
        ? JSON.parse(template.training_days)
        : (template.training_days || []);
    } catch (e) {
      console.warn(`⚠️ 模板 ${template.id} 的 training_days 解析失败`);
      continue;
    }

    // 提取所有 action_id
    for (const day of trainingDays) {
      if (Array.isArray(day.actionSets)) {
        for (const set of day.actionSets) {
          const actionId = set.action_id || set.actionId;
          if (actionId) {
            actionIds.add(actionId);
            allActionIds.add(actionId);
          }
        }
      }
    }

    templateInfos.push({
      id: template.id,
      name: template.name,
      description: template.description,
      created_at: template.created_at,
      actionIds,
      actionCount: actionIds.size,
    });
  }

  // 4. 显示模板列表
  templateInfos.forEach((tpl, idx) => {
    console.log(`${idx + 1}. ${tpl.name}`);
    console.log(`   ID: ${tpl.id}`);
    console.log(`   描述: ${tpl.description || '无'}`);
    console.log(`   创建时间: ${tpl.created_at}`);
    console.log(`   使用动作数: ${tpl.actionCount}`);
    console.log('');
  });

  // 5. 查询所有动作的详细信息
  if (allActionIds.size === 0) {
    console.log('📭 所有模板中都没有使用任何动作');
    return;
  }

  console.log(`\n🎯 共使用了 ${allActionIds.size} 个不同的动作\n`);

  const actionIdsList = Array.from(allActionIds);

  // 查询教练动作库
  const { data: coachActions, error: coachActionsError } = await supabase
    .from('coach_actions')
    .select('id, name, type, detail, url, positions, attrs, enableAutoWeightCompute, includesBodyWeight')
    .in('id', actionIdsList)
    .eq('coach_id', userId);

  // 查询学员动作库（可能有些动作是学员创建的）
  const { data: studentActions, error: studentActionsError } = await supabase
    .from('student_actions')
    .select('id, name, type, detail, url, positions, attrs')
    .in('id', actionIdsList)
    .eq('user_id', userId);

  const actionsMap = new Map<string, any>();

  if (coachActions) {
    coachActions.forEach(action => {
      actionsMap.set(action.id, { ...action, source: 'coach_actions' });
    });
  }

  if (studentActions) {
    studentActions.forEach(action => {
      if (!actionsMap.has(action.id)) {
        actionsMap.set(action.id, { ...action, source: 'student_actions' });
      }
    });
  }

  // 6. 统计每个动作在哪些模板中被使用
  const actionUsageMap = new Map<string, ActionUsage>();

  for (const actionId of actionIdsList) {
    const action = actionsMap.get(actionId);
    const usedInTemplates: string[] = [];

    templateInfos.forEach(tpl => {
      if (tpl.actionIds.has(actionId)) {
        usedInTemplates.push(tpl.name);
      }
    });

    actionUsageMap.set(actionId, {
      actionId,
      actionName: action?.name || '未知动作（可能已删除）',
      usedInTemplates,
      usageCount: usedInTemplates.length,
    });
  }

  // 7. 按使用频率排序并显示
  const actionUsageList = Array.from(actionUsageMap.values())
    .sort((a, b) => b.usageCount - a.usageCount);

  console.log('📊 动作使用统计:\n');
  actionUsageList.forEach((usage, idx) => {
    const action = actionsMap.get(usage.actionId);
    const source = action?.source === 'coach_actions' ? '教练动作库' : '学员动作库';
    const type = action?.type || '未知';
    const hasVideo = !!(action?.url || action?.video_url);
    const hasDetail = !!action?.detail;

    console.log(`${idx + 1}. ${usage.actionName}`);
    console.log(`   ID: ${usage.actionId}`);
    console.log(`   类型: ${type}`);
    console.log(`   来源: ${source}`);
    console.log(`   使用次数: ${usage.usageCount} 个模板`);
    console.log(`   使用的模板: ${usage.usedInTemplates.join(', ')}`);
    if (hasVideo) {
      console.log(`   ✅ 有视频链接`);
    }
    if (hasDetail) {
      console.log(`   ✅ 有详细说明`);
    }
    if (action?.enableAutoWeightCompute) {
      console.log(`   ✅ 启用自动重量计算`);
    }
    if (action?.includesBodyWeight) {
      console.log(`   ✅ 包含自重`);
    }
    console.log('');
  });

  // 8. 检查是否有已删除的动作
  const missingActions = actionIdsList.filter(id => !actionsMap.has(id));
  if (missingActions.length > 0) {
    console.log(`\n⚠️ 警告: 发现 ${missingActions.length} 个已删除的动作（模板中仍引用）:\n`);
    missingActions.forEach(actionId => {
      const usedIn = templateInfos
        .filter(tpl => tpl.actionIds.has(actionId))
        .map(tpl => tpl.name);
      console.log(`  - ${actionId}`);
      console.log(`    使用的模板: ${usedIn.join(', ')}`);
    });
    console.log('');
  }

  // 9. 汇总
  console.log('\n📈 汇总:');
  console.log(`  模板总数: ${templates.length}`);
  console.log(`  使用的动作总数: ${allActionIds.size}`);
  console.log(`  已删除的动作: ${missingActions.length}`);
  console.log(`  有效动作: ${allActionIds.size - missingActions.length}`);
}

main().catch(console.error);
