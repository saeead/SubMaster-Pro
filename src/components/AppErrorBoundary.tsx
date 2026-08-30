import React from 'react';

interface AppErrorBoundaryState {
  error: Error | null;
}

/** Prevent a runtime exception from leaving users with a blank application page. */
export class AppErrorBoundary extends React.Component<React.PropsWithChildren<Record<string, never>>, AppErrorBoundaryState> {
  declare props: React.PropsWithChildren<Record<string, never>>;
  public state: AppErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('SubMaster failed to render.', error, info);
  }

  private reloadWithCleanSettings = (): void => {
    localStorage.removeItem('submaster_pro_settings_v1');
    window.location.reload();
  };

  public render(): React.ReactNode {
    if (!this.state.error) return this.props.children;

    return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#0a0e27] p-6 font-[Vazirmatn,sans-serif] text-white">
      <section className="w-full max-w-lg rounded-2xl border border-red-400/30 bg-white/5 p-6 text-right shadow-2xl">
        <h1 className="text-lg font-bold text-red-300">خطا در بارگذاری برنامه</h1>
        <p className="mt-3 text-sm leading-7 text-white/80">تنظیمات ذخیره‌شده یا یک خطای اجرایی مانع نمایش برنامه شده است. می‌توانید تنظیمات محلی را پاک و برنامه را دوباره بارگذاری کنید.</p>
        <button type="button" onClick={this.reloadWithCleanSettings} className="mt-5 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">پاک‌سازی تنظیمات و بارگذاری مجدد</button>
        <details className="mt-5 text-xs text-white/50"><summary className="cursor-pointer">جزئیات خطا</summary><pre className="mt-2 whitespace-pre-wrap break-words" dir="ltr">{this.state.error.message}</pre></details>
      </section>
    </main>;
  }
}
