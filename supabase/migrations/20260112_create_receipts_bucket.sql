-- 创建支付凭证存储 bucket
-- 此 bucket 用于存储学员上传的线下支付凭证图片

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 允许已认证用户上传到 receipts bucket
CREATE POLICY "Allow authenticated users to upload receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- 允许所有用户读取 receipts
CREATE POLICY "Allow public read access to receipts"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- 允许用户删除自己的凭证
CREATE POLICY "Allow users to delete own receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
