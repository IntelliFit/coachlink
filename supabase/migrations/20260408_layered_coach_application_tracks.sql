-- Layered coach application / discovery foundation
-- 1) Support tiered coach tracks (buddy / growth / professional)
-- 2) Store service modes + target student stages
-- 3) Officially allow reviewing / needs_info in application workflow

ALTER TABLE public.coach_applications
DROP CONSTRAINT IF EXISTS coach_applications_status_check;

ALTER TABLE public.coach_applications
ADD CONSTRAINT coach_applications_status_check
CHECK (
  status = ANY (
    ARRAY[
      'pending'::text,
      'reviewing'::text,
      'needs_info'::text,
      'approved'::text,
      'rejected'::text
    ]
  )
);

ALTER TABLE public.coach_applications
ADD COLUMN IF NOT EXISTS coach_track text NOT NULL DEFAULT 'professional',
ADD COLUMN IF NOT EXISTS service_modes text[] NOT NULL DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS target_student_levels text[] NOT NULL DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS support_focus text;

ALTER TABLE public.coach_applications
DROP CONSTRAINT IF EXISTS coach_applications_coach_track_check;

ALTER TABLE public.coach_applications
ADD CONSTRAINT coach_applications_coach_track_check
CHECK (
  coach_track = ANY (
    ARRAY[
      'buddy'::text,
      'growth'::text,
      'professional'::text
    ]
  )
);

ALTER TABLE public.coaches
ADD COLUMN IF NOT EXISTS coach_track text NOT NULL DEFAULT 'professional',
ADD COLUMN IF NOT EXISTS service_modes text[] NOT NULL DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS target_student_levels text[] NOT NULL DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS support_focus text;

ALTER TABLE public.coaches
DROP CONSTRAINT IF EXISTS coaches_coach_track_check;

ALTER TABLE public.coaches
ADD CONSTRAINT coaches_coach_track_check
CHECK (
  coach_track = ANY (
    ARRAY[
      'buddy'::text,
      'growth'::text,
      'professional'::text
    ]
  )
);

CREATE INDEX IF NOT EXISTS idx_coach_applications_track
ON public.coach_applications (coach_track);

CREATE INDEX IF NOT EXISTS idx_coaches_track
ON public.coaches (coach_track);

COMMENT ON COLUMN public.coach_applications.coach_track IS '教练分层：buddy=训练搭子，growth=进阶教练，professional=专业教练';
COMMENT ON COLUMN public.coach_applications.service_modes IS '服务方式：online / offline / hybrid';
COMMENT ON COLUMN public.coach_applications.target_student_levels IS '适合服务的学员阶段：beginner / intermediate / advanced';
COMMENT ON COLUMN public.coach_applications.support_focus IS '申请人最擅长解决的学员阶段问题';

COMMENT ON COLUMN public.coaches.coach_track IS '教练分层：buddy=训练搭子，growth=进阶教练，professional=专业教练';
COMMENT ON COLUMN public.coaches.service_modes IS '服务方式：online / offline / hybrid';
COMMENT ON COLUMN public.coaches.target_student_levels IS '适合服务的学员阶段：beginner / intermediate / advanced';
COMMENT ON COLUMN public.coaches.support_focus IS '教练最擅长解决的学员阶段问题';

UPDATE public.coach_applications
SET coach_track = 'professional'
WHERE coach_track IS NULL;

UPDATE public.coaches
SET coach_track = 'professional'
WHERE coach_track IS NULL;
