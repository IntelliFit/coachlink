"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { InputTextarea } from "primereact/inputtextarea";
import knowledgeService from "@/app/service/knowledgeService";
import type { KnowledgeBookDiscussionComment } from "@/types/knowledgeBookDiscussion";

type BookDiscussionProps = {
  bookId: string;
  prompts?: string[];
};

function formatTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CommentAvatar({ comment }: { comment: KnowledgeBookDiscussionComment }) {
  if (comment.author.avatarUrl) {
    return (
      <img
        src={comment.author.avatarUrl}
        alt={comment.author.name}
        className="w-2rem h-2rem border-circle object-cover flex-shrink-0"
      />
    );
  }
  return (
    <span className="inline-flex align-items-center justify-content-center w-2rem h-2rem border-circle bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-200 font-semibold flex-shrink-0">
      {comment.author.name.slice(0, 1)}
    </span>
  );
}

export default function BookDiscussion({ bookId, prompts = [] }: BookDiscussionProps) {
  const [comments, setComments] = useState<KnowledgeBookDiscussionComment[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<KnowledgeBookDiscussionComment | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await knowledgeService.listBookComments(bookId);
        if (cancelled) return;
        setComments(result?.comments || []);
        setAvailable(result?.available ?? true);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "讨论加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, KnowledgeBookDiscussionComment[]>();
    comments.forEach((comment) => {
      if (!comment.parentId) return;
      const bucket = map.get(comment.parentId) || [];
      bucket.push(comment);
      map.set(comment.parentId, bucket);
    });
    return map;
  }, [comments]);
  const roots = comments.filter(
    (comment) => !comment.parentId || !comments.some((candidate) => candidate.id === comment.parentId)
  );

  async function publishComment() {
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const created = await knowledgeService.createBookComment({
        bookId,
        body,
        parentId: replyTo?.id || null,
      });
      if (created) {
        setComments((current) => [...current, created]);
        setDraft("");
        setReplyTo(null);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "发布失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteComment(comment: KnowledgeBookDiscussionComment) {
    if (!comment.isMine || !window.confirm("删除这条评论？")) return;
    setError("");
    try {
      if (await knowledgeService.deleteBookComment(comment.id)) {
        setComments((current) => current.filter((candidate) => candidate.id !== comment.id));
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败");
    }
  }

  function renderComment(comment: KnowledgeBookDiscussionComment, depth = 0): React.ReactNode {
    const children = childrenByParent.get(comment.id) || [];
    return (
      <div key={comment.id} className={depth > 0 ? "ml-4 mt-3" : "mt-3"}>
        <div className="p-3 border-1 border-surface-200 dark:border-surface-700 border-round-xl bg-surface-50 dark:bg-surface-800">
          <div className="flex align-items-start gap-3">
            <CommentAvatar comment={comment} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap align-items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-surface-900 dark:text-surface-0">
                  {comment.author.name}
                </span>
                {comment.isMine && (
                  <span className="px-2 py-1 border-round bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 text-xs">我</span>
                )}
                <span className="text-xs text-surface-400">{formatTime(comment.createdAt)}</span>
              </div>
              <p className="m-0 white-space-pre-wrap text-sm line-height-3 text-surface-700 dark:text-surface-200">
                {comment.body}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  className="px-3 py-2 border-1 border-surface-300 dark:border-surface-600 border-round-lg bg-white dark:bg-surface-900 text-xs font-semibold text-surface-700 dark:text-surface-200"
                  onClick={() => setReplyTo(comment)}
                >
                  回复
                </button>
                {comment.isMine && (
                  <button
                    type="button"
                    className="px-3 py-2 border-1 border-red-200 dark:border-red-900 border-round-lg bg-white dark:bg-surface-900 text-xs font-semibold text-red-600"
                    onClick={() => void deleteComment(comment)}
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {children.map((child) => renderComment(child, depth + 1))}
      </div>
    );
  }

  return (
    <Card className="border-round-xl">
      <div className="flex flex-column gap-3">
        <div>
          <h2 className="m-0 text-xl font-semibold text-surface-900 dark:text-surface-0">读者讨论</h2>
          <p className="m-0 mt-2 text-sm text-surface-600 dark:text-surface-300">
            评论当前这篇总览或章节；回复会保留上下文。
          </p>
        </div>

        {!available ? (
          <div className="p-3 border-round-lg bg-orange-50 text-orange-800 text-sm">
            讨论区代码已经就绪，待数据库迁移执行后开放发布。
          </div>
        ) : (
          <>
            {prompts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {prompts.slice(0, 3).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="px-3 py-2 border-1 border-surface-300 dark:border-surface-600 border-round-lg bg-white dark:bg-surface-900 text-xs text-left text-surface-700 dark:text-surface-200"
                    onClick={() => setDraft(`${prompt}\n\n`)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            {replyTo && (
              <div className="flex align-items-center justify-content-between gap-2 p-3 border-round-lg bg-primary-50 dark:bg-primary-900/20 text-sm text-primary-800 dark:text-primary-200">
                <span>正在回复 {replyTo.author.name}</span>
                <button type="button" className="border-none bg-transparent text-primary-700 dark:text-primary-200" onClick={() => setReplyTo(null)}>取消</button>
              </div>
            )}
            <InputTextarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={4}
              maxLength={2000}
              autoResize
              placeholder="写下你的理解、训练经历或问题…"
              className="w-full"
            />
            <div className="flex align-items-center justify-content-between gap-3">
              <span className="text-xs text-surface-400">{draft.trim().length}/2000</span>
              <Button
                label={replyTo ? "发布回复" : "发布评论"}
                loading={submitting}
                disabled={!draft.trim() || draft.trim().length > 2000}
                onClick={() => void publishComment()}
                className="!border-[#CF6D4E] !bg-[#CF6D4E]"
              />
            </div>
          </>
        )}

        {error && <div className="p-3 border-round-lg bg-red-50 text-red-700 text-sm">{error}</div>}

        <div>
          {loading ? (
            <p className="text-sm text-surface-500">正在加载讨论…</p>
          ) : roots.length > 0 ? (
            roots.map((comment) => renderComment(comment))
          ) : available ? (
            <p className="text-sm text-surface-500">还没有评论，欢迎留下第一条有内容的讨论。</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
