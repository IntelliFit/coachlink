'use client';

import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { QrCode } from 'lucide-react';

export default function ArticlePaywall({ knowledgeHref }: { knowledgeHref?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mt-10 rounded-3xl border border-surface-200 bg-surface-0 p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
            <QrCode className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-black text-surface-900">查看更多内容</div>
            <div className="text-sm text-surface-500 mt-1 leading-relaxed">
              点击下方按钮可获取完整内容与扩展资料（示例交互：二维码服务）。
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {knowledgeHref ? (
                <Button
                  className="rounded-2xl"
                  label="登录后在知识库阅读全文"
                  onClick={() => {
                    const redirect = encodeURIComponent(knowledgeHref);
                    window.location.href = `/login?redirect=${redirect}`;
                  }}
                />
              ) : null}
              <Button className="rounded-2xl" label="查看更多（¥20）" onClick={() => setOpen(true)} />
              <Button
                outlined
                className="rounded-2xl"
                label="返回文章列表"
                onClick={() => (window.location.href = '/articles')}
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog
        header="扫码获取完整内容"
        visible={open}
        onHide={() => setOpen(false)}
        style={{ width: '92vw', maxWidth: '520px' }}
        className="text-surface-900"
      >
        <div className="p-4 md:p-6 text-center">
          <div className="text-2xl font-black text-surface-900">¥20.00</div>
          <div className="text-sm text-surface-500 mt-2">请扫码完成支付/获取服务（示例）。</div>

          <div className="mt-5 mx-auto w-[240px] h-[240px] rounded-2xl overflow-hidden border border-surface-100 bg-surface-50 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/wechat-beta-group-qr.png"
              alt="二维码"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="mt-4 text-xs text-surface-500 leading-relaxed">
            提示：该二维码图片为占位示例，可替换为正式的服务二维码。
          </div>
        </div>
      </Dialog>
    </>
  );
}

