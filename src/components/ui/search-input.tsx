'use client';

import { forwardRef, useCallback, useRef } from 'react';
import { Input, InputProps } from '@/components/ui/input';
import { Search } from 'lucide-react';

export interface SearchInputProps extends Omit<InputProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, placeholder = 'Search...', className, ...props }, ref) => {
    const innerRef = useRef<HTMLInputElement>(null);
    const combinedRef = (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref != null) {
        ref.current = node;
      }
    };

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
      },
      [onChange]
    );

    return (
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={combinedRef}
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={`pl-9 ${className}`}
          autoComplete="off"
          {...props}
        />
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
