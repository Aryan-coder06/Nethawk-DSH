import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Shield,
  Bell,
  Palette,
  Database,
  Network,
  Save,
  RotateCcw,
  Info,
  ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/components/theme-provider';
import { Tooltip as Hint, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageGuide } from '@/components/page-guide';
import { toast } from 'sonner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const defaultProfile = {
  username: 'admin',
  email: 'admin@nethawk.local',
  organization: 'NetHawk Security',
  timezone: 'utc'
};

const defaultNetwork = {
  default_interface: 'eth0',
  default_range: '192.168.1.0/24'
};

const defaultAppearance = {
  theme: 'dark',
  compact_mode: false,
  animations: true,
  auto_collapse_sidebar: true,
  default_view: 'overview'
};

const defaultNotifications = {
  email: true,
  desktop: true,
  sound: false,
  security: true
};

const defaultThresholds = {
  cpu: 80,
  memory: 85,
  bandwidth: 100,
  disk: 90
};

const defaultSecurity = {
  two_factor: false,
  session_timeout: '30',
  audit_logging: true,
  allowed_ips: '0.0.0.0/0',
  api_access: false
};

const defaultAdvanced = {
  timeout: '30',
  threads: '10',
  retries: '3',
  autoSave: true
};

const defaultDataManagement = {
  retentionDays: '30',
  exportFormat: 'json',
  dbCleanup: true
};

export function Settings() {
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState(defaultProfile);
  const [network, setNetwork] = useState(defaultNetwork);
  const [appearance, setAppearance] = useState(defaultAppearance);
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [thresholds, setThresholds] = useState(defaultThresholds);
  const [security, setSecurity] = useState(defaultSecurity);
  const [scanSettings, setScanSettings] = useState(defaultAdvanced);
  const [dataManagement, setDataManagement] = useState(defaultDataManagement);
  const [saving, setSaving] = useState(false);
  const guideRef = useRef<HTMLDivElement | null>(null);

  const scrollToGuide = () => {
    guideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/settings/`);
        if (!response.ok) return;
        const data = await response.json();
        setProfile({ ...defaultProfile, ...data.profile });
        setNetwork({ ...defaultNetwork, ...data.network });
        setAppearance({ ...defaultAppearance, ...data.appearance });
        setNotifications({ ...defaultNotifications, ...data.notifications });
        setThresholds({ ...defaultThresholds, ...data.thresholds });
        setSecurity({ ...defaultSecurity, ...data.security });
        setScanSettings({
          timeout: String(data.advanced?.scan_timeout ?? defaultAdvanced.timeout),
          threads: String(data.advanced?.scan_threads ?? defaultAdvanced.threads),
          retries: String(data.advanced?.scan_retries ?? defaultAdvanced.retries),
          autoSave: data.advanced?.auto_save ?? defaultAdvanced.autoSave
        });
        setDataManagement({
          retentionDays: String(data.advanced?.retention_days ?? defaultDataManagement.retentionDays),
          exportFormat: data.advanced?.export_format ?? defaultDataManagement.exportFormat,
          dbCleanup: data.advanced?.db_cleanup ?? defaultDataManagement.dbCleanup
        });
        if (data.appearance?.theme) {
          setTheme(data.appearance.theme);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };

    fetchSettings();
  }, [setTheme]);

  const buildPayload = (override?: Partial<typeof defaultAppearance>) => ({
    profile,
    network,
    appearance: { ...appearance, theme, ...override },
    notifications,
    thresholds,
    security,
    advanced: {
      scan_timeout: Number(scanSettings.timeout),
      scan_threads: Number(scanSettings.threads),
      scan_retries: Number(scanSettings.retries),
      auto_save: scanSettings.autoSave,
      retention_days: dataManagement.retentionDays,
      export_format: dataManagement.exportFormat,
      db_cleanup: dataManagement.dbCleanup
    }
  });

  const saveSettings = async (payload: any) => {
    setSaving(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
      const data = await response.json();
      if (data?.settings) {
        setProfile({ ...defaultProfile, ...data.settings.profile });
        setNetwork({ ...defaultNetwork, ...data.settings.network });
        setAppearance({ ...defaultAppearance, ...data.settings.appearance });
        setNotifications({ ...defaultNotifications, ...data.settings.notifications });
        setThresholds({ ...defaultThresholds, ...data.settings.thresholds });
        setSecurity({ ...defaultSecurity, ...data.settings.security });
        setScanSettings({
          timeout: String(data.settings.advanced?.scan_timeout ?? defaultAdvanced.timeout),
          threads: String(data.settings.advanced?.scan_threads ?? defaultAdvanced.threads),
          retries: String(data.settings.advanced?.scan_retries ?? defaultAdvanced.retries),
          autoSave: data.settings.advanced?.auto_save ?? defaultAdvanced.autoSave
        });
        setDataManagement({
          retentionDays: String(data.settings.advanced?.retention_days ?? defaultDataManagement.retentionDays),
          exportFormat: data.settings.advanced?.export_format ?? defaultDataManagement.exportFormat,
          dbCleanup: data.settings.advanced?.db_cleanup ?? defaultDataManagement.dbCleanup
        });
      }
      toast.success('Settings saved', {
        description: 'Your preferences are now active.'
      });
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error('Save failed', {
        description: 'Backend not reachable or returned an error.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    saveSettings(buildPayload());
  };

  const handleReset = () => {
    setProfile(defaultProfile);
    setNetwork(defaultNetwork);
    setAppearance(defaultAppearance);
    setNotifications(defaultNotifications);
    setThresholds(defaultThresholds);
    setSecurity(defaultSecurity);
    setScanSettings(defaultAdvanced);
    setDataManagement(defaultDataManagement);
    setTheme(defaultAppearance.theme);
    saveSettings({
      profile: defaultProfile,
      network: defaultNetwork,
      appearance: defaultAppearance,
      notifications: defaultNotifications,
      thresholds: defaultThresholds,
      security: defaultSecurity,
      advanced: {
        scan_timeout: Number(defaultAdvanced.timeout),
        scan_threads: Number(defaultAdvanced.threads),
        scan_retries: Number(defaultAdvanced.retries),
        auto_save: defaultAdvanced.autoSave,
        retention_days: defaultDataManagement.retentionDays,
        export_format: defaultDataManagement.exportFormat,
        db_cleanup: defaultDataManagement.dbCleanup
      }
    });
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Configure NetHawk dashboard preferences and behavior</p>
          </div>
          <TooltipProvider>
            <Hint>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  onClick={scrollToGuide}
                  whileHover={{ y: 3 }}
                  className="group hidden items-center gap-2 rounded-full border border-border/60 bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm transition hover:text-foreground md:flex"
                >
                  <Info className="h-4 w-4 text-primary" />
                  How it works
                  <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-1" />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>Jump to the settings guide below</TooltipContent>
            </Hint>
          </TooltipProvider>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="general" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="appearance">Appearance</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    User Profile
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input id="username" value={profile.username} onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={profile.email} onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="organization">Organization</Label>
                      <Input id="organization" value={profile.organization} onChange={(e) => setProfile(prev => ({ ...prev, organization: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select value={profile.timezone} onValueChange={(value) => setProfile(prev => ({ ...prev, timezone: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="utc">UTC</SelectItem>
                          <SelectItem value="est">Eastern Time</SelectItem>
                          <SelectItem value="pst">Pacific Time</SelectItem>
                          <SelectItem value="gmt">GMT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <Network className="h-5 w-5 mr-2" />
                    Network Settings
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="default-interface">Default Network Interface</Label>
                      <Select value={network.default_interface} onValueChange={(value) => setNetwork(prev => ({ ...prev, default_interface: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eth0">eth0 (Ethernet)</SelectItem>
                          <SelectItem value="wlan0">wlan0 (WiFi)</SelectItem>
                          <SelectItem value="lo">lo (Loopback)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="default-range">Default IP Range</Label>
                      <Input id="default-range" value={network.default_range} onChange={(e) => setNetwork(prev => ({ ...prev, default_range: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="appearance" className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <Palette className="h-5 w-5 mr-2" />
                    Theme & Display
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Theme</Label>
                        <p className="text-sm text-muted-foreground">Choose your preferred color scheme</p>
                      </div>
                      <Select value={theme} onValueChange={(value) => { setTheme(value); setAppearance(prev => ({ ...prev, theme: value })); }}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Compact Mode</Label>
                        <p className="text-sm text-muted-foreground">Reduce spacing and padding for more content</p>
                      </div>
                      <Switch checked={appearance.compact_mode} onCheckedChange={(checked) => setAppearance(prev => ({ ...prev, compact_mode: checked }))} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Animations</Label>
                        <p className="text-sm text-muted-foreground">Enable smooth transitions and animations</p>
                      </div>
                      <Switch checked={appearance.animations} onCheckedChange={(checked) => setAppearance(prev => ({ ...prev, animations: checked }))} />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">Dashboard Layout</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-collapse Sidebar</Label>
                        <p className="text-sm text-muted-foreground">Automatically collapse sidebar on smaller screens</p>
                      </div>
                      <Switch checked={appearance.auto_collapse_sidebar} onCheckedChange={(checked) => setAppearance(prev => ({ ...prev, auto_collapse_sidebar: checked }))} />
                    </div>

                    <div className="space-y-2">
                      <Label>Default Dashboard View</Label>
                      <Select value={appearance.default_view} onValueChange={(value) => setAppearance(prev => ({ ...prev, default_view: value }))}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="overview">Overview</SelectItem>
                          <SelectItem value="network-scanner">Network Scanner</SelectItem>
                          <SelectItem value="bandwidth">Bandwidth Monitor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notifications" className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <Bell className="h-5 w-5 mr-2" />
                    Notification Preferences
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">Receive alerts via email</p>
                      </div>
                      <Switch checked={notifications.email} onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email: checked }))} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Desktop Notifications</Label>
                        <p className="text-sm text-muted-foreground">Show browser notifications</p>
                      </div>
                      <Switch checked={notifications.desktop} onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, desktop: checked }))} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Sound Alerts</Label>
                        <p className="text-sm text-muted-foreground">Play sound for important alerts</p>
                      </div>
                      <Switch checked={notifications.sound} onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, sound: checked }))} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Security Alerts</Label>
                        <p className="text-sm text-muted-foreground">High priority security notifications</p>
                      </div>
                      <Switch checked={notifications.security} onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, security: checked }))} />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">Alert Thresholds</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cpu-threshold">CPU Usage Alert (%)</Label>
                      <Input id="cpu-threshold" type="number" value={thresholds.cpu} onChange={(e) => setThresholds(prev => ({ ...prev, cpu: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memory-threshold">Memory Usage Alert (%)</Label>
                      <Input id="memory-threshold" type="number" value={thresholds.memory} onChange={(e) => setThresholds(prev => ({ ...prev, memory: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bandwidth-threshold">Bandwidth Alert (Mbps)</Label>
                      <Input id="bandwidth-threshold" type="number" value={thresholds.bandwidth} onChange={(e) => setThresholds(prev => ({ ...prev, bandwidth: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="disk-threshold">Disk Usage Alert (%)</Label>
                      <Input id="disk-threshold" type="number" value={thresholds.disk} onChange={(e) => setThresholds(prev => ({ ...prev, disk: Number(e.target.value) }))} />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="security" className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Security Settings
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Two-Factor Authentication</Label>
                        <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{security.two_factor ? 'Enabled' : 'Disabled'}</Badge>
                        <Button variant="outline" size="sm" disabled>Enable</Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Session Timeout</Label>
                        <p className="text-sm text-muted-foreground">Automatically log out after inactivity</p>
                      </div>
                      <Select value={security.session_timeout} onValueChange={(value) => setSecurity(prev => ({ ...prev, session_timeout: value }))}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                          <SelectItem value="0">Never</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Audit Logging</Label>
                        <p className="text-sm text-muted-foreground">Log all user actions and system events</p>
                      </div>
                      <Switch checked={security.audit_logging} onCheckedChange={(checked) => setSecurity(prev => ({ ...prev, audit_logging: checked }))} />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">Access Control</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="allowed-ips">Allowed IP Addresses</Label>
                      <Input id="allowed-ips" value={security.allowed_ips} onChange={(e) => setSecurity(prev => ({ ...prev, allowed_ips: e.target.value }))} />
                      <p className="text-xs text-muted-foreground">
                        Comma-separated list of IP ranges. Use 0.0.0.0/0 for all IPs.
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>API Access</Label>
                        <p className="text-sm text-muted-foreground">Allow external API access to NetHawk</p>
                      </div>
                      <Switch checked={security.api_access} onCheckedChange={(checked) => setSecurity(prev => ({ ...prev, api_access: checked }))} />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <Database className="h-5 w-5 mr-2" />
                    Scan Configuration
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scan-timeout">Scan Timeout (seconds)</Label>
                      <Input id="scan-timeout" type="number" value={scanSettings.timeout} onChange={(e) => setScanSettings(prev => ({ ...prev, timeout: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scan-threads">Concurrent Threads</Label>
                      <Input id="scan-threads" type="number" value={scanSettings.threads} onChange={(e) => setScanSettings(prev => ({ ...prev, threads: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scan-retries">Retry Attempts</Label>
                      <Input id="scan-retries" type="number" value={scanSettings.retries} onChange={(e) => setScanSettings(prev => ({ ...prev, retries: e.target.value }))} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-save Results</Label>
                        <p className="text-sm text-muted-foreground">Automatically save scan results</p>
                      </div>
                      <Switch checked={scanSettings.autoSave} onCheckedChange={(checked) => setScanSettings(prev => ({ ...prev, autoSave: checked }))} />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">Data Management</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Data Retention Period</Label>
                        <p className="text-sm text-muted-foreground">How long to keep scan results and logs</p>
                      </div>
                      <Select value={dataManagement.retentionDays} onValueChange={(value) => setDataManagement(prev => ({ ...prev, retentionDays: value }))}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="365">1 year</SelectItem>
                          <SelectItem value="0">Forever</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Export Format</Label>
                        <p className="text-sm text-muted-foreground">Default format for data exports</p>
                      </div>
                      <Select value={dataManagement.exportFormat} onValueChange={(value) => setDataManagement(prev => ({ ...prev, exportFormat: value }))}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="json">JSON</SelectItem>
                          <SelectItem value="csv">CSV</SelectItem>
                          <SelectItem value="xml">XML</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Database Cleanup</Label>
                        <p className="text-sm text-muted-foreground">Automatically clean old data</p>
                      </div>
                      <Switch checked={dataManagement.dbCleanup} onCheckedChange={(checked) => setDataManagement(prev => ({ ...prev, dbCleanup: checked }))} />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-end space-x-2 pt-6 border-t">
              <Button variant="outline" onClick={handleReset} disabled={saving}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div ref={guideRef} className="pt-4">
        <PageGuide
          headlineParts={[
            { text: 'Settings that ', highlight: false },
            { text: 'actually matter', highlight: true },
            { text: ' when you scan and monitor.', highlight: false }
          ]}
          description="Your preferences sync to the backend and tune how every tool behaves."
          items={[
            {
              title: 'Scan tuning',
              description: 'Timeouts, retries, and threads are applied directly to nmap.'
            },
            {
              title: 'Alert thresholds',
              description: 'Set guardrails for CPU, memory, bandwidth, and disk.'
            },
            {
              title: 'Appearance & layout',
              description: 'Theme and layout options keep the dashboard comfortable.'
            }
          ]}
          innovations={[
            'Backend-synced settings (not just UI toggles).',
            'Scan performance is user-tuned without code changes.',
            'Designed for quick adjustments during live monitoring.'
          ]}
        />
      </div>
    </div>
  );
}
