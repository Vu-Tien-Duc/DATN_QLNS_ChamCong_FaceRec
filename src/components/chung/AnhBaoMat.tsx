import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiClient } from '../../api/apiClient';

interface AnhBaoMatProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallback?: React.ReactNode;
}

/**
 * Hiển thị ảnh được bảo vệ bởi JWT (`/api/tai-tep/tep/...`) bằng cách tải qua `apiClient`
 * (kèm Authorization Bearer token) thay vì đặt trực tiếp vào `<img src>`.
 */
export const AnhBaoMat: React.FC<AnhBaoMatProps> = ({
  src,
  alt = '',
  fallback = null,
  className = '',
  onError,
  ...rest
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [failed, setFailed] = useState<boolean>(false);

  const rawSrc = (src || '').trim();
  const protectedMatch = rawSrc.match(/\/api\/tai-tep\/tep\/[^?#]+(?:\?[^#]*)?/i);
  const isProtected = Boolean(protectedMatch);

  useEffect(() => {
    setFailed(false);
    setBlobUrl(null);
    if (!rawSrc || !isProtected || !protectedMatch) return;

    let active = true;
    let createdUrl: string | null = null;
    const endpoint = protectedMatch[0].replace(/^\/api/i, '');

    setLoading(true);
    apiClient
      .get(endpoint, { responseType: 'blob' })
      .then((res) => {
        if (!active) return;
        const blob = res.data as Blob;
        if (!blob || blob.size === 0) {
          throw new Error('Empty image blob');
        }
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        onError?.({} as React.SyntheticEvent<HTMLImageElement>);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [rawSrc, isProtected]);

  if (!rawSrc || failed) {
    return <>{fallback}</>;
  }

  if (isProtected) {
    if (loading || !blobUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      );
    }
    return <img src={blobUrl} alt={alt} className={className} onError={onError} {...rest} />;
  }

  return (
    <img
      src={rawSrc}
      alt={alt}
      className={className}
      onError={(e) => {
        setFailed(true);
        if (onError) onError(e);
      }}
      {...rest}
    />
  );
};
