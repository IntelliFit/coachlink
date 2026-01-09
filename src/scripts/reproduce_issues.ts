import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";

// Load .env.local from project root
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const supabaseUrl = process.env.NEXT_SUPABASE_URL || "";
const supabaseServiceKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing env vars");
    console.error("URL:", supabaseUrl ? "Set" : "Missing");
    console.error("Key:", supabaseServiceKey ? "Set" : "Missing");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log("--- Checking for Duplicates ---");
    // 1. Check for duplicates
    const { data: actions, error } = await supabase
        .from("coach_actions")
        .select("id, name, coach_id");

    if (error) {
        console.error("Error fetching actions", error);
        return;
    }

    const nameMap = new Map<string, number>();
    actions?.forEach((a: any) => {
        const key = `${a.coach_id}:${a.name}`;
        nameMap.set(key, (nameMap.get(key) || 0) + 1);
    });

    const duplicates = Array.from(nameMap.entries()).filter(([k, v]) => v > 1);
    console.log(`Found ${duplicates.length} sets of duplicates.`);

    let foundTargetDuplicate = false;
    duplicates.forEach(([k, v]) => {
        if (k.includes("引体")) {
            console.log(`Duplicate found: ${k} (Count: ${v})`);
            foundTargetDuplicate = true;
        }
    });
    if (!foundTargetDuplicate && duplicates.length > 0) {
        console.log("First 5 duplicates:", duplicates.slice(0, 5));
    }

    console.log("\n--- Testing Search ---");
    // 2. Test Search
    const searchTerm = "引体";
    const { data: searchResults, error: searchError } = await supabase
        .from("coach_actions")
        .select("id, name")
        .or(`name.ilike.%${searchTerm}%,detail.ilike.%${searchTerm}%`)
        .limit(10);

    if (searchError) {
        console.error("Search error", searchError);
    } else {
        console.log(
            `Search for '${searchTerm}' found ${searchResults?.length} results.`,
        );
        console.log("Results:");
        searchResults?.forEach((r: any) => console.log(` - ${r.name}`));
    }
}

main();
