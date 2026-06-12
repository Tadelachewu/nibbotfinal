import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const AUTOSAVE_DEBOUNCE_MS = 500;

export function usePerEntityDrafts<TData>(
  entityPrefix: string,
  editingId: string | null,
  editForm: TData,
  isEditorOpen: boolean
) {
  const [activeDraftIds, setActiveDraftIds] = useState<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousEditFormRef = useRef<TData | null>(null);

  const getPrefix = useCallback(() => `nibbot_${entityPrefix}_draft_`, [entityPrefix]);

  // Scan local storage for active drafts
  const scanDrafts = useCallback(() => {
    try {
      const keys = Object.keys(localStorage);
      const draftIds = new Set<string>();
      const prefix = getPrefix();
      for (const key of keys) {
        if (key.startsWith(prefix)) {
          const id = key.replace(prefix, '');
          if (id) draftIds.add(id);
        }
      }
      setActiveDraftIds(draftIds);
    } catch (e) {
      console.warn('Failed to access localStorage', e);
    }
  }, [getPrefix]);

  useEffect(() => {
    scanDrafts();
    // Listen for cross-tab updates
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith(getPrefix()) || e.key === null) {
        scanDrafts();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [scanDrafts, getPrefix]);

  // Auto-save logic
  useEffect(() => {
    if (!isEditorOpen || !editingId) return;

    // Check if form actually changed
    const currentStr = JSON.stringify(editForm);
    const prevStr = previousEditFormRef.current ? JSON.stringify(previousEditFormRef.current) : null;
    if (currentStr === prevStr) return;

    previousEditFormRef.current = JSON.parse(currentStr);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`${getPrefix()}${editingId}`, currentStr);
        // Force state update of active draft IDs so UI reflects it immediately
        setActiveDraftIds(prev => {
          const next = new Set(prev);
          next.add(editingId);
          return next;
        });
      } catch (e) {
        console.warn('Failed to save draft', e);
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [editForm, editingId, isEditorOpen, getPrefix]);

  // Manual actions
  const getDraft = useCallback((id: string): TData | null => {
    try {
      const raw = localStorage.getItem(`${getPrefix()}${id}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [getPrefix]);

  const discardDraft = useCallback((id: string) => {
    try {
      localStorage.removeItem(`${getPrefix()}${id}`);
      setActiveDraftIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      console.warn('Failed to discard draft', e);
    }
  }, [getPrefix]);

  // Memoize activeDraftIds array to avoid unnecessary re-renders
  const activeDraftIdsArray = useMemo(() => Array.from(activeDraftIds), [activeDraftIds]);

  return {
    activeDraftIds: activeDraftIdsArray,
    getDraft,
    discardDraft
  };
}
