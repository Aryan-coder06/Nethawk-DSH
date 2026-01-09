import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, Cpu, HardDrive, Wifi, Shield, AlertTriangle,
  TrendingUp, Users, Server, Clock, Info, ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Tooltip as Hint, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageGuide } from '@/components/page-guide';


const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export function Overview() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [systemStats, setSystemStats] = useState({ cpu: 0, memory: 0, disk: 0, network: 0 });
  const [networkData, setNetworkData] = useState([]);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const guideRef = useRef<HTMLDivElement | null>(null);

  const scrollToGuide = () => {
    guideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
  const fetchData = async () => {
      try {
        // Update all fetch calls to use BACKEND_URL
        const statsRes = await fetch(`${BACKEND_URL}/api/overview/stats`);
        const stats = await statsRes.json();
        setSystemStats(stats);

        const trafficRes = await fetch(`${BACKEND_URL}/api/overview/traffic`);
        const traffic = await trafficRes.json();
        setNetworkData(traffic);

        const devicesRes = await fetch(`${BACKEND_URL}/api/overview/devices`);
        const devices = await devicesRes.json();
        setDeviceTypes(devices);

        const activityRes = await fetch(`${BACKEND_URL}/api/overview/activity`);
        const activity = await activityRes.json();
        setRecentActivities(activity);
      } catch (err) {
      console.error("Error fetching overview data:", err);
    }
  };

  fetchData(); // initial load
  const interval = setInterval(fetchData, 10000); // refresh every 10s

  return () => clearInterval(interval); // clean up
}, []);


  const StatCard = ({ title, value, icon: Icon, progress, trend, info }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">{title}{info ? (
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
          ) : null}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}%</div>
          <Progress value={progress} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2 flex items-center">
            <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
            {trend}% from last hour
          </p>
        </CardContent>
        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-3xl" />
      </Card>
    </motion.div>
  );

  return (
    <div className="space-y-6 ">
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1 className="text-3xl font-bold">Network Overview</h1>
          <p className="text-muted-foreground">Real-time system and network monitoring</p>
        </div>
        <div className="flex items-center gap-4">
          <TooltipProvider>
            <Hint>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  onClick={scrollToGuide}
                  whileHover={{ y: 3 }}
                  className="group flex items-center gap-2 rounded-full border border-border/60 bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm transition hover:text-foreground"
                >
                  <Info className="h-4 w-4 text-primary" />
                  How it works
                  <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-1" />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>Jump to the overview guide below</TooltipContent>
            </Hint>
          </TooltipProvider>
          <div className="text-right">
            <div className="text-2xl font-mono">{currentTime.toLocaleTimeString()}</div>
            <div className="text-sm text-muted-foreground">{currentTime.toLocaleDateString()}</div>
          </div>
        </div>
      </motion.div>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="CPU Usage" value={systemStats.cpu} icon={Cpu} progress={systemStats.cpu} trend="+2.1" />
        <StatCard title="Memory Usage" value={systemStats.memory} icon={Activity} progress={systemStats.memory} trend="+5.3" />
        <StatCard title="Disk Usage" value={systemStats.disk} icon={HardDrive} progress={systemStats.disk} trend="+1.2" />
        <StatCard title="Network Load" value={systemStats.network} icon={Wifi} progress={systemStats.network} trend="+8.7" info="Derived from total bytes sent+received; normalized to a 0-100 scale." />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Network Traffic */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Network Traffic</span>
              </CardTitle>
              <CardDescription>Upload and download speeds over 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={networkData}>
                  <defs>
                    <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="downloadGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="time" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="upload" stroke="#0ea5e9" fillOpacity={1} fill="url(#uploadGradient)" strokeWidth={2} />
                  <Area type="monotone" dataKey="download" stroke="#22c55e" fillOpacity={1} fill="url(#downloadGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Device Distribution */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Interface Breakdown</span>
                <TooltipProvider>
                  <Hint>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Counts local network interfaces by type (Ethernet, Wi-Fi, Loopback).
                    </TooltipContent>
                  </Hint>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>Local network interfaces detected on this machine</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={deviceTypes} cx="50%" cy="50%" outerRadius={80} dataKey="value" stroke="none">
                      {deviceTypes.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {deviceTypes.map((device: any) => (
                  <div key={device.name} className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: device.color }} />
                    <span className="text-sm">{device.name}</span>
                    <Badge variant="secondary" className="ml-auto">{device.value}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Recent Activity</span>
            </CardTitle>
            <CardDescription>Latest network events and alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity: any, index: number) => (
                <motion.div
                  key={activity.id}
                  className="flex items-start space-x-4 p-3 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <div className={`mt-1 p-1 rounded-full ${
                    activity.status === 'success' ? 'bg-green-500/20' :
                    activity.status === 'warning' ? 'bg-yellow-500/20' :
                    activity.status === 'info' ? 'bg-blue-500/20' : 'bg-red-500/20'
                  }`}>
                    {activity.type === 'scan' && <Shield className="h-3 w-3 text-green-500" />}
                    {activity.type === 'alert' && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
                    {activity.type === 'connection' && <Wifi className="h-3 w-3 text-blue-500" />}
                    {activity.type === 'security' && <Server className="h-3 w-3 text-green-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div ref={guideRef} className="pt-4">
        <PageGuide
          headlineParts={[
            { text: 'A clear ', highlight: false },
            { text: 'system', highlight: true },
            { text: ' heartbeat that explains ', highlight: false },
            { text: 'what', highlight: true },
            { text: ' your machine is doing.', highlight: false }
          ]}
          description="Your overview turns raw system counters into an easy story about health, load, and connectivity."
          items={[
            {
              title: 'CPU, Memory, Disk',
              description: 'Live snapshot from psutil. You see real usage, not a smoothed average.'
            },
            {
              title: 'Network Load',
              description: 'Bytes sent+received normalized to a 0–100 range for quick reading.'
            },
            {
              title: 'Interface Breakdown',
              description: 'Counts Ethernet/Wi-Fi/Loopback to show how your machine routes traffic.'
            }
          ]}
          innovations={[
            'Live counters are explained with context, not just numbers.',
            'Interface-level awareness keeps the chart honest about where traffic flows.',
            'Designed as a quick-read snapshot for non-experts.'
          ]}
        />
      </div>
    </div>
  );
}
