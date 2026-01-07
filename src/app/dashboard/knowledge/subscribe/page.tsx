"use client";

import React, { useState, useEffect } from "react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { RadioButton } from "primereact/radiobutton";
import { Checkbox } from "primereact/checkbox";
import { useToastContext } from "@/context/ToastContext";
import knowledgeService from "@/app/service/knowledgeService";

const SubscriptionPage = () => {
  const [selectedPlan, setSelectedPlan] = useState("basic");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { showToast } = useToastContext();

  useEffect(() => {
    // Simulating API call to get current subscription
    setTimeout(() => {
      // In a real app, this would call knowledgeService.getKnowledgeSubscription()
      setCurrentSubscription(null); // Assuming no current subscription
      setLoading(false);
    }, 500);
  }, []);

  const plans = [
    {
      id: "free",
      name: "免费体验",
      price: "¥0",
      period: "",
      description: "基础功能体验",
      features: [
        "部分免费书籍",
        "基础学习功能",
        "社区交流"
      ],
      popular: false,
    },
    {
      id: "basic",
      name: "基础会员",
      price: "¥19",
      period: "/月",
      description: "适合初学者",
      features: [
        "全部书籍内容",
        "AI讲解音频",
        "学习进度追踪",
        "基础AI问答（10次/月）"
      ],
      popular: false,
    },
    {
      id: "premium",
      name: "高级会员",
      price: "¥49",
      period: "/月",
      description: "完整功能体验",
      features: [
        "全部内容访问",
        "AI讲解音频",
        "学习进度追踪",
        "AI问答服务（100次/月）",
        "专属客服支持"
      ],
      popular: true,
    }
  ];

  const handleSubscribe = async () => {
    if (!agreedToTerms) {
      showToast({
        severity: "warn",
        summary: "警告",
        detail: "请同意服务条款",
      });
      return;
    }

    setProcessing(true);

    try {
      // Simulating API call to create subscription
      setTimeout(() => {
        showToast({
          severity: "success",
          summary: "成功",
          detail: `已成功订阅${plans.find(p => p.id === selectedPlan)?.name}！`,
        });
        setProcessing(false);
      }, 1500);

      // In a real app, this would call knowledgeService.createKnowledgeSubscription()
      // const result = await knowledgeService.createKnowledgeSubscription({
      //   plan: selectedPlan,
      //   order_id: "mock-order-id"
      // });
    } catch (error) {
      console.error("订阅失败:", error);
      showToast({
        severity: "error",
        summary: "错误",
        detail: "订阅失败，请稍后重试",
      });
      setProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (window.confirm("确定要取消订阅吗？")) {
      try {
        // Simulating API call to cancel subscription
        showToast({
          severity: "success",
          summary: "成功",
          detail: "订阅已取消",
        });
      } catch (error) {
        console.error("取消订阅失败:", error);
        showToast({
          severity: "error",
          summary: "错误",
          detail: "取消订阅失败，请稍后重试",
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center h-64">
        <i className="pi pi-spin pi-spinner text-2xl text-primary"></i>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-0">
          知识库会员订阅
        </h1>
        <p className="text-lg text-surface-600 dark:text-surface-300 mt-2">
          选择适合您的知识库会员计划
        </p>
      </div>

      {currentSubscription ? (
        <div className="mb-8">
          <Card className="border-round-xl bg-surface-50 dark:bg-surface-800">
            <div className="text-center py-6">
              <i className="pi pi-check-circle text-4xl text-green-500 mb-3"></i>
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-0 mb-2">
                您当前的订阅
              </h2>
              <div className="text-2xl font-bold text-primary mb-2">
                {currentSubscription.plan === "basic" ? "基础会员" : "高级会员"}
              </div>
              <p className="text-surface-600 dark:text-surface-300 mb-4">
                到期时间: {currentSubscription.expires_at ? new Date(currentSubscription.expires_at).toLocaleDateString() : "无限期"}
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  label="管理订阅"
                  icon="pi pi-cog"
                  className="p-button-outlined"
                />
                <Button
                  label="取消订阅"
                  icon="pi pi-times"
                  className="p-button-danger"
                  onClick={handleCancelSubscription}
                />
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="mb-8">
          <Card className="border-round-xl bg-surface-50 dark:bg-surface-800">
            <div className="text-center py-6">
              <i className="pi pi-star text-4xl text-yellow-500 mb-3"></i>
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-0 mb-2">
                开始您的知识库之旅
              </h2>
              <p className="text-surface-600 dark:text-surface-300">
                选择合适的会员计划，解锁全部知识库内容
              </p>
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {plans.map((plan) => (
          <Card 
            key={plan.id} 
            className={`border-round-xl relative ${plan.popular ? "ring-2 ring-primary" : ""}`}
          >
            {plan.popular && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-primary text-surface px-3 py-1 rounded-full text-sm font-bold">
                最受欢迎
              </div>
            )}
            <div className="text-center py-4">
              <h3 className="text-xl font-bold text-surface-900 dark:text-surface-0">
                {plan.name}
              </h3>
              <div className="my-4">
                <span className="text-3xl font-bold text-surface-900 dark:text-surface-0">
                  {plan.price}
                </span>
                <span className="text-surface-600 dark:text-surface-400">
                  {plan.period}
                </span>
              </div>
              <p className="text-surface-600 dark:text-surface-400 mb-4">
                {plan.description}
              </p>
              <ul className="text-left space-y-2 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <i className="pi pi-check-circle text-green-500 mr-2"></i>
                    <span className="text-surface-700 dark:text-surface-300">{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-center">
                <RadioButton
                  inputId={plan.id}
                  name="plan"
                  value={plan.id}
                  checked={selectedPlan === plan.id}
                  onChange={(e) => setSelectedPlan(e.value)}
                />
                <label htmlFor={plan.id} className="ml-2 text-surface-700 dark:text-surface-300">
                  选择此计划
                </label>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-round-xl">
        <div className="flex flex-column md:flex-row align-items-center justify-content-between gap-4">
          <div className="flex align-items-center">
            <Checkbox
              inputId="terms"
              name="terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.checked)}
            />
            <label htmlFor="terms" className="ml-2 text-surface-700 dark:text-surface-300">
              我已阅读并同意 <a href="#" className="text-primary hover:underline">服务条款</a> 和 <a href="#" className="text-primary hover:underline">隐私政策</a>
            </label>
          </div>
          <Button
            label={`立即订阅 - ${plans.find(p => p.id === selectedPlan)?.price}${plans.find(p => p.id === selectedPlan)?.period}`}
            icon="pi pi-shopping-cart"
            className="p-button-lg w-full md:w-auto"
            disabled={!agreedToTerms}
            loading={processing}
            onClick={handleSubscribe}
          />
        </div>
      </Card>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center p-4">
          <i className="pi pi-shield text-3xl text-blue-500 mb-3"></i>
          <h4 className="font-bold text-surface-900 dark:text-surface-0 mb-2">安全保障</h4>
          <p className="text-surface-600 dark:text-surface-400 text-sm">
            采用安全支付渠道，保障您的交易安全
          </p>
        </div>
        <div className="text-center p-4">
          <i className="pi pi-sync text-3xl text-green-500 mb-3"></i>
          <h4 className="font-bold text-surface-900 dark:text-surface-0 mb-2">随时取消</h4>
          <p className="text-surface-600 dark:text-surface-400 text-sm">
            可随时取消订阅，灵活掌控您的会员服务
          </p>
        </div>
        <div className="text-center p-4">
          <i className="pi pi-headphones text-3xl text-purple-500 mb-3"></i>
          <h4 className="font-bold text-surface-900 dark:text-surface-0 mb-2">专属支持</h4>
          <p className="text-surface-600 dark:text-surface-400 text-sm">
            高级会员享受专属客服支持服务
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;

