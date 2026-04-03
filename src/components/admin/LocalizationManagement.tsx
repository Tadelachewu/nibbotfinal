'use client';

import { useState, useEffect } from 'react';
import { AppSettings, Language } from '@/lib/types';
import { defaultSystemTranslations } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Globe, Languages, Info } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminAuth } from './AdminAuthContext';

export function LocalizationManagement() {
  const { csrfFetch } = useAdminAuth();
  const [settings, setSettings] = useState<AppSettings>({ supportedLanguages: [] });
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/app-settings', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      const s = json?.data as AppSettings | undefined;
      if (s) {
        setSettings(s);
        setTranslations(s.systemTranslations || defaultSystemTranslations);
      }
    };
    load();
  }, []);

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
    ui_status_label: { label: 'Report Status Title', description: 'Header for the status card' },
    ui_status_resolved: { label: 'Status: Resolved', description: 'Badge text for resolved tickets' },
    ui_status_reviewed: { label: 'Status: Reviewed', description: 'Badge text for reviewed tickets' },
    ui_status_pending: { label: 'Status: Pending', description: 'Badge text for pending tickets' },
    ui_original_request: { label: 'Original Request Label', description: 'Descriptor in status card' },
    ui_enter_report_id: { label: 'Report ID Prompt', description: 'Prompt asking for reference id' },
    ui_error_fallback: { label: 'Error Message', description: 'Generic error message fallback' }
  };

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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Languages className="text-primary" size={20} />
            </div>
            <div>
              <CardTitle>System Strings & UI Text</CardTitle>
              <CardDescription>Configure localized versions for labels, prompts, and status indicators.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <div className="p-6 space-y-8">
              {Object.keys(defaultSystemTranslations).map((key) => {
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {settings.supportedLanguages.map(lang => (
                        <div key={lang.code} className="space-y-2">
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
                );
              })}
            </div>
          </ScrollArea>
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
