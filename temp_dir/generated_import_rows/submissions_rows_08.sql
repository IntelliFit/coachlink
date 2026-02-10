insert into public.streetlifting_submissions
(id, created_at, gender, bodyweight, added_weight, reps, form_quality, penalty_weight, is_processed, user_name, video_url, pullup_type, exercise_type)
values
('ebd3607b-10b4-4d53-adf3-d454aa37059e', '2025-07-11 10:34:14.085512+00'::timestamptz, 'Male', 76.0, 30.0, 20, 'Major_Cheat', 6.0, false, '酱大骨', 'https://b23.tv/aZWFHFb', 'Overhand', 'weighted_pullup'),
('ec14500e-2a2a-409d-9466-c8ce68092a82', '2026-01-01 14:21:22.232595+00'::timestamptz, 'Male', 80.0, 45.0, 4, 'Minor_Cheat', 2.5, false, 'a18100687113_com@163.com', null, 'Underhand', 'weighted_pullup'),
('ee8cf918-5b9a-4e73-ad73-19cea0f6f69b', '2025-12-28 04:10:56.176777+00'::timestamptz, 'Male', 59.5, 19.1, 5, 'Competition', 0.0, false, '青藤CyanVine', null, 'Overhand', 'weighted_pullup'),
('f037d96f-aeae-43a1-9305-790e3f0367a8', '2025-09-21 07:49:57.59344+00'::timestamptz, 'Male', 75.0, 77.5, 1, 'Competition', 0.0, false, null, null, 'Underhand', 'weighted_pullup'),
('f2204bff-0608-4903-9e6a-9256d07821aa', '2025-09-24 04:42:00.172929+00'::timestamptz, 'Male', 65.0, 22.0, 5, 'Competition', 0.0, false, null, null, 'Overhand', 'weighted_pullup'),
('f2a3b416-f8f5-46cf-b9bf-5c18b4441b49', '2025-07-15 03:44:59.508161+00'::timestamptz, 'Female', 54.5, 50.0, 1, 'Competition', 0.0, false, '爱吃麦当当的鱼', 'https://v.douyin.com/8b17-hRhDZI/', 'Overhand', 'weighted_pullup'),
('f2b1e0a6-d8f7-460d-b205-930cc487de82', '2025-07-11 10:36:43.56921+00'::timestamptz, 'Male', 76.0, 40.0, 5, 'Minor_Cheat', 3.0, false, null, null, 'Overhand', 'weighted_pullup'),
('f3592e2a-d1b8-473f-bbee-fcce647c1542', '2025-09-21 10:46:28.469724+00'::timestamptz, 'Male', 78.0, 15.0, 5, 'Minor_Cheat', 2.0, false, '扬帆', null, 'Overhand', 'weighted_pullup'),
('f55bb534-abe4-479e-a163-b95184c3b183', '2026-01-24 12:47:07.804026+00'::timestamptz, 'Male', 61.0, 30.0, 2, 'Minor_Cheat', 3.0, false, '山河', null, 'Overhand', 'weighted_pullup'),
('f5d2f998-60a7-47c4-afb9-73226436952b', '2025-12-19 13:22:21.79596+00'::timestamptz, 'Male', 60.0, 45.0, 1, 'Competition', 0.0, false, 'korin', 'https://v.douyin.com/qaCRvBTWHv8/', 'Overhand', 'weighted_pullup'),
('f617cadb-02c7-4e41-a5f0-955a6fb315f7', '2025-11-18 14:16:05.127527+00'::timestamptz, 'Male', 55.0, 77.5, 1, 'Minor_Cheat', 3.0, false, 'sw彦', null, 'Overhand', 'weighted_pullup'),
('f743cff0-0756-46e8-be03-86e26c6cdacb', '2025-07-11 12:48:04.10509+00'::timestamptz, 'Male', 73.0, 35.0, 7, 'Minor_Cheat', 2.0, false, null, null, 'Overhand', 'weighted_pullup'),
('f828cab4-5bf0-48f5-8b9b-076c7503a083', '2026-01-18 09:44:17.299374+00'::timestamptz, 'Male', 64.0, 118.0, 1, 'Competition', 0.0, false, 'Ryan', null, null, 'weighted_dips'),
('fb1535f4-b163-4b00-a556-8014f5dcedd0', '2025-10-17 13:47:35.128315+00'::timestamptz, 'Male', 66.0, 36.5, 5, 'Competition', 0.0, false, null, null, 'Overhand', 'weighted_pullup'),
('fdbf3fea-a52e-44f9-b693-6c369aab7b13', '2026-01-05 10:12:34.858484+00'::timestamptz, 'Male', 77.0, 45.0, 6, 'Competition', 0.0, false, null, null, 'Overhand', 'weighted_pullup'),
('fe960d5e-2a2b-48eb-902d-6231366e58ca', '2025-07-13 01:28:52.674395+00'::timestamptz, 'Male', 57.1, 59.4, 3, 'Competition', 0.0, false, '街健孩子王', 'https://b23.tv/rJXMzEn', 'Overhand', 'weighted_pullup'),
('ff80ae4f-4214-4ae9-b2b1-7ff1e45a1c51', '2025-12-22 13:23:34.539363+00'::timestamptz, 'Male', 70.0, 25.0, 5, 'Minor_Cheat', 3.0, false, null, null, 'Overhand', 'weighted_pullup'),
('ffd64faf-4634-46b8-936d-fce1582dcc89', '2025-12-19 06:09:44.423936+00'::timestamptz, 'Male', 60.0, 65.0, 2, 'Minor_Cheat', 3.0, false, '超威蓝猫', null, 'Overhand', 'weighted_pullup')
on conflict (id) do update set
  created_at = excluded.created_at,
  gender = excluded.gender,
  bodyweight = excluded.bodyweight,
  added_weight = excluded.added_weight,
  reps = excluded.reps,
  form_quality = excluded.form_quality,
  penalty_weight = excluded.penalty_weight,
  is_processed = excluded.is_processed,
  user_name = excluded.user_name,
  video_url = excluded.video_url,
  pullup_type = excluded.pullup_type,
  exercise_type = excluded.exercise_type;
