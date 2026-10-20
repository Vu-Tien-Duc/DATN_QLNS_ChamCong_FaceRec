import React from 'react';
import { Construction, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  description = 'Phân hệ này đang được kết nối với API Backend và chuẩn hóa theo giao diện mới.',
}) => {
  const navigate = useNavigate();

  return (
    <div className="py-12 flex items-center justify-center animate-fade-in">
      <Card glass className="max-w-lg w-full text-center p-8">
        <CardContent className="space-y-4">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-200/60 dark:border-brand-800/60 shadow-sm">
            <Construction className="w-8 h-8 animate-bounce" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h2>

          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            {description}
          </p>

          <div className="pt-4 flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate('/')}
            >
              Về Bảng Điều Khiển
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
