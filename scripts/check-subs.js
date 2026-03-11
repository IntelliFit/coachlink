require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_ANON_KEY
);

async function main() {
  console.log('Checking recent subscriptions...');
  const { data, error } = await supabase
    .from('coach_subscriptions')
    .select('id, start_date, end_date, status, tier, product_name, subscribed_weeks')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Recent Subscriptions:');
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
