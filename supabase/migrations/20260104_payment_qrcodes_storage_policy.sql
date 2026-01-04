-- 为 payment-qrcodes bucket 设置正确的 Storage 策略
-- 在 Supabase Dashboard SQL Editor 中执行此脚本

-- 1. 允许已认证用户上传到自己的文件夹
CREATE POLICY "Authenticated users can upload their own QR codes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'payment-qrcodes'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 2. 允许已认证用户更新自己的文件
CREATE POLICY "Authenticated users can update their own QR codes"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'payment-qrcodes'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. 允许已认证用户删除自己的文件
CREATE POLICY "Authenticated users can delete their own QR codes"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'payment-qrcodes'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. 允许公开读取（因为 bucket 已设为 PUBLIC）
CREATE POLICY "Public read access for payment QR codes"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'payment-qrcodes');
