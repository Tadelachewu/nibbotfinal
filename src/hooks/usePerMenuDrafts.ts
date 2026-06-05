import { useState, useEffect, useCallback, useRef } from 'react';
import { MenuItem } from '@/lib/types';

const DRAFT_PREFIX = 'nibbot_menu_draft_';
const AUTOSAVE_DEBOUNCE_MS = 500;

export function usePerMenuDrafts(
  editingId: string | null,
  editForm: Partial<MenuItem>,
  isEditorOpen: boolean
) {
  const [activeDraftIds, setActiveDraftIds] = useState<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousEditFormRef = useRef<Partial<MenuItem>>({});

  // Scan local storage for active drafts
  const scanDrafts = useCallback(() => {
    try {
      const keys = Object.keys(localStorage);
      const draftIds = new Set<string>();
      for (const key of keys) {
        if (key.startsWith(DRAFT_PREFIX)) {
          const id = key.replace(DRAFT_PREFIX, '');
          if (id) draftIds.add(id);
        }
      }
      setActiveDraftIds(draftIds);
    } catch (e) {
      console.warn('Failed to access localStorage', e);
    }
  }, []);

  useEffect(() => {
    scanDrafts();
    // Listen for cross-tab updates
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith(DRAFT_PREFIX) || e.key === null) {
        scanDrafts();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [scanDrafts]);

  // Auto-save logic
  useEffect(() => {
    if (!isEditorOpen || !editingId) return;

    // Check if form actually changed
    const currentStr = JSON.stringify(editForm);
    const prevStr = JSON.stringify(previousEditFormRef.current);
    if (currentStr === prevStr) return;

    previousEditFormRef.current = JSON.parse(currentStr);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`${DRAFT_PREFIX}${editingId}`, currentStr);
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
  }, [editForm, editingId, isEditorOpen]);

  // Manual actions
  const getDraft = useCallback((id: string): Partial<MenuItem> | null => {
    try {
      const raw = localStorage.getItem(`${DRAFT_PREFIX}${id}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  const discardDraft = useCallback((id: string) => {
    try {
      localStorage.removeItem(`${DRAFT_PREFIX}${id}`);
      setActiveDraftIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      console.warn('Failed to discard draft', e);
    }
  }, []);

  return {
    activeDraftIds: Array.from(activeDraftIds),
    getDraft,
    discardDraft
  };
}
