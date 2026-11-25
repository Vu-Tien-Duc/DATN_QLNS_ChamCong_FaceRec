import React, { startTransition, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  inputClassName?: string;
  iconClassName?: string;
  clearTitle?: string;
  ariaLabel?: string;
}

/**
 * Ô tìm kiếm dạng Uncontrolled DOM Input + IME-safe + debounce + startTransition:
 * - React KHÔNG ghi đè `input.value` khi người dùng đang gõ -> loại bỏ 100% lỗi rớt ký tự
 *   với bộ gõ Tiếng Việt (UniKey, EVKey, Windows Telex, macOS IME) như "phạm" -> "pạm", "đức" -> "ức".
 * - 0 lần re-render trong suốt quá trình gõ ký tự -> không giật lag, không tăng áp lực GC/RAM.
 * - Dùng `startTransition` khi phát giá trị lọc lên trang cha -> React tự ưu tiên phím gõ và hủy
 *   lượt render danh sách cũ nếu người dùng tiếp tục gõ trên tập dữ liệu lớn.
 */
export const SearchInput: React.FC<SearchInputProps> = React.memo(
  ({
    value,
    onChange,
    placeholder = 'Tìm kiếm...',
    debounceMs = 220,
    className = 'relative flex-1 min-w-[200px]',
    inputClassName = 'w-full h-9 pl-9 pr-8 text-xs rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none transition-all',
    iconClassName = 'w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none',
    clearTitle = 'Xóa từ khóa',
    ariaLabel,
  }) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const timerRef = useRef<number | null>(null);
    const isComposingRef = useRef<boolean>(false);
    const lastEmittedRef = useRef<string>(value);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // Chỉ re-render 1 lần duy nhất khi chuyển giữa rỗng <-> có chữ để hiện/ẩn nút X
    const [hasText, setHasText] = useState<boolean>(() => Boolean(value));

    // Chỉ đồng bộ vào DOM khi prop `value` thực sự bị thay đổi từ bên ngoài (vd: bấm "Xóa lọc"),
    // TUYỆT ĐỐI bỏ qua phản hồi echo của chính giá trị vừa phát đi để không bao giờ nuốt chữ đang gõ.
    useEffect(() => {
      if (value === lastEmittedRef.current) return;
      lastEmittedRef.current = value;
      if (inputRef.current && inputRef.current.value !== value) {
        inputRef.current.value = value;
      }
      setHasText(Boolean(value));
    }, [value]);

    useEffect(() => {
      return () => {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }
      };
    }, []);

    const emitNow = (next: string) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (next === lastEmittedRef.current) return;
      lastEmittedRef.current = next;
      startTransition(() => {
        onChangeRef.current(next);
      });
    };

    const scheduleEmit = (next: string) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      if (debounceMs <= 0) {
        emitNow(next);
        return;
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (isComposingRef.current) return;
        const latestDomValue = inputRef.current ? inputRef.current.value : next;
        emitNow(latestDomValue);
      }, debounceMs);
    };

    const handleClear = () => {
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
      setHasText(false);
      emitNow('');
    };

    return (
      <div className={className}>
        <Search className={iconClassName} />
        <input
          ref={inputRef}
          type="text"
          defaultValue={value}
          aria-label={ariaLabel || placeholder}
          autoComplete="off"
          spellCheck={false}
          onCompositionStart={() => {
            isComposingRef.current = true;
            if (timerRef.current !== null) {
              window.clearTimeout(timerRef.current);
              timerRef.current = null;
            }
          }}
          onCompositionEnd={(e) => {
            isComposingRef.current = false;
            const next = e.currentTarget.value;
            setHasText(Boolean(next));
            scheduleEmit(next);
          }}
          onInput={(e) => {
            const next = e.currentTarget.value;
            const nextHasText = Boolean(next);
            setHasText((prev) => (prev === nextHasText ? prev : nextHasText));
            if (!isComposingRef.current) {
              scheduleEmit(next);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isComposingRef.current) {
              emitNow(e.currentTarget.value);
            } else if (e.key === 'Escape' && e.currentTarget.value) {
              e.preventDefault();
              handleClear();
            }
          }}
          placeholder={placeholder}
          className={inputClassName}
        />
        {hasText && (
          <button
            type="button"
            title={clearTitle}
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
