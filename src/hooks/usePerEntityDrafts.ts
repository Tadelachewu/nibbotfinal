import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const AUTOSAVE_DEBOUNCE_MS = 500;

export function usePerEntityDrafts<TData>(
  entityPrefix: string,
  editingId: string | null,
  editForm: TData,
  isEditorOpen: boolean,
  fetchFn: (url: string, options?: RequestInit) => Promise<Response> = fetch
) {
  const [activeDraftIds, setActiveDraftIds] = useState<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousEditFormRef = useRef<TData | null>(null);

  // Load active drafts from server
  const loadActiveDrafts = useCallback(async () => {
    try {
      const res = await fetchFn(`/api/drafts?entityType=${encodeURIComponent(entityPrefix)}`);
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        const ids = new Set<string>(json.data.map((draft: any) => draft.entityId as string));
        setActiveDraftIds(ids);
      }
    } catch (e) {
      console.warn('Failed to load drafts', e);
    }
  }, [entityPrefix, fetchFn]);

  useEffect(() => {
    loadActiveDrafts();
  }, [loadActiveDrafts]);

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

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await fetchFn('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType: entityPrefix,
            entityId: editingId,
            data: editForm
          })
        });
        // Force state update of active draft ids so UI reflects it immediately
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
  }, [editForm, editingId, isEditorOpen, entityPrefix, fetchFn]);

  // Manual actions
  const getDraft = useCallback(async (id: string): Promise<TData | null> => {
    try {
      const res = await fetchFn(`/api/drafts?entityType=${encodeURIComponent(entityPrefix)}`);
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        const draft = json.data.find((d: any) => d.entityId === id);
        return draft ? draft.data : null;
      }
      return null;
    } catch {
      return null;
    }
  }, [entityPrefix, fetchFn]);

  const discardDraft = useCallback(async (id: string) => {
    try {
      await fetchFn('/api/drafts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: entityPrefix,
          entityId: id
        })
      });
      setActiveDraftIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      console.warn('Failed to discard draft', e);
    }
  }, [entityPrefix, fetchFn]);

  // Memoize activeDraftIds array to avoid unnecessary re-renders
  const activeDraftIdsArray = useMemo(() => Array.from(activeDraftIds), [activeDraftIds]);

  return {
    activeDraftIds: activeDraftIdsArray,
    getDraft,
    discardDraft
  };
}
