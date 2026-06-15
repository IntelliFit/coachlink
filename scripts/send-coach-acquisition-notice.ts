import { createClient } from "@supabase/supabase-js";
import { bootstrapEnv } from "./config/bootstrap-env.mjs";

type DbClient = ReturnType<typeof createClient<any>>;

type CoachRow = {
  id: string;
  user_id: string;
  name: string | null;
  status: string | null;
  huifu_open_status: string | null;
  huifu_card_token: string | null;
};

type AdminRow = {
  user_id: string;
};

type Args = {
  execute: boolean;
  readyOnly: boolean;
  coachIds: Set<string>;
  userIds: Set<string>;
};

const NOTICE_CONTENT = [
  "你已经具备正式收学员资格，请尽快完成收学员前的准备。",
  "",
  "建议按这个顺序检查：",
  "1. 在 [订阅设置](/dashboard/pricing) 完成收款账户检查，并配好服务套餐和价格。",
  "2. 在 [学员问卷](/dashboard/questionnaire) 发布一份可用问卷。",
  "3. 在 [计划库](/dashboard/plan-lib) 准备至少 1-2 个可复用计划模板。",
  "4. 完善教练主页和证明材料，然后把主页链接发给潜在学员。",
  "",
  "学员提交问卷并完成订阅后，会进入 [我的学员](/dashboard/students)。请当天查看问卷、确认订单，并发放或调整训练计划。",
].join("\n");

function parseArgs(argv: string[]): Args {
  const args: Args = {
    execute: false,
    readyOnly: false,
    coachIds: new Set(),
    userIds: new Set(),
  };

  for (const raw of argv) {
    if (raw === "--execute") args.execute = true;
    else if (raw === "--ready-only") args.readyOnly = true;
    else if (raw.startsWith("--coach-id=")) {
      raw.slice("--coach-id=".length).split(",").filter(Boolean).forEach((id) => args.coachIds.add(id));
    } else if (raw.startsWith("--user-id=")) {
      raw.slice("--user-id=".length).split(",").filter(Boolean).forEach((id) => args.userIds.add(id));
    }
  }

  return args;
}

function isRealCoach(coach: CoachRow) {
  return !/^E2E Coach/i.test(coach.name || "");
}

function isApprovedCoach(coach: CoachRow) {
  return coach.status === "approved" || coach.status === "active";
}

function isReceivingReady(coach: CoachRow) {
  return coach.huifu_open_status === "opened" && Boolean(coach.huifu_card_token);
}

async function getSystemChatroom(supabase: DbClient, adminUserId: string, userId: string) {
  const members = [adminUserId, userId];
  const { data: existing, error: findError } = await supabase
    .from("chat_rooms")
    .select("id")
    .contains("members", members)
    .maybeSingle();

  if (findError) throw new Error(findError.message);
  if (existing?.id) return existing.id as string;

  const now = new Date().toISOString();
  const { data: created, error: createError } = await supabase
    .from("chat_rooms")
    .insert({
      members,
      type: "private",
      unread_members: [],
      is_archived: false,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (createError || !created?.id) {
    throw new Error(createError?.message || "创建系统聊天室失败");
  }

  return created.id as string;
}

async function sendSystemMessage(
  supabase: DbClient,
  adminUserId: string,
  userId: string,
  content: string,
) {
  const roomId = await getSystemChatroom(supabase, adminUserId, userId);
  const createdAt = new Date().toISOString();

  const { error: insertError } = await supabase
    .from("chat_messages")
    .insert({
      room_id: roomId,
      sender_id: adminUserId,
      message_type: "text",
      content,
      created_at: createdAt,
      content_metadata: {
        system_notice: true,
        notice_type: "coach_student_acquisition",
      },
    });

  if (insertError) throw new Error(insertError.message);

  const { error: updateError } = await supabase
    .from("chat_rooms")
    .update({
      last_message: content,
      last_message_at: createdAt,
      unread_members: [userId],
      updated_at: createdAt,
    })
    .eq("id", roomId);

  if (updateError) throw new Error(updateError.message);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await bootstrapEnv({ mode: "development" });

  const url = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("缺少 NEXT_SUPABASE_URL / NEXT_SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .limit(1)
    .single();

  if (adminError || !(admin as AdminRow | null)?.user_id) {
    throw new Error(adminError?.message || "未找到系统管理员用户");
  }

  const { data: coaches, error: coachesError } = await supabase
    .from("coaches")
    .select("id,user_id,name,status,huifu_open_status,huifu_card_token")
    .order("created_at", { ascending: true });

  if (coachesError) throw new Error(coachesError.message);

  let targets = ((coaches || []) as CoachRow[])
    .filter(isRealCoach)
    .filter(isApprovedCoach);

  if (args.readyOnly) targets = targets.filter(isReceivingReady);
  if (args.coachIds.size > 0) targets = targets.filter((coach) => args.coachIds.has(coach.id));
  if (args.userIds.size > 0) targets = targets.filter((coach) => args.userIds.has(coach.user_id));

  console.log(args.execute ? "EXECUTE: 将发送系统通知" : "DRY RUN: 不会发送系统通知");
  console.log(`目标教练数: ${targets.length}`);
  console.log("");

  for (const coach of targets) {
    console.log(`- ${coach.name || "(未命名教练)"} | coach_id=${coach.id} | user_id=${coach.user_id} | receiving=${isReceivingReady(coach) ? "ready" : "not_ready"}`);
  }

  console.log("");
  console.log("通知内容:");
  console.log("-----");
  console.log(NOTICE_CONTENT);
  console.log("-----");

  if (!args.execute) {
    console.log("");
    console.log("确认无误后执行：npx tsx scripts/send-coach-acquisition-notice.ts --execute");
    console.log("只发给已完成收款账户的教练：npx tsx scripts/send-coach-acquisition-notice.ts --ready-only --execute");
    return;
  }

  let success = 0;
  let failed = 0;
  for (const coach of targets) {
    try {
      await sendSystemMessage(supabase, (admin as AdminRow).user_id, coach.user_id, NOTICE_CONTENT);
      success += 1;
      console.log(`sent: ${coach.name || coach.user_id}`);
    } catch (error) {
      failed += 1;
      console.error(`failed: ${coach.name || coach.user_id}: ${(error as Error).message}`);
    }
  }

  console.log(`发送完成：成功 ${success}，失败 ${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
