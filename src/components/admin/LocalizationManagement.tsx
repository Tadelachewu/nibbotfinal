'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { AppSettings, Language } from '@/lib/types';
import { defaultSystemTranslations } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search-input';
import { Save, Globe, Languages, Info, FileCode, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { usePerEntityDrafts } from '@/hooks/usePerEntityDrafts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminAuth } from './AdminAuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/use-debounce';
import { Pagination } from '@/components/ui/pagination';

export function LocalizationManagement() {
  const { csrfFetch } = useAdminAuth();
  const [settings, setSettings] = useState<AppSettings>({ supportedLanguages: [] });
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const { activeDraftIds, getDraft, discardDraft } = usePerEntityDrafts('translations', 'global', translations, true, csrfFetch);

  const mergeSystemTranslations = (
    current: Record<string, Record<string, string>> | undefined,
    langs: Language[]
  ) => {
    const base = current && typeof current === 'object' ? current : {};
    const result: Record<string, Record<string, string>> = { ...base };
    const langCodes = (Array.isArray(langs) ? langs : []).map(l => l.code).filter(Boolean);

    for (const key of Object.keys(defaultSystemTranslations)) {
      const row = { ...(defaultSystemTranslations[key] || {}), ...(result[key] || {}) };
      const enFallback = row.en || defaultSystemTranslations[key]?.en || '';
      for (const code of langCodes) {
        if (!row[code]) row[code] = enFallback;
      }
      result[key] = row;
    }

    return result;
  };

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/app-settings', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      const s = json?.data as AppSettings | undefined;
      if (s) {
        setSettings(s);
        setTranslations(mergeSystemTranslations(s.systemTranslations as any, s.supportedLanguages || []));
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!settings.supportedLanguages?.length) return;
    setTranslations(prev => mergeSystemTranslations(prev, settings.supportedLanguages));
  }, [settings.supportedLanguages]);

  const handleTranslationChange = (key: string, langCode: string, value: string) => {
    setTranslations(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [langCode]: value
      }
    }));
  };


  const handleSave = () => {
    setIsSaving(true);
    (async () => {
      try {
        const updatedSettings = {
          ...settings,
          systemTranslations: translations
        };

        const res = await csrfFetch('/api/app-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedSettings)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.status === 'error') {
          throw new Error(json?.message || 'Failed to save translations.');
        }

        discardDraft('global');
        setSettings(json.data);
        toast({
          title: "Success",
          description: "Global system translations updated successfully.",
        });
      } catch {
        toast({
          title: "Error",
          description: "Failed to save translations.",
          variant: "destructive"
        });
      } finally {
        setIsSaving(false);
      }
    })();
  };

  const stringLabels: Record<string, { label: string, description: string }> = {
    ui_bank_name: { label: 'Bank Name', description: 'The official name of the bank shown in the header' },
    ui_online: { label: 'Online Status', description: 'Label shown when browser has internet' },
    ui_offline: { label: 'Offline Status', description: 'Label shown when browser is offline' },
    ui_checking: { label: 'Connectivity Checking', description: 'Shown during initial probe' },
    ui_report_status_btn: { label: 'Check Status Button', description: 'Text for the check-report button' },
    ui_select_option: { label: 'Select Option Hint', description: 'Prompt text for menu selections' },
    ui_welcome_subtitle: { label: 'Welcome Subtitle', description: 'Help text under the welcome logo' },
    ui_welcome_en: { label: 'Welcome Message (English context)', description: 'English version of the main welcome banner' },
    ui_welcome_am: { label: 'Welcome Message (Amharic context)', description: 'Amharic version of the main welcome banner' },
    ui_back: { label: 'Back Button', description: 'Label for the navigation back button' },
    ui_home: { label: 'Home Button', description: 'Label for returning to the main menu' },
    ui_prev: { label: 'Prev Button', description: 'Label for pagination previous button' },
    ui_next: { label: 'Next Button', description: 'Label for pagination next button' },
    ui_related: { label: 'Related Label', description: 'Label shown above related menu options' },
    ui_placeholder_report_id: { label: 'Report ID Placeholder', description: 'Input placeholder when asking for report reference id' },
    ui_placeholder_input: { label: 'Input Placeholder', description: 'Generic input placeholder when asking for information' },
    ui_error_bool: { label: 'Boolean Validation Error', description: 'Shown when boolean input is invalid' },
    ui_error_number: { label: 'Number Validation Error', description: 'Shown when numeric input is invalid' },
    ui_error_phone: { label: 'Phone Validation Error', description: 'Shown when phone input is invalid' },
    ui_error_email: { label: 'Email Validation Error', description: 'Shown when email input is invalid' },
    ui_toast_required_title: { label: 'Required Toast Title', description: 'Toast title when a required field is missing' },
    ui_toast_required_desc: { label: 'Required Toast Description', description: 'Toast description when a required field is missing' },
    ui_toast_invalid_title: { label: 'Invalid Toast Title', description: 'Toast title when input is invalid' },
    ui_skip: { label: 'Skip Button', description: 'Label for skipping optional fields' },
    ui_cancel: { label: 'Cancel Button', description: 'Label for canceling the report lookup flow' },
    ui_skipped: { label: 'Skipped Label', description: 'Label shown when a field is skipped' },
    ui_loading_submitting_report: { label: 'Submitting Report', description: 'Loading text while submitting a report' },
    ui_loading_connecting: { label: 'Connecting Text', description: 'Loading text while connecting to server' },
    ui_loading: { label: 'Loading', description: 'Generic loading label' },
    ui_read_more: { label: 'Read More', description: 'Button text for loading more static content' },
    ui_load_more: { label: 'Load More', description: 'Generic "load more" button label' },
    ui_report_submit_success: { label: 'Report Success Message', description: 'Shown when report submission succeeds' },
    ui_report_submit_fail: { label: 'Report Failure Message', description: 'Shown when report submission fails' },
    ui_results_intro: { label: 'Results Intro', description: 'Intro shown before rendering table results' },
    ui_no_data: { label: 'No Data Message', description: 'Shown when no data is found' },
    ui_error_processing: { label: 'Processing Error', description: 'Generic message shown when request processing fails' },
    ui_request_success: { label: 'Request Success', description: 'Generic message shown when request succeeds without a template' },
    ui_admin_feedback: { label: 'Admin Feedback Label', description: 'Label for admin feedback section in report status card' },
    ui_status_label: { label: 'Report Status Title', description: 'Header for the status card' },
    ui_status_resolved: { label: 'Status: Resolved', description: 'Badge text for resolved tickets' },
    ui_status_reviewed: { label: 'Status: Reviewed', description: 'Badge text for reviewed tickets' },
    ui_status_pending: { label: 'Status: Pending', description: 'Badge text for pending tickets' },
    ui_original_request: { label: 'Original Request Label', description: 'Descriptor in status card' },
    ui_enter_report_id: { label: 'Report ID Prompt', description: 'Prompt asking for reference id' },
    ui_error_fallback: { label: 'Error Message', description: 'Generic error message fallback' }
  };

  const filteredKeys = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase();
    return Object.keys(defaultSystemTranslations).filter(key => {
      const info = stringLabels[key] || { label: key, description: '' };
      const keyMatch = key.toLowerCase().includes(query);
      const labelMatch = info.label.toLowerCase().includes(query);
      const descriptionMatch = info.description.toLowerCase().includes(query);

      // Check if any translation for this key matches the query
      const translationMatch = Object.entries(translations[key] || {}).some(([lang, text]) =>
        String(text || '').toLowerCase().includes(query)
      );

      // Also check default system translations as fallback
      const defaultTranslationMatch = Object.entries(defaultSystemTranslations[key] || {}).some(([lang, text]) =>
        String(text || '').toLowerCase().includes(query)
      );

      return keyMatch || labelMatch || descriptionMatch || translationMatch || defaultTranslationMatch;
    });
  }, [debouncedSearchQuery, translations]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(0);
  }, [debouncedSearchQuery]);

  const paginatedKeys = useMemo(() => {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return filteredKeys.slice(start, end);
  }, [filteredKeys, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Globe className="text-primary" size={24} />
            Global Localization Management
          </h2>
          <p className="text-sm text-muted-foreground">Manage system-wide UI strings across all supported languages.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Save size={16} />
          {isSaving ? 'Saving...' : 'Save All Translations'}
        </Button>
      </div>

      <Separator />

      {activeDraftIds.includes('global') && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-center justify-between text-amber-800">
          <div className="flex items-center gap-3">
            <FileCode className="flex-shrink-0" size={20} />
            <div>
              <h4 className="font-bold text-sm">Unsaved Draft Available</h4>
              <p className="text-xs">You have unsaved localization changes.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="bg-white hover:bg-amber-100 border-amber-200 text-amber-700" onClick={async () => {
              const draft = await getDraft('global') as Record<string, Record<string, string>>;
              if (draft) setTranslations(draft);
            }}>
              Resume Draft
            </Button>
            <Button variant="outline" size="sm" className="bg-white hover:bg-red-50 border-red-200 text-destructive" onClick={() => discardDraft('global')}>
              Discard
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Languages className="text-primary" size={20} />
              </div>
              <div>
                <CardTitle>System Strings & UI Text</CardTitle>
                <CardDescription>Configure localized versions for labels, prompts, and status indicators.</CardDescription>
              </div>
            </div>
            <SearchInput
              ref={searchInputRef}
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search system strings by name, key, or description..."
              className="min-w-[300px]"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 flex flex-col h-[700px]">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              {paginatedKeys.map((key) => {
                const info = stringLabels[key] || { label: key, description: 'System-generated key' };
                return (
                  <div key={key} className="space-y-4 border-b pb-6 last:border-0">
                    <div>
                      <h3 className="font-semibold text-foreground flex items-center gap-2 capitalize">
                        {info.label || key.replace('ui_', '').replace('_', ' ')}
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                          {key}
                        </span>
                      </h3>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="flex gap-6 w-max pb-2">
                        {settings.supportedLanguages.map((lang, idx) => (
                          <div key={`lang-${lang.code}-${idx}`} className="space-y-2 w-64 shrink-0">
                            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="px-1 bg-muted rounded font-bold uppercase">{lang.code}</span>
                              {lang.name}
                            </Label>
                            <Input
                              value={translations[key]?.[lang.code] || ''}
                              onChange={(e) => handleTranslationChange(key, lang.code, e.target.value)}
                              placeholder={`Enter ${lang.name} version...`}
                              className="h-9 focus-visible:ring-emerald-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className="p-4 border-t bg-card sticky bottom-0 z-10">
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={filteredKeys.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(0);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3 text-amber-800">
        <Info className="flex-shrink-0" size={20} />
        <div>
          <h4 className="font-bold text-sm">Deployment Note</h4>
          <p className="text-xs">
            These strings are used directly in the Chat Interface. Changes will reflect instantly upon saving and page refresh for users.
          </p>
        </div>
      </div>
    </div>
  );
}
