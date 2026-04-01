import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    
    // Tùy chọn: Trả về tiêu đề cũ khi component unmount
    return () => {
      document.title = prevTitle;
    };
  }, [title]);
}
