// src/components/bandwidth-monitor.tsx

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, Download, Upload, Wifi, TrendingUp, TrendingDown,
  BarChart3, RefreshCw, AlertTriangle, Settings, Info, ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Tooltip as Hint, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageGuide } from '@/components/page-guide';

import { io } from 'socket.io-client';

interface BandwidthData {
  timestamp: string;
  download: number;
  upload: number;
  ping: number;
}

interface InterfaceUsage {
  name: string;
  upload: number;
  download: number;
  total: number;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;


const socket = io(BACKEND_URL); 

export function BandwidthMonitor() {
  const [realtimeData, setRealtimeData] = useState<BandwidthData[]>([]);
  const [historyData, setHistoryData] = useState<BandwidthData[]>([]);
  const [interfaceUsage, setInterfaceUsage] = useState<InterfaceUsage[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [timeRange, setTimeRange] = useState('30s');
  const [currentDownload, setCurrentDownload] = useState(0);
  const [currentUpload, setCurrentUpload] = useState(0);
  const [currentPing, setCurrentPing] = useState(0);
  const guideRef = useRef<HTMLDivElement | null>(null);

  const scrollToGuide = () => {
    guideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };


  const getMaxPoints = (range: string) => {
    switch (range) {
      case '30s':
        return 15;
      case '1m':
        return 30;
      case '5m':
        return 150;
      case '1h':
        return 1800;
      default:
        return 30;
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/bandwidth/history`);
        if (!response.ok) return;
        const data = await response.json();
        setHistoryData(data);
      } catch (err) {
        console.error('Failed to fetch bandwidth history:', err);
      }
    };

    const fetchInterfaces = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/bandwidth/interfaces`);
        if (!response.ok) return;
        const data = await response.json();
        setInterfaceUsage(data);
      } catch (err) {
        console.error('Failed to fetch interface usage:', err);
      }
    };

    fetchHistory();
    fetchInterfaces();

    const interval = setInterval(() => {
      fetchHistory();
      fetchInterfaces();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isMonitoring) {
      socket.connect();
    } else {
      socket.disconnect();
    }

    const handleBandwidthUpdate = (newDataPoint: BandwidthData) => {
      setCurrentDownload(newDataPoint.download);
      setCurrentUpload(newDataPoint.upload);
      setCurrentPing(newDataPoint.ping);
      setRealtimeData(prev => {
        const updatedData = [...prev, newDataPoint];
        const maxPoints = getMaxPoints(timeRange);
        return updatedData.length > maxPoints ? updatedData.slice(updatedData.length - maxPoints) : updatedData;
      });
    };
    
    socket.on('bandwidth_update', handleBandwidthUpdate);

    return () => {
      socket.off('bandwidth_update', handleBandwidthUpdate);
      socket.disconnect();
    };
  }, [isMonitoring, timeRange]);

  const totalBandwidth = currentDownload + currentUpload;
  const maxBandwidth = 200; // Mbps
  const utilizationPercentage = (totalBandwidth / maxBandwidth) * 100;

  const MetricCard = ({ title, value, unit, icon: Icon, trend, color, info }: any) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {title}
            {info && (
              <TooltipProvider>
                <Hint>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{info}</TooltipContent>
                </Hint>
              </TooltipProvider>
            )}
          </CardTitle>
          <Icon className={`h-4 w-4 ${color}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {value.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
          </div>
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            {trend > 0 ? (
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
            )}
            {Math.abs(trend).toFixed(1)}% from avg
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1 className="text-3xl font-bold">Bandwidth Monitor</h1>
          <p className="text-muted-foreground">Real-time network bandwidth monitoring and analysis</p>
        </div>
        <div className="flex items-center space-x-2">
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
              <TooltipContent>Jump to the bandwidth guide below</TooltipContent>
            </Hint>
          </TooltipProvider>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30s">Last 30s</SelectItem>
              <SelectItem value="1m">Last 1m</SelectItem>
              <SelectItem value="5m">Last 5m</SelectItem>
              <SelectItem value="1h">Last 1h</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setIsMonitoring(prev => !prev)}
            className={isMonitoring ? 'text-red-500' : 'text-green-500'}
          >
            {isMonitoring ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Stop
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Start
              </>
            )}
          </Button>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Current Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Download Speed"
          value={currentDownload}
          unit="Mbps"
          icon={Download}
          trend={8.2}
          color="text-green-500"
        />
        <MetricCard
          title="Upload Speed"
          value={currentUpload}
          unit="Mbps"
          icon={Upload}
          trend={-2.1}
          color="text-blue-500"
        />
        <MetricCard
          title="Ping"
          value={currentPing}
          unit="ms"
          icon={Wifi}
          trend={-5.3}
          color="text-yellow-500"
          info="Currently derived from CPU user % as a placeholder for latency."
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Total Utilization
                <TooltipProvider>
                  <Hint>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Based on total upload + download compared to a 200 Mbps cap.
                    </TooltipContent>
                  </Hint>
                </TooltipProvider>
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {utilizationPercentage.toFixed(1)}%
              </div>
              <Progress value={utilizationPercentage} className="mt-2" />
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                {utilizationPercentage > 80 && (
                  <>
                    <AlertTriangle className="h-3 w-3 mr-1 text-orange-500" />
                    High usage
                  </>
                )}
                {utilizationPercentage <= 80 && 'Normal usage'}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Real-time Traffic</span>
            </CardTitle>
            <CardDescription>Live bandwidth monitoring with 2-second intervals</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="realtime" className="space-y-4">
              <TabsList>
                <TabsTrigger value="realtime">Real-time</TabsTrigger>
                <TabsTrigger value="hourly">24-Hour History</TabsTrigger>
                <TabsTrigger value="devices">Device Usage</TabsTrigger>
              </TabsList>

              <TabsContent value="realtime">
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={realtimeData}>
                    <defs>
                      <linearGradient id="downloadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="timestamp" 
                      className="text-xs"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => [
                        `${value.toFixed(1)} Mbps`,
                        name === 'download' ? 'Download' : 'Upload'
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="download"
                      stroke="#22c55e"
                      fillOpacity={1}
                      fill="url(#downloadGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="upload"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#uploadGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="hourly">
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={historyData}>
                    <defs>
                      <linearGradient id="historyDownload" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="historyUpload" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="timestamp" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => [
                        `${value.toFixed(1)} Mbps`,
                        name === 'download' ? 'Download' : 'Upload'
                      ]}
                    />
                    <Area type="monotone" dataKey="download" stroke="#22c55e" fillOpacity={1} fill="url(#historyDownload)" strokeWidth={2} />
                    <Area type="monotone" dataKey="upload" stroke="#3b82f6" fillOpacity={1} fill="url(#historyUpload)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="devices">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <span>Interface usage (upload + download)</span>
                      <TooltipProvider>
                        <Hint>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground hover:text-foreground">
                              <Info className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Uses per-interface counters from this machine (not per-device LAN usage).
                          </TooltipContent>
                        </Hint>
                      </TooltipProvider>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={interfaceUsage} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                          {interfaceUsage.map((entry, index) => (
                            <Cell key={`cell-${entry.name}`} fill={['#0ea5e9', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${value.toFixed(2)} Mbps`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {interfaceUsage.map((iface) => (
                      <div key={iface.name} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <div className="font-medium">{iface.name}</div>
                          <div className="text-xs text-muted-foreground">Upload {iface.upload} Mbps • Download {iface.download} Mbps</div>
                        </div>
                        <div className="text-sm font-semibold">{iface.total} Mbps</div>
                      </div>
                    ))}
                    {interfaceUsage.length === 0 && (
                      <div className="text-sm text-muted-foreground">No interface data yet.</div>
                    )}
                  </div>
                </div>
              </TabsContent>
              
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      <div ref={guideRef} className="pt-4">
        <PageGuide
          headlineParts={[
            { text: 'Realtime ', highlight: false },
            { text: 'bandwidth', highlight: true },
            { text: ' signals that show ', highlight: false },
            { text: 'where', highlight: true },
            { text: ' your traffic goes.', highlight: false }
          ]}
          description="Every graph here is calculated from live interface counters on this machine."
          items={[
            {
              title: 'Real-time chart',
              description: 'Updates every ~2 seconds from the socket stream, perfect for live monitoring.'
            },
            {
              title: '24-hour history',
              description: 'Stored in memory (or Redis) to keep a longer performance story.'
            },
            {
              title: 'Interface usage',
              description: 'Compares Wi-Fi/Ethernet throughput to see what carries the most load.'
            }
          ]}
          innovations={[
            'Realtime + history in a single view without heavy tooling.',
            'Interface-aware totals make the numbers trustworthy.',
            'Built for non-technical users to read quickly.'
          ]}
        />
      </div>
    </div>
  );
}
