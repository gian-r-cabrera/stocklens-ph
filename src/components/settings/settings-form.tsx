"use client";

import Link from "next/link";
import { ChartLine, Database, LogOut, Palette, Shield } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ThemeModeSetting } from "@/components/settings/theme-mode-setting";
import { FORECAST_DISCLAIMER } from "@/lib/forecast";
import { useSettingsStore, type SettingsState } from "@/lib/stores/settings-store";

function snapshotSettings(state: SettingsState) {
  return {
    defaultHorizon: state.defaultHorizon,
    preferredModel: state.preferredModel,
    showModelComparison: state.showModelComparison,
    displayAiInsights: state.displayAiInsights,
    defaultTimeRange: state.defaultTimeRange,
    autoRefresh: state.autoRefresh,
    showDisclaimerBanners: state.showDisclaimerBanners,
    theme: state.theme,
  };
}

function SettingRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

export function SettingsForm() {
  const settings = useSettingsStore();

  const handleReset = () => {
    const previous = snapshotSettings(settings);
    settings.reset();
    toast.message("Settings reset to defaults.", {
      action: {
        label: "Undo",
        onClick: () => settings.setAll(previous),
      },
    });
  };

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Preferences for appearance, forecasts, and disclaimers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Appearance</CardTitle>
          </div>
          <CardDescription>
            Color mode applies across the dashboard, stock pages, and settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeModeSetting />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ChartLine className="h-5 w-5 text-primary" />
            <CardTitle>Forecast Preferences</CardTitle>
          </div>
          <CardDescription>
            Defaults applied when you open a stock&apos;s forecast chart
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Forecast Horizon</Label>
            <Select
              value={settings.defaultHorizon}
              onValueChange={(v) => v && settings.setField("defaultHorizon", v)}
            >
              <SelectTrigger aria-label="Default Forecast Horizon">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Preferred Model</Label>
            <Select
              value={settings.preferredModel}
              onValueChange={(v) => v && settings.setField("preferredModel", v)}
            >
              <SelectTrigger aria-label="Preferred Model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="naive">Naive Baseline</SelectItem>
                <SelectItem value="ma">Moving Average</SelectItem>
                <SelectItem value="linear">Linear Regression</SelectItem>
                <SelectItem value="lstm">LSTM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <SettingRow
            label="Show Model Comparison"
            description="Display comparison table with baseline models"
            checked={settings.showModelComparison}
            onCheckedChange={(v) =>
              settings.setField("showModelComparison", v)
            }
          />
          <Separator />
          <SettingRow
            label="Display AI Insights"
            description="Show plain-language interpretation of forecasts"
            checked={settings.displayAiInsights}
            onCheckedChange={(v) => settings.setField("displayAiInsights", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle>Data & Display</CardTitle>
          </div>
          <CardDescription>
            Chart range default and live price refresh behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Time Range</Label>
            <Select
              value={settings.defaultTimeRange}
              onValueChange={(v) => v && settings.setField("defaultTimeRange", v)}
            >
              <SelectTrigger aria-label="Default Time Range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="90d">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <SettingRow
            label="Auto-refresh Data"
            description="Automatically update prices during market hours while the dashboard is open"
            checked={settings.autoRefresh}
            onCheckedChange={(v) => settings.setField("autoRefresh", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Privacy & Disclaimers</CardTitle>
          </div>
          <CardDescription>
            Important information about data usage and limitations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow
            label="Show Disclaimer Banners"
            description="Display educational disclaimers on forecast pages"
            checked={settings.showDisclaimerBanners}
            onCheckedChange={(v) =>
              settings.setField("showDisclaimerBanners", v)
            }
          />
          <Separator />
          <div className="space-y-2">
            <Label>About StockLens PH</Label>
            <div className="space-y-2 rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Educational Purpose Only:</strong>{" "}
                StockLens PH is designed for educational and research purposes.
                All forecasts are experimental and should not be used as the sole
                basis for investment decisions.
              </p>
              <p>
                <strong className="text-foreground">Not Financial Advice:</strong>{" "}
                This tool does not provide financial advice. Always consult with
                licensed financial advisors before making investment decisions.
              </p>
              <p>{FORECAST_DISCLAIMER}</p>
            </div>
          </div>
          <div className="pt-2">
            <Link href="/terms">
              <Button variant="outline" className="w-full">
                View Full Terms & Conditions
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="md:hidden">
        <CardHeader>
          <div className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-primary" />
            <CardTitle>Account</CardTitle>
          </div>
          <CardDescription>
            Sign out of this app on this device. Available here so it&apos;s reachable on
            mobile, where the sidebar isn&apos;t shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleLogout}>
            Log out
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Changes apply immediately — no need to save.
        </p>
        <Button variant="outline" onClick={handleReset}>
          Reset to Defaults
        </Button>
      </div>
    </>
  );
}
