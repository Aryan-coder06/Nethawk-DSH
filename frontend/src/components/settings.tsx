import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  User, 
  Shield, 
  Bell, 
  Palette,
  Database,
  Network,
  Save,
  RotateCcw
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

export function Settings() {
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState({
    email: true,
    desktop: true,
    sound: false,
    security: true
  });
  const [scanSettings, setScanSettings] = useState({
    timeout: '30',
    threads: '10',
    retries: '3',
    autoSave: true
  });

  const handleSave = () => {
    console.log('Settings saved');
  };

  const handleReset = () => {
    setNotifications({
      email: true,
      desktop: true,
      sound: false,
      security: true
    });
    setScanSettings({
      timeout: '30',
      threads: '10',
      retries: '3',
      autoSave: true
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure NetHawk dashboard preferences and behavior</p>
      </motion.div>

      {/* Settings Tabs */}
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
                      <Input id="username" defaultValue="admin" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" defaultValue="admin@nethawk.local" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="organization">Organization</Label>
                      <Input id="organization" defaultValue="NetHawk Security" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select defaultValue="utc">
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
                      <Select defaultValue="eth0">
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
                      <Input id="default-range" defaultValue="192.168.1.0/24" />
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
                        <p className="text-sm text-muted-foreground">
                          Choose your preferred color scheme
                        </p>
                      </div>
                      <Select value={theme} onValueChange={setTheme}>
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
                        <p className="text-sm text-muted-foreground">
                          Reduce spacing and padding for more content
                        </p>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Animations</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable smooth transitions and animations
                        </p>
                      </div>
                      <Switch defaultChecked />
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
                        <p className="text-sm text-muted-foreground">
                          Automatically collapse sidebar on smaller screens
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="space-y-2">
                      <Label>Default Dashboard View</Label>
                      <Select defaultValue="overview">
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
                        <p className="text-sm text-muted-foreground">
                          Receive alerts via email
                        </p>
                      </div>
                      <Switch 
                        checked={notifications.email}
                        onCheckedChange={(checked) => 
                          setNotifications(prev => ({ ...prev, email: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Desktop Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Show browser notifications
                        </p>
                      </div>
                      <Switch 
                        checked={notifications.desktop}
                        onCheckedChange={(checked) => 
                          setNotifications(prev => ({ ...prev, desktop: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Sound Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Play sound for important alerts
                        </p>
                      </div>
                      <Switch 
                        checked={notifications.sound}
                        onCheckedChange={(checked) => 
                          setNotifications(prev => ({ ...prev, sound: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Security Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          High priority security notifications
                        </p>
                      </div>
                      <Switch 
                        checked={notifications.security}
                        onCheckedChange={(checked) => 
                          setNotifications(prev => ({ ...prev, security: checked }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">Alert Thresholds</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cpu-threshold">CPU Usage Alert (%)</Label>
                      <Input id="cpu-threshold" type="number" defaultValue="80" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memory-threshold">Memory Usage Alert (%)</Label>
                      <Input id="memory-threshold" type="number" defaultValue="85" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bandwidth-threshold">Bandwidth Alert (Mbps)</Label>
                      <Input id="bandwidth-threshold" type="number" defaultValue="100" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="disk-threshold">Disk Usage Alert (%)</Label>
                      <Input id="disk-threshold" type="number" defaultValue="90" />
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
                        <p className="text-sm text-muted-foreground">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">Disabled</Badge>
                        <Button variant="outline" size="sm">Enable</Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Session Timeout</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically log out after inactivity
                        </p>
                      </div>
                      <Select defaultValue="30">
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
                        <p className="text-sm text-muted-foreground">
                          Log all user actions and system events
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">Access Control</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="allowed-ips">Allowed IP Addresses</Label>
                      <Input 
                        id="allowed-ips" 
                        placeholder="192.168.1.0/24, 10.0.0.0/8" 
                        defaultValue="0.0.0.0/0"
                      />
                      <p className="text-xs text-muted-foreground">
                        Comma-separated list of IP ranges. Use 0.0.0.0/0 for all IPs.
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>API Access</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow external API access to NetHawk
                        </p>
                      </div>
                      <Switch />
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
                      <Input 
                        id="scan-timeout" 
                        type="number" 
                        value={scanSettings.timeout}
                        onChange={(e) => setScanSettings(prev => ({ ...prev, timeout: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scan-threads">Concurrent Threads</Label>
                      <Input 
                        id="scan-threads" 
                        type="number" 
                        value={scanSettings.threads}
                        onChange={(e) => setScanSettings(prev => ({ ...prev, threads: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scan-retries">Retry Attempts</Label>
                      <Input 
                        id="scan-retries" 
                        type="number" 
                        value={scanSettings.retries}
                        onChange={(e) => setScanSettings(prev => ({ ...prev, retries: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-save Results</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically save scan results
                        </p>
                      </div>
                      <Switch 
                        checked={scanSettings.autoSave}
                        onCheckedChange={(checked) => 
                          setScanSettings(prev => ({ ...prev, autoSave: checked }))
                        }
                      />
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
                        <p className="text-sm text-muted-foreground">
                          How long to keep scan results and logs
                        </p>
                      </div>
                      <Select defaultValue="30">
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
                        <p className="text-sm text-muted-foreground">
                          Default format for data exports
                        </p>
                      </div>
                      <Select defaultValue="json">
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
                        <p className="text-sm text-muted-foreground">
                          Automatically clean old data
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-2 pt-6 border-t">
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}