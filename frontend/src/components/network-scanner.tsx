import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Download,
  Wifi,
  Monitor,
  Smartphone,
  Server,
  Router,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Device {
  ip: string;
  mac: string;
  hostname: string;
  vendor: string;
  deviceType: 'computer' | 'phone' | 'server' | 'router' | 'iot';
  status: 'online' | 'offline';
  lastSeen: string;
  openPorts?: number[];
  vulnerability?: 'low' | 'medium' | 'high';
}

const mockDevices: Device[] = [
  { ip: '192.168.1.1', mac: '00:1B:44:11:3A:B7', hostname: 'router.local', vendor: 'Netgear', deviceType: 'router', status: 'online', lastSeen: 'Now' },
  { ip: '192.168.1.10', mac: 'AC:DE:48:00:11:22', hostname: 'desktop-pc', vendor: 'Dell Inc.', deviceType: 'computer', status: 'online', lastSeen: '2 min ago', openPorts: [22, 80, 443], vulnerability: 'low' },
  { ip: '192.168.1.25', mac: 'F0:18:98:35:CF:12', hostname: 'iPhone-Pro', vendor: 'Apple Inc.', deviceType: 'phone', status: 'online', lastSeen: '1 min ago' },
  { ip: '192.168.1.100', mac: '08:00:27:12:34:56', hostname: 'home-server', vendor: 'Intel Corp.', deviceType: 'server', status: 'online', lastSeen: 'Now', openPorts: [21, 22, 80, 443, 3306], vulnerability: 'medium' },
  { ip: '192.168.1.45', mac: '2C:F0:5D:12:34:AB', hostname: 'smart-tv', vendor: 'Samsung', deviceType: 'iot', status: 'offline', lastSeen: '15 min ago' }
];

const getDeviceIcon = (type: string) => {
  switch (type) {
    case 'computer': return Monitor;
    case 'phone': return Smartphone;
    case 'server': return Server;
    case 'router': return Router;
    case 'iot': return Wifi;
    default: return Monitor;
  }
};

const getStatusColor = (status: string) => {
  return status === 'online' ? 'text-green-500' : 'text-gray-500';
};

const getVulnerabilityColor = (level?: string) => {
  switch (level) {
    case 'high': return 'destructive';
    case 'medium': return 'secondary';
    case 'low': return 'outline';
    default: return 'outline';
  }
};

export function NetworkScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [ipRange, setIpRange] = useState('192.168.1.1-254');
  const [scanType, setScanType] = useState('quick');
  const [devices] = useState<Device[]>(mockDevices);
  const [activeTab, setActiveTab] = useState('devices');

  const handleScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    
    // Simulate scanning progress
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          return 100;
        }
        return prev + Math.random() * 10;
      });
    }, 200);
  };

  const handleStop = () => {
    setIsScanning(false);
    setScanProgress(0);
  };

  const handleReset = () => {
    setScanProgress(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold">Network Scanner</h1>
        <p className="text-muted-foreground">Discover and analyze devices on your network</p>
      </motion.div>

      {/* Scan Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Wifi className="h-5 w-5" />
              <span>Scan Configuration</span>
            </CardTitle>
            <CardDescription>Configure network scanning parameters</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="ip-range">IP Range</Label>
                <Input
                  id="ip-range"
                  value={ipRange}
                  onChange={(e) => setIpRange(e.target.value)}
                  placeholder="192.168.1.1-254"
                />
              </div>
              <div className="space-y-2">
                <Label>Scan Type</Label>
                <Select value={scanType} onValueChange={setScanType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quick">Quick Scan</SelectItem>
                    <SelectItem value="comprehensive">Comprehensive Scan</SelectItem>
                    <SelectItem value="stealth">Stealth Scan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end space-x-2">
                <Button 
                  onClick={handleScan} 
                  disabled={isScanning}
                  className="flex-1"
                >
                  {isScanning ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Scan
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleStop} disabled={!isScanning}>
                  <Pause className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            {(isScanning || scanProgress > 0) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2"
              >
                <div className="flex justify-between text-sm">
                  <span>Scanning progress</span>
                  <span>{Math.round(scanProgress)}%</span>
                </div>
                <Progress value={scanProgress} className="h-2" />
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Results */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Scan Results</span>
                </CardTitle>
                <CardDescription>
                  Found {devices.length} devices • {devices.filter(d => d.status === 'online').length} online
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="devices">Devices ({devices.length})</TabsTrigger>
                <TabsTrigger value="vulnerabilities">
                  Vulnerabilities ({devices.filter(d => d.vulnerability).length})
                </TabsTrigger>
                <TabsTrigger value="ports">Open Ports</TabsTrigger>
              </TabsList>

              <TabsContent value="devices" className="mt-4">
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Device</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>MAC Address</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Seen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {devices.map((device, index) => {
                        const DeviceIcon = getDeviceIcon(device.deviceType);
                        return (
                          <motion.tr
                            key={device.ip}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="hover:bg-accent/50 transition-colors"
                          >
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <DeviceIcon className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <div className="font-medium">{device.hostname}</div>
                                  <div className="text-xs text-muted-foreground capitalize">
                                    {device.deviceType}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">{device.ip}</TableCell>
                            <TableCell className="font-mono text-sm">{device.mac}</TableCell>
                            <TableCell>{device.vendor}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                {device.status === 'online' ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Clock className="h-4 w-4 text-gray-500" />
                                )}
                                <span className={getStatusColor(device.status)}>
                                  {device.status}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{device.lastSeen}</TableCell>
                          </motion.tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="vulnerabilities" className="mt-4">
                <div className="space-y-4">
                  {devices.filter(d => d.vulnerability).map((device, index) => (
                    <motion.div
                      key={device.ip}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <AlertCircle className={`h-5 w-5 ${
                            device.vulnerability === 'high' ? 'text-red-500' :
                            device.vulnerability === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                          }`} />
                          <div>
                            <div className="font-medium">{device.hostname}</div>
                            <div className="text-sm text-muted-foreground">{device.ip}</div>
                          </div>
                        </div>
                        <Badge variant={getVulnerabilityColor(device.vulnerability)}>
                          {device.vulnerability?.toUpperCase()} RISK
                        </Badge>
                      </div>
                      {device.openPorts && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-sm text-muted-foreground">Open Ports:</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {device.openPorts.map(port => (
                              <Badge key={port} variant="outline" className="text-xs">
                                {port}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="ports" className="mt-4">
                <div className="space-y-4">
                  {devices.filter(d => d.openPorts?.length).map((device, index) => (
                    <motion.div
                      key={device.ip}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-medium">{device.hostname}</div>
                          <div className="text-sm text-muted-foreground">{device.ip}</div>
                        </div>
                        <Badge>{device.openPorts?.length} ports</Badge>
                      </div>
                      <div className="grid grid-cols-8 gap-2">
                        {device.openPorts?.map(port => (
                          <Badge key={port} variant="secondary" className="justify-center">
                            {port}
                          </Badge>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}