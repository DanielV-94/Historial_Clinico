import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface SearchInputProps<T> {
  /** Placeholder text for the input */
  placeholder?: string;
  /** Callback triggered after debounce with the search query */
  onSearch: (query: string) => void;
  /** Results to display in the dropdown */
  results?: T[];
  /** Callback when a result is selected */
  onSelect?: (item: T) => void;
  /** Custom render function for each result item */
  renderItem?: (item: T, index: number) => React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Debounce delay in ms. Default: 500 */
  debounceMs?: number;
  /** Whether the search is currently loading */
  loading?: boolean;
}

/**
 * SearchInput — Input with 500ms debounce and dropdown results list.
 * Validates: Requirements 5.3, 11.2
 */
export function SearchInput<T>({
  placeholder = 'Buscar...',
  onSearch,
  results = [],
  onSelect,
  renderItem,
  className = '',
  debounceMs = 500,
  loading = false,
}: SearchInputProps<T>) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length === 0) {
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      onSearch(query.trim());
      setIsOpen(true);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, debounceMs, onSearch]);

  // Show dropdown when results arrive
  useEffect(() => {
    if (results.length > 0 && query.trim().length > 0) {
      setIsOpen(true);
    }
  }, [results, query]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (item: T) => {
      onSelect?.(item);
      setIsOpen(false);
      setQuery('');
      setFocusedIndex(-1);
    },
    [onSelect]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < results.length) {
          handleSelect(results[focusedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const listboxId = 'search-results-listbox';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0 && query.trim().length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            focusedIndex >= 0 ? `search-result-${focusedIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-label={placeholder}
        />
        {loading && (
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <div className="h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400" role="option" aria-selected={false}>
              {loading ? 'Buscando...' : 'Sin resultados'}
            </li>
          ) : (
            results.map((item, index) => (
              <li
                key={index}
                id={`search-result-${index}`}
                role="option"
                aria-selected={index === focusedIndex}
                className={`px-4 py-2 cursor-pointer text-sm transition-colors ${
                  index === focusedIndex
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                {renderItem ? renderItem(item, index) : String(item)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
