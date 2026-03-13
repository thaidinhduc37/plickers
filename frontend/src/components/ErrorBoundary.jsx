import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-8 font-sans">
          <div className="w-full max-w-lg bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-100 text-center">
            
            {/* Icon cảnh báo */}
            <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-5 shadow-sm">
              <span className="text-3xl">⚠️</span>
            </div>
            
            {/* Tiêu đề & Mô tả */}
            <h2 className="text-rose-600 text-xl sm:text-2xl font-semibold mb-2">
              Đã xảy ra sự cố không mong muốn
            </h2>
            <p className="text-slate-500 mb-6 leading-relaxed text-sm sm:text-base">
              Ứng dụng vừa gặp một lỗi nhỏ. Bạn vui lòng tải lại trang để tiếp tục nhé.
            </p>

            {/* Khối chi tiết lỗi (Light mode) */}
            {this.state.error && (
              <details className="text-left bg-slate-50 p-4 rounded-xl mb-6 border border-slate-200">
                <summary className="cursor-pointer text-slate-700 font-semibold outline-none select-none hover:text-slate-900 transition-colors">
                  Xem chi tiết lỗi kỹ thuật
                </summary>
                
                <div className="mt-4">
                  <p className="text-sm text-slate-600 font-medium mb-2">Thông báo lỗi:</p>
                  <pre className="p-3 bg-white text-rose-600 rounded-lg border border-rose-200 overflow-x-auto text-xs font-mono whitespace-pre-wrap break-words mb-4">
                    {this.state.error.toString()}
                  </pre>

                  {this.state.errorInfo && (
                    <>
                      <p className="text-sm text-slate-600 font-medium mb-2">Vị trí lỗi (Stack trace):</p>
                      <pre className="p-3 bg-white text-slate-600 rounded-lg border border-slate-200 overflow-x-auto text-xs font-mono whitespace-pre-wrap break-words m-0">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            )}

            {/* Nút tải lại */}
            <button
              onClick={() => window.location.reload()}
              className="bg-[#10509F] hover:bg-[#0d4080] text-white py-3 px-8 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#10509F] focus:ring-offset-2"
            >
              Tải lại trang
            </button>
            
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;