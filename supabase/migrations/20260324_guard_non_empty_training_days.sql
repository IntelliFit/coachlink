alter table public.coach_plan_instances
add constraint coach_plan_instances_training_days_non_empty
check (
    case
        when training_days is null then false
        when jsonb_typeof(training_days) <> 'array' then false
        else jsonb_array_length(training_days) > 0
    end
);

alter table public.coach_plan_templates
add constraint coach_plan_templates_training_days_non_empty
check (
    case
        when training_days is null then false
        when jsonb_typeof(training_days) <> 'array' then false
        else jsonb_array_length(training_days) > 0
    end
);
