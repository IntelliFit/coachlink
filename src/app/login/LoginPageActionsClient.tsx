'use client';

export default function LoginPageActionsClient() {
  return (
    <button
      type="button"
      className="text-primary-600 font-bold hover:text-primary-700 transition-colors"
      onClick={() => window.location.reload()}
    >
      刷新页面
    </button>
  );
}

