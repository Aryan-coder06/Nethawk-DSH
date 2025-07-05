import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
// All your 'lucide-react' and UI component imports remain the same
import { 
  Scan, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Play,
  Pause,
  Download, 
  Filter,   
  Search,   
  Settings
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';

import { io } from 'socket.io-client';

interface PortResult {
  number: number;
  status: 'open' | 'closed' | 'filtered'; 
  protocol: 'TCP' | 'UDP'; 
  service: string;
  version?: string; 
  vulnerability?: 'critical' | 'high' | 'medium' | 'low'; 
  description: string;
  details?: string; // For additional service info from backend
}

// Interface for general scan updates from backend
// Backend emits different data based on 'status' field, so this is a union type
interface ScanUpdateData {
  status: 'info' | 'progress' | 'open_port' | 'port_status' | 'error' | 'stopped' | 'complete';
  message?: string; // For info, error, stopped, complete
  progress?: number; // For progress updates
  port?: number; // For open_port, port_status
  state?: 'open' | 'closed' | 'filtered'; // For open_port, port_status
  service?: string; // For open_port
  ip?: string; // For open_port, port_status
  details?: string; // For open_port (e.g., service and version)
}
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// 2. Connect to the server. This should be outside the component.
const socket = io(BACKEND_URL); // Your Flask server URL

const commonPorts = [
  { number: 21, service: 'FTP', description: 'File Transfer Protocol' },
  { number: 22, service: 'SSH', description: 'Secure Shell' },
  { number: 23, service: 'Telnet', description: 'Telnet Protocol' },
  { number: 25, service: 'SMTP', description: 'Simple Mail Transfer Protocol' },
  { number: 53, service: 'DNS', description: 'Domain Name System' },
  { number: 80, service: 'HTTP', description: 'Hypertext Transfer Protocol' },
  { number: 110, service: 'POP3', description: 'Post Office Protocol v3' },
  { number: 143, service: 'IMAP', description: 'Internet Message Access Protocol' },
  { number: 443, service: 'HTTPS', description: 'HTTP Secure' },
  { number: 993, service: 'IMAPS', description: 'IMAP over SSL' },
  { number: 995, service: 'POP3S', description: 'POP3 over SSL' }
];

// Helper to get service/description for a port number from commonPorts
const getPortDetails = (portNumber: number) => {
  const commonPort = commonPorts.find(p => p.number === portNumber);
  return {
    service: commonPort ? commonPort.service : 'Unknown',
    description: commonPort ? commonPort.description : 'N/A'
  };
};

const getVulnerabilityColor = (level?: string) => {
  switch (level) {
    case 'critical': return 'bg-red-500 text-white';
    case 'high': return 'bg-red-400 text-white';
    case 'medium': return 'bg-yellow-500 text-white';
    case 'low': return 'bg-blue-500 text-white';
    default: return 'bg-green-500 text-white'; // For 'Safe' or unknown
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'open': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'closed': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'filtered': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    default: return <XCircle className="h-4 w-4 text-gray-500" />;
  }
};

export function PortScanner() {
  const [targetIp, setTargetIp] = useState('127.0.0.1'); // Default to localhost for testing
  const [portRange, setPortRange] = useState(''); // Default to empty string
  const [scanType, setScanType] = useState('tcp-connect'); 
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  
  // State for the current scan's results and metadata
  const [currentScanPorts, setCurrentScanPorts] = useState<PortResult[]>([]);
  const [scanHost, setScanHost] = useState(''); // To store the host being scanned
  const [totalPortsToScan, setTotalPortsToScan] = useState(0); // To store total ports
  const [openPortsCount, setOpenPortsCount] = useState(0);
  const [scanStartTime, setScanStartTime] = useState(''); // To store scan start time


  const [selectedCommonPorts, setSelectedCommonPorts] = useState<number[]>([]); // Default to empty
  const [activeTab, setActiveTab] = useState('results');
  const [filterStatus, setFilterStatus] = useState('all');

  // Helper to parse port ranges and return a sorted array of numbers
  const parsePortsInput = (input: string): number[] => {
    const ports: number[] = [];
    if (!input) return [];

    const parts = input.split(',').map(part => part.trim());
    parts.forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end) && start >= 0 && end <= 65535 && start <= end) {
          for (let i = start; i <= end; i++) {
            ports.push(i);
          }
        }
      } else {
        const portNum = Number(part);
        if (!isNaN(portNum) && portNum >= 0 && portNum <= 65535) {
          ports.push(portNum);
        }
      }
    });
    return Array.from(new Set(ports)).sort((a, b) => a - b); // Remove duplicates and sort
  };

  const handleScan = () => {
    // Clear previous results and reset states
    setIsScanning(true);
    setScanProgress(0);
    setCurrentScanPorts([]); 
    setOpenPortsCount(0); 
    setScanHost('');
    setTotalPortsToScan(0);
    setScanStartTime('');

    let portsToScanArray: number[] = [];
    
    // Parse ports from the input field
    if (portRange && portRange.trim() !== '') {
      portsToScanArray = portsToScanArray.concat(parsePortsInput(portRange));
    }
    
    // Add ports from selected common ports
    if (selectedCommonPorts.length > 0) {
      portsToScanArray = portsToScanArray.concat(selectedCommonPorts);
    }

    // Remove duplicates and sort the combined list
    portsToScanArray = Array.from(new Set(portsToScanArray)).sort((a, b) => a - b);

    if (portsToScanArray.length === 0) {
      alert("Please enter a port range or select common ports to scan.");
      setIsScanning(false);
      return;
    }

    // Set the total ports to scan right before emitting
    setTotalPortsToScan(portsToScanArray.length);

    // 3. Emit the 'start_port_scan' event to the backend
    socket.emit('start_port_scan', { 
      host: targetIp, 
      ports: portsToScanArray.join(','), // Send as comma-separated string for backend parsing
      scanType: scanType 
    });
  };

  const handleStopScan = () => {
    if (isScanning) {
      socket.emit('stop_port_scan');
      // Optimistically set scanning to false, backend will confirm with 'stopped' status
      setIsScanning(false); 
    }
  };

  // 4. useEffect for SocketIO listeners
  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    // Single handler for all scan_update messages
    const handleScanUpdate = (data: ScanUpdateData) => {
      console.log('Received scan_update:', data);
      
      switch (data.status) {
        case 'info':
          // This 'info' message from backend often comes with initial command info
          // Set initial scan host and time
          setScanHost(data.ip || targetIp); // Use data.ip if provided, else current targetIp
          setScanStartTime(new Date().toLocaleTimeString()); // Frontend time, or if backend sends, use that
          break;
        case 'progress':
          if (data.progress !== undefined) {
            setScanProgress(data.progress);
          }
          break;
        case 'open_port':
        case 'port_status':
          if (data.port !== undefined && data.state) {
            setCurrentScanPorts(prevPorts => {
              const newPort: PortResult = {
                number: data.port!,
                status: data.state!, // Use state directly from backend
                protocol: 'TCP', // Backend currently assumes TCP
                service: data.service || getPortDetails(data.port!).service, // Use backend service if available, else local
                version: 'N/A', // Backend does not provide this in current updates
                vulnerability: undefined, // Backend does not provide this
                description: getPortDetails(data.port!).description,
                details: data.details // Backend might provide more details here
              };
              
              const existingIndex = prevPorts.findIndex(p => p.number === newPort.number);
              if (existingIndex > -1) {
                // Update existing port if it was previously, e.g., 'closed' and now 'open'
                const updatedPorts = [...prevPorts];
                updatedPorts[existingIndex] = newPort;
                return updatedPorts;
              }
              
              if (newPort.status === 'open') {
                setOpenPortsCount(prev => prev + 1);
              }
              // Add new port and keep sorted
              return [...prevPorts, newPort].sort((a,b) => a.number - b.number); 
            });
          }
          break;
        case 'complete':
          console.log('Scan complete:', data.message);
          setIsScanning(false);
          setScanProgress(100); // Ensure progress bar is full on completion
          break;
        case 'error':
          console.error('Scan error:', data.message);
          setIsScanning(false);
          alert(`Scan Error: ${data.message}`);
          break;
        case 'stopped':
          console.log('Scan stopped:', data.message);
          setIsScanning(false);
          // Progress bar might not be 100% if stopped early
          break;
        default:
          console.log('Unknown scan update status:', data);
      }
    };

    socket.on('scan_update', handleScanUpdate);

    // Cleanup: Remove listeners when component unmounts
    return () => {
      socket.off('scan_update', handleScanUpdate);
    };
  }, [targetIp]); // Added targetIp to dependency array to re-run effect if targetIp changes and socket needs re-init or re-listen for new host's data


  const handlePortSelection = (portNumber: number, checked: boolean) => {
    if (checked) {
      setSelectedCommonPorts(prev => [...prev, portNumber]);
    } else {
      setSelectedCommonPorts(prev => prev.filter(p => p !== portNumber));
    }
  };

  // Filter ports for display based on currentScanPorts
  const filteredDisplayPorts = currentScanPorts.filter(port => {
    if (filterStatus === 'all') return true;
    return port.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold">Port Scanner</h1>
        <p className="text-muted-foreground">Real-time network port scanning and analysis</p>
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
              <Scan className="h-5 w-5" />
              <span>Scan Configuration</span>
            </CardTitle>
            <CardDescription>Configure port scanning parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Target and Range */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target-ip">Target IP/Host</Label>
                <Input
                  id="target-ip"
                  value={targetIp}
                  onChange={(e) => setTargetIp(e.target.value)}
                  placeholder="192.168.1.10"
                  disabled={isScanning}
                />
              </div>
              <div className="space-y-2">
                <Label>Port Range (e.g., 1-1000 or 80,443)</Label>
                <Input
                  value={portRange}
                  onChange={(e) => setPortRange(e.target.value)}
                  placeholder="1-1000 or 80,443,8080"
                  disabled={isScanning}
                />
              </div>
              <div className="space-y-2">
                <Label>Scan Type</Label>
                <Select value={scanType} onValueChange={setScanType} disabled={isScanning}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tcp-connect">TCP Connect Scan (Backend Default)</SelectItem>
                    {/* These would require more advanced backend logic (e.g., scapy) */}
                    <SelectItem value="tcp-syn" disabled>TCP SYN Scan</SelectItem>
                    <SelectItem value="udp" disabled>UDP Scan</SelectItem>
                    <SelectItem value="tcp-fin" disabled>TCP FIN Scan</SelectItem>
                    <SelectItem value="tcp-null" disabled>TCP NULL Scan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Common Ports Selection */}
            <div className="space-y-3">
              <Label>Common Ports (Quick Select)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {commonPorts.map((port) => (
                  <div key={port.number} className="flex items-center space-x-2">
                    <Checkbox
                      id={`port-${port.number}`}
                      checked={selectedCommonPorts.includes(port.number)}
                      onCheckedChange={(checked) => 
                        handlePortSelection(port.number, checked as boolean)
                      }
                      disabled={isScanning}
                    />
                    <Label 
                      htmlFor={`port-${port.number}`} 
                      className="text-sm font-mono cursor-pointer"
                    >
                      {port.number} ({port.service})
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Scan Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button onClick={isScanning ? handleStopScan : handleScan} disabled={!targetIp || (!portRange.trim() && selectedCommonPorts.length === 0)}>
                  {isScanning ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Stop Scan
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Scan
                    </>
                  )}
                </Button>
                <Button variant="outline" size="icon" disabled={isScanning}>
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedCommonPorts.length} common ports selected
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
                  <span>Scan progress</span>
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
                  {scanHost ? 
                    `${scanHost} scanned • ${openPortsCount} open ports found out of ${totalPortsToScan}` :
                    'Enter target and start scan to see results.'}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ports ({currentScanPorts.length})</SelectItem>
                    <SelectItem value="open">Open Only ({currentScanPorts.filter(p => p.status === 'open').length})</SelectItem>
                    <SelectItem value="closed">Closed Only ({currentScanPorts.filter(p => p.status === 'closed').length})</SelectItem>
                    <SelectItem value="filtered">Filtered Only ({currentScanPorts.filter(p => p.status === 'filtered').length})</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" disabled={currentScanPorts.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="results">Scan Results</TabsTrigger>
                <TabsTrigger value="vulnerabilities" disabled>
                  Vulnerabilities (0) 
                </TabsTrigger>
                <TabsTrigger value="services" disabled>Services</TabsTrigger> 
              </TabsList>

              <TabsContent value="results" className="mt-4">
                <div className="space-y-6">
                  {currentScanPorts.length === 0 && !isScanning ? (
                    <div className="text-center text-muted-foreground py-10">
                      No scan results yet. Start a scan!
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border rounded-lg p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{scanHost || 'Scanning...'}</h3>
                          <p className="text-sm text-muted-foreground font-mono">
                            {scanStartTime ? `Scan started: ${scanStartTime}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="mb-1">
                            {openPortsCount} / {totalPortsToScan} open
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {isScanning ? 'Scan in progress...' : 'Scan complete.'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border overflow-auto max-h-[500px]"> 
                        <Table>
                          <TableHeader className="sticky top-0 bg-card z-10">
                            <TableRow>
                              <TableHead className="w-[80px]">Port</TableHead>
                              <TableHead>Protocol</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Service</TableHead>
                              <TableHead>Version</TableHead>
                              <TableHead>Risk</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredDisplayPorts.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground">
                                  {isScanning ? 'Scanning ports...' : 'No ports found matching filter.'}
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredDisplayPorts.map((port) => (
                                <TableRow key={`${port.number}-${port.status}`}> 
                                  <TableCell className="font-mono">{port.number}</TableCell>
                                  <TableCell>{port.protocol}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center space-x-2">
                                      {getStatusIcon(port.status)}
                                      <span className="capitalize">{port.status}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>{port.service}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {port.version || 'N/A'} 
                                  </TableCell>
                                  <TableCell>
                                    {port.vulnerability ? (
                                      <Badge className={getVulnerabilityColor(port.vulnerability)}>
                                        {port.vulnerability.toUpperCase()}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline">Safe</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </motion.div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="vulnerabilities" className="mt-4">
                <div className="text-center text-muted-foreground py-10">
                  Vulnerability scanning not yet implemented.
                </div>
              </TabsContent>

              <TabsContent value="services" className="mt-4">
                <div className="text-center text-muted-foreground py-10">
                  Service enumeration not yet implemented.
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// Finally PATCH FIX:
// import { useState, useEffect } from 'react';
// import { motion } from 'framer-motion';
// import { 
//   Scan, 
//   Shield, 
//   AlertTriangle, 
//   CheckCircle, 
//   XCircle,
//   Play,
//   Pause,
//   Download, 
//   Filter,   
//   Search,   
//   Settings
// } from 'lucide-react';
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Badge } from '@/components/ui/badge';
// import { Progress } from '@/components/ui/progress';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { Checkbox } from '@/components/ui/checkbox';

// // 1. Import the socket.io client
// import { io } from 'socket.io-client';

// // Define the data interfaces based on what backend emits and what frontend needs
// interface PortResult {
//   number: number;
//   // Backend sends 'state', so aligning this for direct use
//   status: 'open' | 'closed' | 'filtered'; 
//   protocol: 'TCP' | 'UDP'; // Backend currently assumes TCP for scan results
//   service: string;
//   version?: string; // Backend doesn't provide this yet
//   vulnerability?: 'critical' | 'high' | 'medium' | 'low'; // Not provided by backend
//   description: string;
//   details?: string; // For additional service info from backend
// }

// // Interface for general scan updates from backend
// // Backend emits different data based on 'status' field, so this is a union type
// interface ScanUpdateData {
//   status: 'info' | 'progress' | 'open_port' | 'port_status' | 'error' | 'stopped' | 'complete';
//   message?: string; // For info, error, stopped, complete
//   progress?: number; // For progress updates
//   port?: number; // For open_port, port_status
//   state?: 'open' | 'closed' | 'filtered'; // For open_port, port_status
//   service?: string; // For open_port
//   ip?: string; // For open_port, port_status
//   details?: string; // For open_port (e.g., service and version)
// }

// // 2. Connect to the server. This should be outside the component.
// const socket = io('http://localhost:5000'); // Your Flask server URL

// const commonPorts = [
//   { number: 21, service: 'FTP', description: 'File Transfer Protocol' },
//   { number: 22, service: 'SSH', description: 'Secure Shell' },
//   { number: 23, service: 'Telnet', description: 'Telnet Protocol' },
//   { number: 25, service: 'SMTP', description: 'Simple Mail Transfer Protocol' },
//   { number: 53, service: 'DNS', description: 'Domain Name System' },
//   { number: 80, service: 'HTTP', description: 'Hypertext Transfer Protocol' },
//   { number: 110, service: 'POP3', description: 'Post Office Protocol v3' },
//   { number: 143, service: 'IMAP', description: 'Internet Message Access Protocol' },
//   { number: 443, service: 'HTTPS', description: 'HTTP Secure' },
//   { number: 993, service: 'IMAPS', description: 'IMAP over SSL' },
//   { number: 995, service: 'POP3S', description: 'POP3 over SSL' }
// ];

// // Helper to get service/description for a port number from commonPorts
// const getPortDetails = (portNumber: number) => {
//   const commonPort = commonPorts.find(p => p.number === portNumber);
//   return {
//     service: commonPort ? commonPort.service : 'Unknown',
//     description: commonPort ? commonPort.description : 'N/A'
//   };
// };

// const getVulnerabilityColor = (level?: string) => {
//   switch (level) {
//     case 'critical': return 'bg-red-500 text-white';
//     case 'high': return 'bg-red-400 text-white';
//     case 'medium': return 'bg-yellow-500 text-white';
//     case 'low': return 'bg-blue-500 text-white';
//     default: return 'bg-green-500 text-white'; // For 'Safe' or unknown
//   }
// };

// const getStatusIcon = (status: string) => {
//   switch (status) {
//     case 'open': return <CheckCircle className="h-4 w-4 text-green-500" />;
//     case 'closed': return <XCircle className="h-4 w-4 text-red-500" />;
//     case 'filtered': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
//     default: return <XCircle className="h-4 w-4 text-gray-500" />;
//   }
// };

// export function PortScanner() {
//   const [targetIp, setTargetIp] = useState('127.0.0.1'); // Default to localhost for testing
//   const [portRange, setPortRange] = useState('1-1000'); // Default to a common range
//   const [scanType, setScanType] = useState('tcp-connect'); 
//   const [isScanning, setIsScanning] = useState(false);
//   const [scanProgress, setScanProgress] = useState(0);
  
//   // State for the current scan's results and metadata
//   const [currentScanPorts, setCurrentScanPorts] = useState<PortResult[]>([]);
//   const [scanHost, setScanHost] = useState(''); // To store the host being scanned
//   const [totalPortsToScan, setTotalPortsToScan] = useState(0); // To store total ports
//   const [openPortsCount, setOpenPortsCount] = useState(0);
//   const [scanStartTime, setScanStartTime] = useState(''); // To store scan start time


//   const [selectedCommonPorts, setSelectedCommonPorts] = useState<number[]>([22, 80, 443]);
//   const [activeTab, setActiveTab] = useState('results');
//   const [filterStatus, setFilterStatus] = useState('all');

//   // Helper to parse port ranges and return a sorted array of numbers
//   const parsePortsInput = (input: string): number[] => {
//     const ports: number[] = [];
//     if (!input) return [];

//     const parts = input.split(',').map(part => part.trim());
//     parts.forEach(part => {
//       if (part.includes('-')) {
//         const [start, end] = part.split('-').map(Number);
//         if (!isNaN(start) && !isNaN(end) && start >= 0 && end <= 65535 && start <= end) {
//           for (let i = start; i <= end; i++) {
//             ports.push(i);
//           }
//         }
//       } else {
//         const portNum = Number(part);
//         if (!isNaN(portNum) && portNum >= 0 && portNum <= 65535) {
//           ports.push(portNum);
//         }
//       }
//     });
//     return Array.from(new Set(ports)).sort((a, b) => a - b); // Remove duplicates and sort
//   };

//   const handleScan = () => {
//     // Clear previous results and reset states
//     setIsScanning(true);
//     setScanProgress(0);
//     setCurrentScanPorts([]); 
//     setOpenPortsCount(0); 
//     setScanHost('');
//     setTotalPortsToScan(0);
//     setScanStartTime('');

//     let portsToScanArray: number[] = [];
//     if (portRange && portRange.trim() !== '') {
//       portsToScanArray = parsePortsInput(portRange);
//     } else if (selectedCommonPorts.length > 0) {
//       portsToScanArray = selectedCommonPorts;
//     } else {
//       alert("Please enter a port range or select common ports to scan.");
//       setIsScanning(false);
//       return;
//     }

//     if (portsToScanArray.length === 0) {
//       alert("No valid ports parsed. Please check your port input.");
//       setIsScanning(false);
//       return;
//     }

//     // Set the total ports to scan right before emitting
//     setTotalPortsToScan(portsToScanArray.length);

//     // 3. Emit the 'start_port_scan' event to the backend
//     socket.emit('start_port_scan', { 
//       host: targetIp, 
//       ports: portsToScanArray.join(','), // Send as comma-separated string for backend parsing
//       scanType: scanType 
//     });
//   };

//   const handleStopScan = () => {
//     if (isScanning) {
//       socket.emit('stop_port_scan');
//       // Optimistically set scanning to false, backend will confirm with 'stopped' status
//       setIsScanning(false); 
//     }
//   };

//   // 4. useEffect for SocketIO listeners
//   useEffect(() => {
//     if (!socket.connected) {
//       socket.connect();
//     }

//     // Single handler for all scan_update messages
//     const handleScanUpdate = (data: ScanUpdateData) => {
//       console.log('Received scan_update:', data);
      
//       switch (data.status) {
//         case 'info':
//           // This 'info' message from backend often comes with initial command info
//           // Set initial scan host and time
//           setScanHost(data.ip || targetIp); // Use data.ip if provided, else current targetIp
//           setScanStartTime(new Date().toLocaleTimeString()); // Frontend time, or if backend sends, use that
//           break;
//         case 'progress':
//           if (data.progress !== undefined) {
//             setScanProgress(data.progress);
//           }
//           break;
//         case 'open_port':
//         case 'port_status':
//           if (data.port !== undefined && data.state) {
//             setCurrentScanPorts(prevPorts => {
//               const newPort: PortResult = {
//                 number: data.port!,
//                 status: data.state!, // Use state directly from backend
//                 protocol: 'TCP', // Backend currently assumes TCP
//                 service: data.service || getPortDetails(data.port!).service, // Use backend service if available, else local
//                 version: 'N/A', // Backend does not provide this in current updates
//                 vulnerability: undefined, // Backend does not provide this
//                 description: getPortDetails(data.port!).description,
//                 details: data.details // Backend might provide more details here
//               };
              
//               const existingIndex = prevPorts.findIndex(p => p.number === newPort.number);
//               if (existingIndex > -1) {
//                 // Update existing port if it was previously, e.g., 'closed' and now 'open'
//                 const updatedPorts = [...prevPorts];
//                 updatedPorts[existingIndex] = newPort;
//                 return updatedPorts;
//               }
              
//               if (newPort.status === 'open') {
//                 setOpenPortsCount(prev => prev + 1);
//               }
//               // Add new port and keep sorted
//               return [...prevPorts, newPort].sort((a,b) => a.number - b.number); 
//             });
//           }
//           break;
//         case 'complete':
//           console.log('Scan complete:', data.message);
//           setIsScanning(false);
//           setScanProgress(100); // Ensure progress bar is full on completion
//           break;
//         case 'error':
//           console.error('Scan error:', data.message);
//           setIsScanning(false);
//           alert(`Scan Error: ${data.message}`);
//           break;
//         case 'stopped':
//           console.log('Scan stopped:', data.message);
//           setIsScanning(false);
//           // Progress bar might not be 100% if stopped early
//           break;
//         default:
//           console.log('Unknown scan update status:', data);
//       }
//     };

//     socket.on('scan_update', handleScanUpdate);

//     // Cleanup: Remove listeners when component unmounts
//     return () => {
//       socket.off('scan_update', handleScanUpdate);
//     };
//   }, [targetIp]); // Added targetIp to dependency array to re-run effect if targetIp changes and socket needs re-init or re-listen for new host's data


//   const handlePortSelection = (portNumber: number, checked: boolean) => {
//     if (checked) {
//       setSelectedCommonPorts(prev => [...prev, portNumber]);
//     } else {
//       setSelectedCommonPorts(prev => prev.filter(p => p !== portNumber));
//     }
//   };

//   // Filter ports for display based on currentScanPorts
//   const filteredDisplayPorts = currentScanPorts.filter(port => {
//     if (filterStatus === 'all') return true;
//     return port.status === filterStatus;
//   });

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <motion.div
//         initial={{ opacity: 0, y: -20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.3 }}
//       >
//         <h1 className="text-3xl font-bold">Port Scanner</h1>
//         <p className="text-muted-foreground">Real-time network port scanning and analysis</p>
//       </motion.div>

//       {/* Scan Configuration */}
//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.3, delay: 0.1 }}
//       >
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex items-center space-x-2">
//               <Scan className="h-5 w-5" />
//               <span>Scan Configuration</span>
//             </CardTitle>
//             <CardDescription>Configure port scanning parameters</CardDescription>
//           </CardHeader>
//           <CardContent className="space-y-6">
//             {/* Target and Range */}
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//               <div className="space-y-2">
//                 <Label htmlFor="target-ip">Target IP/Host</Label>
//                 <Input
//                   id="target-ip"
//                   value={targetIp}
//                   onChange={(e) => setTargetIp(e.target.value)}
//                   placeholder="192.168.1.10"
//                   disabled={isScanning}
//                 />
//               </div>
//               <div className="space-y-2">
//                 <Label>Port Range (e.g., 1-1000 or 80,443)</Label>
//                 <Input
//                   value={portRange}
//                   onChange={(e) => setPortRange(e.target.value)}
//                   placeholder="1-1000 or 80,443,8080"
//                   disabled={isScanning}
//                 />
//               </div>
//               <div className="space-y-2">
//                 <Label>Scan Type</Label>
//                 <Select value={scanType} onValueChange={setScanType} disabled={isScanning}>
//                   <SelectTrigger>
//                     <SelectValue />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="tcp-connect">TCP Connect Scan (Backend Default)</SelectItem>
//                     {/* These would require more advanced backend logic (e.g., scapy) */}
//                     <SelectItem value="tcp-syn" disabled>TCP SYN Scan</SelectItem>
//                     <SelectItem value="udp" disabled>UDP Scan</SelectItem>
//                     <SelectItem value="tcp-fin" disabled>TCP FIN Scan</SelectItem>
//                     <SelectItem value="tcp-null" disabled>TCP NULL Scan</SelectItem>
//                   </SelectContent>
//                 </Select>
//               </div>
//             </div>

//             {/* Common Ports Selection */}
//             <div className="space-y-3">
//               <Label>Common Ports (Quick Select)</Label>
//               <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
//                 {commonPorts.map((port) => (
//                   <div key={port.number} className="flex items-center space-x-2">
//                     <Checkbox
//                       id={`port-${port.number}`}
//                       checked={selectedCommonPorts.includes(port.number)}
//                       onCheckedChange={(checked) => 
//                         handlePortSelection(port.number, checked as boolean)
//                       }
//                       disabled={isScanning}
//                     />
//                     <Label 
//                       htmlFor={`port-${port.number}`} 
//                       className="text-sm font-mono cursor-pointer"
//                     >
//                       {port.number} ({port.service})
//                     </Label>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             {/* Scan Controls */}
//             <div className="flex items-center justify-between">
//               <div className="flex items-center space-x-2">
//                 <Button onClick={isScanning ? handleStopScan : handleScan} disabled={!targetIp || (!portRange.trim() && selectedCommonPorts.length === 0)}>
//                   {isScanning ? (
//                     <>
//                       <Pause className="h-4 w-4 mr-2" />
//                       Stop Scan
//                     </>
//                   ) : (
//                     <>
//                       <Play className="h-4 w-4 mr-2" />
//                       Start Scan
//                     </>
//                   )}
//                 </Button>
//                 <Button variant="outline" size="icon" disabled={isScanning}>
//                   <Settings className="h-4 w-4" />
//                 </Button>
//               </div>
//               <div className="text-sm text-muted-foreground">
//                 {selectedCommonPorts.length} common ports selected
//               </div>
//             </div>

//             {/* Progress Bar */}
//             {(isScanning || scanProgress > 0) && (
//               <motion.div
//                 initial={{ opacity: 0, height: 0 }}
//                 animate={{ opacity: 1, height: 'auto' }}
//                 className="space-y-2"
//               >
//                 <div className="flex justify-between text-sm">
//                   <span>Scan progress</span>
//                   <span>{Math.round(scanProgress)}%</span>
//                 </div>
//                 <Progress value={scanProgress} className="h-2" />
//               </motion.div>
//             )}
//           </CardContent>
//         </Card>
//       </motion.div>

//       {/* Results */}
//       <motion.div
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.3, delay: 0.2 }}
//       >
//         <Card>
//           <CardHeader>
//             <div className="flex items-center justify-between">
//               <div>
//                 <CardTitle className="flex items-center space-x-2">
//                   <Shield className="h-5 w-5" />
//                   <span>Scan Results</span>
//                 </CardTitle>
//                 <CardDescription>
//                   {scanHost ? 
//                     `${scanHost} scanned • ${openPortsCount} open ports found out of ${totalPortsToScan}` :
//                     'Enter target and start scan to see results.'}
//                 </CardDescription>
//               </div>
//               <div className="flex items-center space-x-2">
//                 <Select value={filterStatus} onValueChange={setFilterStatus}>
//                   <SelectTrigger className="w-32">
//                     <SelectValue />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="all">All Ports ({currentScanPorts.length})</SelectItem>
//                     <SelectItem value="open">Open Only ({currentScanPorts.filter(p => p.status === 'open').length})</SelectItem>
//                     <SelectItem value="closed">Closed Only ({currentScanPorts.filter(p => p.status === 'closed').length})</SelectItem>
//                     <SelectItem value="filtered">Filtered Only ({currentScanPorts.filter(p => p.status === 'filtered').length})</SelectItem> {/* Backend now returns 'filtered' */}
//                   </SelectContent>
//                 </Select>
//                 <Button variant="outline" size="sm" disabled={currentScanPorts.length === 0}>
//                   <Download className="h-4 w-4 mr-2" />
//                   Export
//                 </Button>
//               </div>
//             </div>
//           </CardHeader>
//           <CardContent>
//             <Tabs value={activeTab} onValueChange={setActiveTab}>
//               <TabsList className="grid w-full grid-cols-3">
//                 <TabsTrigger value="results">Scan Results</TabsTrigger>
//                 <TabsTrigger value="vulnerabilities" disabled>
//                   Vulnerabilities (0) 
//                 </TabsTrigger>
//                 <TabsTrigger value="services" disabled>Services</TabsTrigger> 
//               </TabsList>

//               <TabsContent value="results" className="mt-4">
//                 <div className="space-y-6">
//                   {currentScanPorts.length === 0 && !isScanning ? (
//                     <div className="text-center text-muted-foreground py-10">
//                       No scan results yet. Start a scan!
//                     </div>
//                   ) : (
//                     <motion.div
//                       initial={{ opacity: 0, y: 20 }}
//                       animate={{ opacity: 1, y: 0 }}
//                       transition={{ duration: 0.3 }}
//                       className="border rounded-lg p-4 space-y-4"
//                     >
//                       <div className="flex items-center justify-between">
//                         <div>
//                           <h3 className="text-lg font-semibold">{scanHost || 'Scanning...'}</h3>
//                           <p className="text-sm text-muted-foreground font-mono">
//                             {scanStartTime ? `Scan started: ${scanStartTime}` : ''}
//                           </p>
//                         </div>
//                         <div className="text-right">
//                           <Badge variant="outline" className="mb-1">
//                             {openPortsCount} / {totalPortsToScan} open
//                           </Badge>
//                           <p className="text-xs text-muted-foreground">
//                             {isScanning ? 'Scan in progress...' : 'Scan complete.'}
//                           </p>
//                         </div>
//                       </div>

//                       <div className="rounded-lg border overflow-auto max-h-[500px]"> 
//                         <Table>
//                           <TableHeader className="sticky top-0 bg-card z-10">
//                             <TableRow>
//                               <TableHead className="w-[80px]">Port</TableHead>
//                               <TableHead>Protocol</TableHead>
//                               <TableHead>Status</TableHead>
//                               <TableHead>Service</TableHead>
//                               <TableHead>Version</TableHead>
//                               <TableHead>Risk</TableHead>
//                             </TableRow>
//                           </TableHeader>
//                           <TableBody>
//                             {filteredDisplayPorts.length === 0 ? (
//                               <TableRow>
//                                 <TableCell colSpan={6} className="text-center text-muted-foreground">
//                                   {isScanning ? 'Scanning ports...' : 'No ports found matching filter.'}
//                                 </TableCell>
//                               </TableRow>
//                             ) : (
//                               filteredDisplayPorts.map((port) => (
//                                 <TableRow key={`${port.number}-${port.status}`}> {/* More robust key */}
//                                   <TableCell className="font-mono">{port.number}</TableCell>
//                                   <TableCell>{port.protocol}</TableCell>
//                                   <TableCell>
//                                     <div className="flex items-center space-x-2">
//                                       {getStatusIcon(port.status)}
//                                       <span className="capitalize">{port.status}</span>
//                                     </div>
//                                   </TableCell>
//                                   <TableCell>{port.service}</TableCell>
//                                   <TableCell className="text-sm text-muted-foreground">
//                                     {port.version || 'N/A'} {/* Changed from 'Unknown' to 'N/A' */}
//                                   </TableCell>
//                                   <TableCell>
//                                     {port.vulnerability ? (
//                                       <Badge className={getVulnerabilityColor(port.vulnerability)}>
//                                         {port.vulnerability.toUpperCase()}
//                                       </Badge>
//                                     ) : (
//                                       <Badge variant="outline">Safe</Badge>
//                                     )}
//                                   </TableCell>
//                                 </TableRow>
//                               ))
//                             )}
//                           </TableBody>
//                         </Table>
//                       </div>
//                     </motion.div>
//                   )}
//                 </div>
//               </TabsContent>

//               <TabsContent value="vulnerabilities" className="mt-4">
//                 <div className="text-center text-muted-foreground py-10">
//                   Vulnerability scanning not yet implemented.
//                 </div>
//               </TabsContent>

//               <TabsContent value="services" className="mt-4">
//                 <div className="text-center text-muted-foreground py-10">
//                   Service enumeration not yet implemented.
//                 </div>
//               </TabsContent>
//             </Tabs>
//           </CardContent>
//         </Card>
//       </motion.div>
//     </div>
//   );
// }