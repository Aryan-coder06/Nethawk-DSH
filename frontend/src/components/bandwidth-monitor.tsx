// src/components/bandwidth-monitor.tsx

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
// --- All your 'lucide-react' and UI component imports remain the same ---
import { 
  Activity, Download, Upload, Wifi, TrendingUp, TrendingDown,
  BarChart3, RefreshCw, AlertTriangle, Settings
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// 1. Import the socket.io client
import { io } from 'socket.io-client';

// 2. Define the data interfaces (they remain the same)
interface BandwidthData {
  timestamp: string;
  download: number;
  upload: number;
  ping: number;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;


const socket = io(BACKEND_URL); 

export function BandwidthMonitor() {
  // 4. Initialize state with empty or minimal data, not the generator function.
  const [realtimeData, setRealtimeData] = useState<BandwidthData[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [timeRange, setTimeRange] = useState('30s');
  const [currentDownload, setCurrentDownload] = useState(0);
  const [currentUpload, setCurrentUpload] = useState(0);
  const [currentPing, setCurrentPing] = useState(0);

  // 5. This is the core change: Replace setInterval with a WebSocket listener.
  useEffect(() => {
    // Start or stop the connection based on the monitoring state
    if (isMonitoring) {
      socket.connect();
    } else {
      socket.disconnect();
    }

    // Define the function to handle incoming data
    const handleBandwidthUpdate = (newDataPoint: BandwidthData) => {
      setCurrentDownload(newDataPoint.download);
      setCurrentUpload(newDataPoint.upload);
      setCurrentPing(newDataPoint.ping);

      // Add the new data point to our chart history
      setRealtimeData(prev => {
        const updatedData = [...prev, newDataPoint];
        // Keep the chart history to a manageable size (e.g., last 30 points)
        return updatedData.length > 30 ? updatedData.slice(1) : updatedData;
      });
    };
    
    // Listen for the 'bandwidth_update' event from the server
    socket.on('bandwidth_update', handleBandwidthUpdate);

    // This is a crucial cleanup step. It runs when the component unmounts or `isMonitoring` changes.
    // It prevents memory leaks and duplicate event listeners.
    return () => {
      socket.off('bandwidth_update', handleBandwidthUpdate);
      socket.disconnect();
    };
  }, [isMonitoring]); // Re-run this effect when the user toggles the Start/Stop button

  const totalBandwidth = currentDownload + currentUpload;
  const maxBandwidth = 200; // Mbps
  const utilizationPercentage = (totalBandwidth / maxBandwidth) * 100;

  // ... THE REST OF YOUR JSX (METRIC CARDS, CHARTS, ETC.) REMAINS EXACTLY THE SAME ...
  // --- It will now be powered by real data flowing into your state variables. ---
  const MetricCard = ({ title, value, unit, icon: Icon, trend, color }: any) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
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
      {/* Header */}
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
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Utilization</CardTitle>
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
              {/* ... Other TabsContent remain the same ... */}
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}