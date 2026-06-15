import React, { ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary] Component crash caught in "${this.props.name || "Unknown"}":`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/10 rounded-2xl p-8 text-center my-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)] max-w-lg mx-auto">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#E50914]/10 mx-auto mb-4 text-[#E50914]">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Đã xảy ra lỗi tải phần này</h3>
          <p className="text-xs text-[#A0A0A0] mb-6">
            {this.state.error?.message || "Lỗi mạng hoặc lỗi kết xuất không mong muốn."}
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-full bg-white/5 border border-white/10 text-white font-semibold text-sm hover:bg-white/10 active:scale-95 transition-all duration-200"
          >
            <RefreshCw className="w-4 h-4 text-[#F5C518]" />
            Thử lại
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
