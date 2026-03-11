import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.development" });

const supabaseUrl = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(
    supabaseUrl,
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey,
);

async function checkOrders() {
    console.log("Checking latest Alipay orders...");
    const { data: orders, error } = await supabaseAdmin
        .from("alipay_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);

    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }

    console.log("Found orders:", orders.length);
    orders.forEach((o) => {
        console.log(`ORDER_ID:${o.id}`);
        console.log(`STATUS:${o.status}`);
        console.log(`TYPE:${o.order_type}`);
        console.log(`DATA:${JSON.stringify(o.order_data)}`);
        console.log("---");
    });

    // Also check memberships
    console.log("\nChecking student_memberships...");
    const { data: memberships, error: mErr } = await supabaseAdmin
        .from("student_memberships")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);

    if (mErr) {
        console.error("Membership check error:", mErr);
    } else {
        memberships?.forEach((m) => {
            console.log(
                `USER:${m.user_id}, TIER:${m.tier}, STATUS:${m.status}`,
            );
        });
    }
}

checkOrders();
