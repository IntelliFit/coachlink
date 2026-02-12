require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_ANON_KEY
);

async function main() {
  console.log('Fetching recent subscriptions...');
  const { data: subs, error } = await supabase
    .from('coach_subscriptions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2);

  if (error || !subs || subs.length === 0) {
      console.error('Error fetching subs:', error);
      return;
  }

  const latest = subs[0];
  const second = subs[1];

  // 1. Fix Latest Subscription: Set to expire in 30 days (Active state)
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);
  
  console.log(`Updating latest subscription (${latest.id}) to expire on ${nextMonth.toISOString()}...`);
  const { error: err1 } = await supabase
    .from('coach_subscriptions')
    .update({ 
        end_date: nextMonth.toISOString(),
        product_name: latest.product_name || '特惠版测试', // Ensure name exists for UI
        subscribed_weeks: 4
    })
    .eq('id', latest.id);
    
  if (err1) console.error('Error updating latest:', err1);
  else console.log('Latest subscription updated (Active).');

  // 2. Fix Second Subscription: Set to expire yesterday (Expired state)
  if (second) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      console.log(`Updating second subscription (${second.id}) to expire on ${yesterday.toISOString()} (Yesterday)...`);
      const { error: err2 } = await supabase
        .from('coach_subscriptions')
        .update({ 
            end_date: yesterday.toISOString(),
            // status: 'completed', // Optionally mark complete, or let expire logic handle it
            product_name: second.product_name || '过期测试',
            subscribed_weeks: 8
        })
        .eq('id', second.id);

      if (err2) console.error('Error updating second:', err2);
      else console.log('Second subscription updated (Expired).');
  }
}

main();
