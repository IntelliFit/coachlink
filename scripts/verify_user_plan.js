
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.development');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env.development:', result.error);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key in env');
  console.log('URL:', supabaseUrl);
  console.log('Key:', supabaseKey ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);




const fs = require('fs');

async function checkUserPlan() {
  const result = {
      user: null,
      subscriptions: [],
      plans: [],
      executions: []
  };


  console.log('Searching for user 17859866997...');
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('phone', '17859866997');


  if (userError) {
    console.error('Error finding user:', userError);
    return;
  }

  if (!users || users.length === 0) {
    console.log('User not found.');
    return;
  }

  const user = users[0];
  result.user = { id: user.id, phone: user.phone, name: user.name }; // Capture name if it exists now or later

  // console.log(`Found User ID: ${user.id}, Phone: ${user.phone}`);

  // console.log('Checking subscriptions...');
  const { data: subs, error: subError } = await supabase
    .from('coach_subscriptions')
    .select('*')
    .eq('student_id', user.id); 

  if (subError) {
    console.error('Error finding subscriptions:', subError);
  } else {
    // console.log(`Found ${subs.length} subscriptions.`);
    result.subscriptions = subs.map(sub => ({
        id: sub.id,
        status: sub.status,
        start_date: sub.start_date,
        end_date: sub.end_date
    }));
  }

  // console.log('Checking plan instances...');
  const { data: plans, error: planError } = await supabase
    .from('coach_plan_instances')
    .select('*')
    .eq('student_id', user.id)
    .eq('status', 'active'); 

  if (planError) {
    console.error('Error finding plans:', planError);
    return;
  }

  if (plans.length > 0) {
      result.plans = plans.map(plan => ({
          id: plan.id,
          name: plan.name,
          start_execution_day: plan.start_execution_day,
          start_date: plan.start_date,
          training_days_count: plan.training_days ? plan.training_days.length : 0
      }));
  }
  
    // Check executions
  if (plans.length > 0) {
      const planId = plans[0].id;
      // console.log(`Checking executions for Plan ${planId}...`);
      const { data: execs, error: execError } = await supabase
        .from('plan_instance_executions')
        .select('*')
        .eq('instance_id', planId)
        .order('started_at', { ascending: false });
        
      if (execError) {
          console.error('Error fetching executions:', execError);
      } else {
          // console.log(`Found ${execs.length} executions.`);
          result.executions = execs.map(e => ({
              day_index: e.day_index,
              status: e.status,
              started_at: e.started_at,
              completed_at: e.completed_at
          }));
      }
  }
  
  fs.writeFileSync('debug_data.json', JSON.stringify(result, null, 2));
  console.log('Data written to debug_data.json');
}



// checkUserPlan(); // Called at end


checkUserPlan();
