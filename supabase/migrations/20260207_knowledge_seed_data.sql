-- Seed data for knowledge_nodes
-- This migration adds sample content for the knowledge base

-- First, alter knowledge_scenarios table to add missing columns
ALTER TABLE knowledge_scenarios ADD COLUMN IF NOT EXISTS solution_steps jsonb;
ALTER TABLE knowledge_scenarios ADD COLUMN IF NOT EXISTS target_body_regions text[];
ALTER TABLE knowledge_scenarios ADD COLUMN IF NOT EXISTS difficulty integer default 1;
ALTER TABLE knowledge_scenarios ADD COLUMN IF NOT EXISTS duration_minutes integer;

-- Insert category nodes under "动作研判标准"
INSERT INTO knowledge_nodes (id, node_type, title, slug, description, icon, is_published, created_at)
VALUES
  (gen_random_uuid(), 'category', '基础动作模式', 'basic-movement-patterns', '人体七大基础运动模式分析', '🏃', true, now()),
  (gen_random_uuid(), 'category', '常见代偿模式', 'compensation-patterns', '识别和纠正常见的动作代偿', '⚠️', true, now()),
  (gen_random_uuid(), 'category', '动作评估要点', 'assessment-key-points', '如何正确评估动作质量', '🔍', true, now());

-- Get the IDs we just created and link to parent
WITH new_categories AS (
  SELECT id, title FROM knowledge_nodes WHERE slug IN ('basic-movement-patterns', 'compensation-patterns', 'assessment-key-points')
),
domain AS (
  SELECT id FROM knowledge_nodes WHERE title = '动作研判标准' LIMIT 1
)
INSERT INTO knowledge_node_closures (ancestor_id, descendant_id, depth)
SELECT 
  domain.id, 
  new_categories.id, 
  1
FROM domain, new_categories
UNION ALL
SELECT 
  new_categories.id, 
  new_categories.id, 
  0
FROM new_categories;

-- Insert category nodes under "评估（训练前置）"
INSERT INTO knowledge_nodes (id, node_type, title, slug, description, icon, is_published, created_at)
VALUES
  (gen_random_uuid(), 'category', '体态评估', 'posture-assessment', '静态体态筛查方法与解读', '🧍', true, now()),
  (gen_random_uuid(), 'category', '动作筛查', 'movement-screening', 'FMS等动作筛查方法', '🏋️', true, now()),
  (gen_random_uuid(), 'category', '肌力测试', 'strength-testing', '各部位肌力评估方法', '💪', true, now());

WITH new_categories AS (
  SELECT id, title FROM knowledge_nodes WHERE slug IN ('posture-assessment', 'movement-screening', 'strength-testing')
),
domain AS (
  SELECT id FROM knowledge_nodes WHERE title LIKE '评估%' LIMIT 1
)
INSERT INTO knowledge_node_closures (ancestor_id, descendant_id, depth)
SELECT 
  domain.id, 
  new_categories.id, 
  1
FROM domain, new_categories
UNION ALL
SELECT 
  new_categories.id, 
  new_categories.id, 
  0
FROM new_categories;

-- Insert category nodes under "训练体系"
INSERT INTO knowledge_nodes (id, node_type, title, slug, description, icon, is_published, created_at)
VALUES
  (gen_random_uuid(), 'category', '力量训练', 'strength-training', '各类力量训练方法与原则', '🏋️‍♂️', true, now()),
  (gen_random_uuid(), 'category', '心肺耐力', 'cardio-endurance', '有氧运动与心肺功能提升', '❤️', true, now()),
  (gen_random_uuid(), 'category', '柔韧性', 'flexibility', '拉伸与柔韧性训练', '🧘', true, now()),
  (gen_random_uuid(), 'category', '稳定性与核心', 'stability-core', '核心稳定与控制训练', '🎯', true, now());

WITH new_categories AS (
  SELECT id, title FROM knowledge_nodes WHERE slug IN ('strength-training', 'cardio-endurance', 'flexibility', 'stability-core')
),
domain AS (
  SELECT id FROM knowledge_nodes WHERE title = '训练体系' LIMIT 1
)
INSERT INTO knowledge_node_closures (ancestor_id, descendant_id, depth)
SELECT 
  domain.id, 
  new_categories.id, 
  1
FROM domain, new_categories
UNION ALL
SELECT 
  new_categories.id, 
  new_categories.id, 
  0
FROM new_categories;

-- Insert some article nodes under categories
-- Articles under "基础动作模式"
INSERT INTO knowledge_nodes (id, node_type, title, slug, description, icon, content, body_region, is_free, is_published, created_at)
VALUES
  (
    gen_random_uuid(), 
    'article', 
    '深蹲模式解析', 
    'squat-pattern-analysis', 
    '深蹲动作的关键要点、常见错误与纠正方法',
    '🦵',
    '{"body": "<h2>深蹲的重要性</h2><p>深蹲是人体最基础的动作模式之一，涉及髋、膝、踝三关节联动。</p><h2>关键要点</h2><ul><li>脊柱保持中立</li><li>膝盖沿脚尖方向</li><li>重心在足中心</li><li>髋膝同时屈曲</li></ul><h2>常见错误</h2><ol><li>膝内扣 - 需加强臀中肌</li><li>脚跟抬起 - 需改善踝关节灵活性</li><li>躯干过度前倾 - 需加强核心稳定</li></ol>", "tags": ["深蹲", "下肢", "基础动作"], "difficulty": 2, "duration_minutes": 8}'::jsonb,
    ARRAY['knee_left', 'knee_right', 'hip_left', 'hip_right'],
    true,
    true,
    now()
  ),
  (
    gen_random_uuid(), 
    'article', 
    '髋铰链模式详解', 
    'hip-hinge-pattern', 
    '硬拉、早安式等髋铰链动作的正确执行方式',
    '🏋️',
    '{"body": "<h2>什么是髋铰链</h2><p>髋铰链是以髋关节为轴心的屈伸运动，是硬拉、壶铃摆动等动作的基础。</p><h2>执行要点</h2><ul><li>保持脊柱中立</li><li>臀部向后推</li><li>膝盖微屈但不主动弯曲</li><li>感受腘绳肌拉伸</li></ul>", "tags": ["硬拉", "髋铰链", "后链"], "difficulty": 3, "duration_minutes": 10}'::jsonb,
    ARRAY['lower_back', 'hip_left', 'hip_right'],
    true,
    true,
    now()
  );

-- Link articles to their parent category
WITH articles AS (
  SELECT id FROM knowledge_nodes WHERE slug IN ('squat-pattern-analysis', 'hip-hinge-pattern')
),
category AS (
  SELECT id FROM knowledge_nodes WHERE slug = 'basic-movement-patterns' LIMIT 1
)
INSERT INTO knowledge_node_closures (ancestor_id, descendant_id, depth)
SELECT 
  category.id, 
  articles.id, 
  1
FROM category, articles
UNION ALL
SELECT 
  articles.id, 
  articles.id, 
  0
FROM articles;

-- Articles under "体态评估"
INSERT INTO knowledge_nodes (id, node_type, title, slug, description, icon, content, body_region, is_free, is_published, created_at)
VALUES
  (
    gen_random_uuid(), 
    'article', 
    '上交叉综合征评估', 
    'upper-cross-syndrome', 
    '识别圆肩驼背等上交叉综合征的方法',
    '🔄',
    '{"body": "<h2>什么是上交叉综合征</h2><p>上交叉综合征是由肌肉失衡导致的姿势问题，表现为圆肩、头前伸、驼背等。</p><h2>肌肉失衡模式</h2><ul><li><strong>紧张肌群:</strong> 胸大肌、上斜方肌、肩胛提肌、斜角肌</li><li><strong>弱化肌群:</strong> 深层颈屈肌、下斜方肌、菱形肌、前锯肌</li></ul><h2>评估方法</h2><ol><li>侧面观察耳垂与肩峰的位置关系</li><li>观察胸椎弧度</li><li>评估肩胛骨位置</li></ol>", "tags": ["体态", "上交叉", "圆肩"], "difficulty": 2, "duration_minutes": 6}'::jsonb,
    ARRAY['neck', 'shoulder_left', 'shoulder_right', 'chest', 'upper_back'],
    true,
    true,
    now()
  ),
  (
    gen_random_uuid(), 
    'article', 
    '下交叉综合征评估', 
    'lower-cross-syndrome', 
    '骨盆前倾、腰椎过度前凸的识别与评估',
    '🔄',
    '{"body": "<h2>什么是下交叉综合征</h2><p>下交叉综合征表现为骨盆前倾、腰椎过度前凸、腹部突出等。</p><h2>肌肉失衡模式</h2><ul><li><strong>紧张肌群:</strong> 髂腰肌、竖脊肌、股直肌</li><li><strong>弱化肌群:</strong> 腹肌、臀大肌</li></ul><h2>评估方法</h2><ol><li>Thomas测试评估髂腰肌</li><li>仰卧位观察腰椎与地面距离</li><li>站立位评估骨盆倾斜角度</li></ol>", "tags": ["体态", "下交叉", "骨盆前倾"], "difficulty": 2, "duration_minutes": 6}'::jsonb,
    ARRAY['lower_back', 'hip_left', 'hip_right', 'core'],
    true,
    true,
    now()
  );

WITH articles AS (
  SELECT id FROM knowledge_nodes WHERE slug IN ('upper-cross-syndrome', 'lower-cross-syndrome')
),
category AS (
  SELECT id FROM knowledge_nodes WHERE slug = 'posture-assessment' LIMIT 1
)
INSERT INTO knowledge_node_closures (ancestor_id, descendant_id, depth)
SELECT 
  category.id, 
  articles.id, 
  1
FROM category, articles
UNION ALL
SELECT 
  articles.id, 
  articles.id, 
  0
FROM articles;

-- Articles under "柔韧性"
INSERT INTO knowledge_nodes (id, node_type, title, slug, description, icon, content, body_region, is_free, is_published, created_at)
VALUES
  (
    gen_random_uuid(), 
    'article', 
    '髋关节灵活性训练', 
    'hip-mobility-training', 
    '改善髋关节活动度的训练方法',
    '🧘',
    '{"body": "<h2>髋关节灵活性的重要性</h2><p>髋关节是人体最大的球窝关节，其灵活性直接影响下肢运动表现和腰椎健康。</p><h2>推荐训练</h2><ul><li>90/90 髋关节拉伸</li><li>蛙式伸展</li><li>髂腰肌拉伸</li><li>髋关节旋转</li></ul><h2>训练频率</h2><p>建议每天进行5-10分钟的髋关节灵活性训练，特别是久坐人群。</p>", "tags": ["髋关节", "灵活性", "拉伸"], "difficulty": 1, "duration_minutes": 10}'::jsonb,
    ARRAY['hip_left', 'hip_right', 'lower_back'],
    true,
    true,
    now()
  ),
  (
    gen_random_uuid(), 
    'article', 
    '肩关节活动度改善', 
    'shoulder-mobility', 
    '针对肩关节僵硬的活动度训练',
    '💪',
    '{"body": "<h2>肩关节结构特点</h2><p>肩关节是人体活动度最大的关节，但稳定性相对较差，需要肌肉平衡来维持。</p><h2>常见问题</h2><ul><li>肩内旋过紧</li><li>肩外旋不足</li><li>肩屈受限</li></ul><h2>改善方法</h2><ol><li>胸椎灵活性训练</li><li>肩袖肌群激活</li><li>胸小肌拉伸</li><li>过顶伸展</li></ol>", "tags": ["肩关节", "活动度", "上肢"], "difficulty": 2, "duration_minutes": 8}'::jsonb,
    ARRAY['shoulder_left', 'shoulder_right', 'upper_back', 'chest'],
    true,
    true,
    now()
  );

WITH articles AS (
  SELECT id FROM knowledge_nodes WHERE slug IN ('hip-mobility-training', 'shoulder-mobility')
),
category AS (
  SELECT id FROM knowledge_nodes WHERE slug = 'flexibility' LIMIT 1
)
INSERT INTO knowledge_node_closures (ancestor_id, descendant_id, depth)
SELECT 
  category.id, 
  articles.id, 
  1
FROM category, articles
UNION ALL
SELECT 
  articles.id, 
  articles.id, 
  0
FROM articles;

-- Insert sample scenarios into knowledge_scenarios
INSERT INTO knowledge_scenarios (id, title, slug, description, icon, solution_steps, target_body_regions, difficulty, duration_minutes, is_published, created_at)
VALUES
  (
    gen_random_uuid(),
    '办公族肩颈救星',
    'office-neck',
    '久坐办公后的肩颈放松方案，5分钟快速缓解',
    '💼',
    '[
      {"order": 1, "title": "颈部前后屈伸", "description": "轻轻低头，下巴靠近胸口，保持3秒；然后慢慢抬头向后仰，保持3秒", "duration_seconds": 30},
      {"order": 2, "title": "颈部左右侧屈", "description": "左耳尽量靠近左肩，保持15秒；换右侧重复", "duration_seconds": 30},
      {"order": 3, "title": "颈部旋转", "description": "缓慢顺时针转动头部一圈，再逆时针转动一圈", "duration_seconds": 30},
      {"order": 4, "title": "耸肩放松", "description": "双肩尽量向上耸，保持5秒后放松，重复5次", "duration_seconds": 30},
      {"order": 5, "title": "肩部环绕", "description": "双臂自然下垂，肩部向前画圈5次，再向后画圈5次", "duration_seconds": 30},
      {"order": 6, "title": "胸椎伸展", "description": "双手交叉放头后，胸部向上挺起，眼睛看天花板，保持10秒", "duration_seconds": 30}
    ]'::jsonb,
    ARRAY['neck', 'shoulder_left', 'shoulder_right', 'upper_back'],
    1,
    5,
    true,
    now()
  ),
  (
    gen_random_uuid(),
    '久坐腰痛缓解',
    'sitting-back',
    '针对久坐导致的腰背不适，站立或坐姿均可完成',
    '🪑',
    '[
      {"order": 1, "title": "骨盆前后倾", "description": "坐姿，交替做骨盆前倾（翘臀）和后倾（收腹）动作，各10次", "duration_seconds": 60},
      {"order": 2, "title": "猫牛式伸展", "description": "双手撑地，交替做拱背（猫式）和塌腰（牛式），各8次", "duration_seconds": 60},
      {"order": 3, "title": "坐姿扭转", "description": "坐姿，右手放左膝外侧，左手放身后，扭转躯干15秒；换边重复", "duration_seconds": 60},
      {"order": 4, "title": "髋屈肌拉伸", "description": "弓步位，后腿膝盖着地，前推髋部感受大腿前侧拉伸，每侧30秒", "duration_seconds": 60},
      {"order": 5, "title": "仰卧抱膝", "description": "仰卧，双手抱膝拉向胸口，保持30秒", "duration_seconds": 30},
      {"order": 6, "title": "腿部交叉拉伸", "description": "仰卧，右脚踝放左膝上，双手抱左大腿拉向胸口，每侧30秒", "duration_seconds": 60}
    ]'::jsonb,
    ARRAY['lower_back', 'hip_left', 'hip_right', 'core'],
    1,
    6,
    true,
    now()
  ),
  (
    gen_random_uuid(),
    '跑步后拉伸',
    'post-run',
    '跑步训练后的下肢放松与恢复方案',
    '🏃',
    '[
      {"order": 1, "title": "股四头肌拉伸", "description": "站立单腿后勾，手抓脚踝拉向臀部，每侧30秒", "duration_seconds": 60},
      {"order": 2, "title": "腘绳肌拉伸", "description": "单腿前伸脚跟着地，身体前倾感受大腿后侧拉伸，每侧30秒", "duration_seconds": 60},
      {"order": 3, "title": "小腿拉伸", "description": "面墙弓步，后腿伸直脚跟着地，前推身体，每侧30秒", "duration_seconds": 60},
      {"order": 4, "title": "髂胫束放松", "description": "站立交叉腿，向外侧侧身延展，每侧30秒", "duration_seconds": 60},
      {"order": 5, "title": "髋屈肌拉伸", "description": "弓步跪姿，前推髋部，每侧45秒", "duration_seconds": 90},
      {"order": 6, "title": "臀肌拉伸", "description": "坐姿4字腿，身体前倾，每侧45秒", "duration_seconds": 90}
    ]'::jsonb,
    ARRAY['knee_left', 'knee_right', 'hip_left', 'hip_right', 'ankle_left', 'ankle_right'],
    1,
    8,
    true,
    now()
  ),
  (
    gen_random_uuid(),
    '睡前放松',
    'bedtime',
    '帮助放松身心，提高睡眠质量的轻柔伸展',
    '😴',
    '[
      {"order": 1, "title": "颈部放松", "description": "缓慢转动头部，左右各5圈", "duration_seconds": 60},
      {"order": 2, "title": "肩部放松", "description": "耸肩保持5秒后放松，重复8次", "duration_seconds": 60},
      {"order": 3, "title": "婴儿式", "description": "跪坐，双臂向前延伸趴下，放松呼吸1分钟", "duration_seconds": 90},
      {"order": 4, "title": "仰卧扭转", "description": "仰卧，双膝并拢倒向一侧，保持30秒换边", "duration_seconds": 90},
      {"order": 5, "title": "仰卧蝴蝶式", "description": "仰卧，脚底相对，膝盖自然外展，放松1分钟", "duration_seconds": 90},
      {"order": 6, "title": "腿靠墙", "description": "仰卧双腿靠墙垂直向上，放松呼吸2分钟", "duration_seconds": 120}
    ]'::jsonb,
    ARRAY['neck', 'shoulder_left', 'shoulder_right', 'lower_back', 'hip_left', 'hip_right'],
    1,
    10,
    true,
    now()
  );
