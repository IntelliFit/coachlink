"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Skeleton } from "primereact/skeleton";
import { useToastContext } from "@/context/ToastContext";
import knowledgeService from "@/app/service/knowledgeService";
import { KnowledgeBookRow } from "@/types";

const BooksPage = () => {
  const [books, setBooks] = useState<KnowledgeBookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { showToast } = useToastContext();

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const result = await knowledgeService.getKnowledgeBooks({
        is_published: true,
      });
      
      if (result) {
        setBooks(result.books);
      } else {
        setBooks([]);
      }
    } catch (err) {
      setError("获取书籍列表失败");
      showToast({
        severity: "error",
        summary: "错误",
        detail: "获取书籍列表失败，请稍后重试",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBookClick = (bookId: string, hasAccess: boolean) => {
    if (hasAccess) {
      router.push(`/dashboard/knowledge/books/${bookId}`);
    } else {
      // 如果没有访问权限，跳转到订阅页面
      router.push("/dashboard/knowledge/subscribe");
    }
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-0">
          知识库 - 书籍笔记
        </h1>
        <p className="text-surface-600 dark:text-surface-300 mt-2">
          以最通俗易懂的方式传授运动训练知识
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="col-span-1">
                <Skeleton height="150px" borderRadius="16px" className="mb-2" />
                <Skeleton width="80%" height="1.5rem" className="mb-2" />
                <Skeleton width="60%" height="1rem" className="mb-2" />
                <Skeleton width="40%" height="1rem" />
              </div>
            ))
          : books.map((book) => (
              <Card
                key={book.id}
                className="cursor-pointer hover:shadow-md transition-shadow duration-200 border-round-xl"
                onClick={() => handleBookClick(book.id, book.is_free || false)}
              >
                <div className="flex flex-column align-items-center text-center">
                  {book.cover_image ? (
                    <img
                      src={book.cover_image}
                      alt={book.title}
                      className="w-full h-30rem object-cover border-round-md mb-3"
                      style={{ height: "150px", objectFit: "cover" }}
                    />
                  ) : (
                    <div className="w-full h-30rem bg-surface-200 border-round-md mb-3 flex align-items-center justify-content-center"
                         style={{ height: "150px" }}>
                      <i className="pi pi-book text-4xl text-surface-400"></i>
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-0 line-clamp-1">
                    {book.title}
                  </h3>
                  <p className="text-sm text-surface-600 dark:text-surface-300 line-clamp-2 mb-2">
                    {book.summary || "暂无简介"}
                  </p>
                  <div className="mt-2 w-full">
                    {book.is_free ? (
                      <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        免费
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">
                        付费
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
      </div>

      {books.length === 0 && !loading && (
        <div className="text-center py-8">
          <i className="pi pi-book text-4xl text-surface-300 mb-3"></i>
          <h3 className="text-lg font-medium text-surface-600 dark:text-surface-300">
            暂无书籍
          </h3>
          <p className="text-surface-500 dark:text-surface-400 mt-1">
            知识库暂无可用书籍，请稍后再来查看
          </p>
        </div>
      )}
    </div>
  );
};

export default BooksPage;

