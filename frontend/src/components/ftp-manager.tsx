import { useState, useEffect } from 'react'; 
import { motion } from 'framer-motion';
import io, { Socket } from 'socket.io-client'; 
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  Plus,
  Edit,
  Eye,
  Lock,
  Unlock,
  Server,
  RefreshCw,
  Settings,
  FileText,
  Image,
  Archive,
  Folder
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

interface FtpConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  protocol: 'FTP' | 'FTPS' | 'SFTP';
  status: 'connected' | 'disconnected' | 'connecting';
  lastConnected?: string;
}

interface FileItem {
  name: string;
  type: 'file' | 'directory' | 'symlink'; 
  size: number;
  modified: string;
  permissions: string;
  owner: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '-';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (file: FileItem) => {
  if (file.type === 'directory') return Folder;

  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
      return Image;
    case 'tar':
    case 'gz':
    case 'zip':
    case 'rar':
      return Archive;
    default:
      return FileText;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'connected': return 'text-green-500';
    case 'connecting': return 'text-yellow-500';
    case 'disconnected': return 'text-red-500';
    default: return 'text-gray-500';
  }
};

const getProtocolColor = (protocol: string) => {
  switch (protocol) {
    case 'SFTP': return 'bg-green-500';
    case 'FTPS': return 'bg-blue-500';
    case 'FTP': return 'bg-orange-500';
    default: return 'bg-gray-500';
  }
};

const BACKEND_URL: string = import.meta.env.VITE_BACKEND_URL;

const socket: Socket = io(BACKEND_URL, { transports: ['websocket'] }); 


export function FtpManager() {
  // Initialize Socket.IO connection
  // IMPORTANT: Ensure this URL matches your backend's Socket.IO server address
  // const socket: Socket = io('http://localhost:5000', { transports: ['websocket'] });

  // State variables for FTP Manager
  const [connections, setConnections] = useState<FtpConnection[]>([]); 
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState('/'); 
  const [passwordInput, setPasswordInput] = useState<string>(''); 
  const [isConnected, setIsConnected] = useState<boolean>(false); 
  const [currentHost, setCurrentHost] = useState<string>(''); 

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const [newConnectionDialog, setNewConnectionDialog] = useState(false);

  const activeConnection = connections.find(c => c.id === selectedConnectionId);

  useEffect(() => {
    fetch('/api/ftp/connections') 
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data: FtpConnection[]) => {
        setConnections(data);
        if (data.length > 0) {
          setSelectedConnectionId(data[0].id);
        }
      })
      .catch(error => console.error("Failed to fetch FTP connections:", error));

    socket.on('connect', () => {
      console.log('Socket.IO connected to backend!');
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO disconnected from backend.');
      setIsConnected(false);
      setCurrentHost('');
      setFiles([]);
      setCurrentPath('/');
    });

    socket.on('ftp_status', (data: { status: string; message: string; is_connected?: boolean; current_host?: string }) => {
      console.log("FTP Status Update:", data);
      if (typeof data.is_connected === 'boolean') {
        setIsConnected(data.is_connected);
        if (data.is_connected && data.current_host) {
          setCurrentHost(data.current_host);
          socket.emit('ftp_list_dir', { path: '/' });
        } else if (!data.is_connected) {
          setCurrentHost(''); 
          setFiles([]); 
          setCurrentPath('/'); 
        }
      }
    });

    socket.on('ftp_dir_listing', (data: { path: string; files: FileItem[] }) => {
      console.log("FTP Directory Listing:", data);
      setFiles(data.files);
      setCurrentPath(data.path);
    });

    socket.on('ftp_transfer_progress', (data: { type: 'upload' | 'download'; fileName: string; progress: number; status: string; totalSize?: number; transferredSize?: number }) => {
      console.log("FTP Transfer Progress:", data);
      if (data.type === 'upload') {
        setIsUploading(data.status === 'transferring');
        setUploadProgress(data.progress || 0);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('ftp_status');
      socket.off('ftp_dir_listing');
      socket.off('ftp_transfer_progress');
      socket.disconnect();
    };
  }, [socket]); 


  const handleConnect = () => {
    if (activeConnection && passwordInput) {
      console.log("Attempting to send ftp_connect event...", { id: activeConnection.id, password: passwordInput });
      socket.emit('ftp_connect', { id: activeConnection.id, password: passwordInput });
    } else {
      console.warn("Cannot connect: No connection selected or password missing.");
    }
  };

  const handleDisconnect = () => {
    console.log("Attempting to send ftp_disconnect event...");
    socket.emit('ftp_disconnect');
  };

  const handleRefresh = () => {
    if (isConnected && currentHost && currentPath) {
      console.log(`Refreshing directory: ${currentPath}`);
      socket.emit('ftp_list_dir', { path: currentPath });
    } else {
      console.warn("Not connected to refresh directory.");
      // toast.error("Not connected to an FTP server.");
    }
  };

  const handleDirectoryClick = (fileName: string, fileType: 'file' | 'directory' | 'symlink') => {
    if (fileType === 'directory') {
      let newPath = currentPath;
      if (fileName === '..') {
        // Go up one level
        const parts = currentPath.split('/').filter(p => p !== '');
        if (parts.length > 0) {
          newPath = '/' + parts.slice(0, -1).join('/');
        } else {
          newPath = '/'; 
        }
      } else if (fileName === '.') {
        newPath = currentPath; 
      } else {
        newPath = `${currentPath === '/' ? '' : currentPath}/${fileName}`;
      }

      newPath = newPath.replace(/\/\//g, '/').replace(/\/$/, '');
      if (newPath === '') newPath = '/';

      console.log(`Navigating to: ${newPath}`);
      if (isConnected) {
        socket.emit('ftp_list_dir', { path: newPath });
      } else {
        console.warn("Not connected to navigate directory.");
      }
    } else {
      console.log(`Clicked file: ${fileName}`);
    }
  };

  const handleUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          return 100;
        }
        return prev + Math.random() * 10;
      });
    }, 200);
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold">FTP Manager</h1>
        <p className="text-muted-foreground">Manage FTP connections and transfer files securely</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Server className="h-5 w-5" />
                  <span>FTP Connections</span>
                </CardTitle>
                <CardDescription>Manage your FTP server connections</CardDescription>
              </div>
              <Dialog open={newConnectionDialog} onOpenChange={setNewConnectionDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Connection
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New FTP Connection</DialogTitle>
                    <DialogDescription>Configure a new FTP server connection</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Connection Name</Label>
                        <Input id="name" placeholder="My Server" />
                      </div>
                      <div className="space-y-2">
                        <Label>Protocol</Label>
                        <Select defaultValue="ftps">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ftp">FTP</SelectItem>
                            <SelectItem value="ftps">FTPS</SelectItem>
                            <SelectItem value="sftp">SFTP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="host">Host</Label>
                        <Input id="host" placeholder="ftp.example.com" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="port">Port</Label>
                        <Input id="port" type="number" placeholder="21" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input id="username" placeholder="username" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" placeholder="password" />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setNewConnectionDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={() => setNewConnectionDialog(false)}>
                        Save Connection
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"> 
              {connections.map((connection) => (
                <motion.div
                  key={connection.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 }} 
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedConnectionId === connection.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-accent/50'
                  }`}
                  onClick={() => setSelectedConnectionId(connection.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{connection.name}</div>
                    <Badge className={`${getProtocolColor(connection.protocol)} text-white`}>
                      {connection.protocol}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>{connection.host}:{connection.port}</div>
                    <div className="flex items-center justify-between">
                      <span className={getStatusColor(isConnected && currentHost === connection.host ? 'connected' : 'disconnected')}>
                        {isConnected && currentHost === connection.host ? 'Connected' : 'Disconnected'}
                      </span>
                      {isConnected && currentHost === connection.host ? (
                        <Lock className="h-3 w-3 text-green-500" />
                      ) : (
                        <Unlock className="h-3 w-3 text-gray-500" />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {selectedConnectionId && activeConnection && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="mt-4 p-4 rounded-lg border bg-secondary/20"
              >
                <h3 className="font-semibold text-lg mb-2">Selected Connection: {activeConnection.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Host: {activeConnection.host}:{activeConnection.port} | Protocol: {activeConnection.protocol}
                </p>

                {!isConnected || currentHost !== activeConnection.host ? ( 
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ftp-password">Password</Label>
                      <Input
                        id="ftp-password"
                        type="password"
                        placeholder="Enter password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        onKeyPress={(e) => { // Allow pressing Enter to connect
                          if (e.key === 'Enter') {
                            handleConnect();
                          }
                        }}
                      />
                    </div>
                    <Button onClick={handleConnect} className="w-full">
                      <Lock className="h-4 w-4 mr-2" /> Connect
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <Badge className="bg-green-500 text-white">
                      <Lock className="h-3 w-3 mr-1" /> Connected to {currentHost}
                    </Badge>
                    <Button onClick={handleDisconnect} variant="destructive">
                      <Unlock className="h-4 w-4 mr-2" /> Disconnect
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {isConnected && activeConnection && currentHost === activeConnection.host && (
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
                    <FolderOpen className="h-5 w-5" />
                    <span>{activeConnection.name}</span>
                  </CardTitle>
                  <CardDescription className="font-mono">{currentPath}</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={handleRefresh}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleUpload}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="files" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
                  <TabsTrigger value="transfers">Transfers</TabsTrigger>
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="files">
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Modified</TableHead>
                          <TableHead>Permissions</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {files.map((file, index) => {
                          const FileIcon = getFileIcon(file);
                          return (
                            <motion.tr
                              key={file.name}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2, delay: index * 0.02 }}
                              className="hover:bg-accent/50 transition-colors"
                            >
                              <TableCell>
                                <div
                                  className="flex items-center space-x-3 cursor-pointer"
                                  onClick={() => handleDirectoryClick(file.name, file.type)}
                                >
                                  <FileIcon className={`h-4 w-4 ${
                                    file.type === 'directory' ? 'text-blue-500' : 'text-gray-500'
                                  }`} />
                                  <span className={file.type === 'directory' ? 'font-medium' : ''}>
                                    {file.name}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>{formatFileSize(file.size)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {file.modified}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {file.permissions}
                              </TableCell>
                              <TableCell>{file.owner}</TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end space-x-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </motion.tr>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="transfers">
                  <div className="space-y-4">
                    {isUploading && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Upload className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">Uploading document.pdf</span>
                          </div>
                          <Badge variant="outline">
                            {Math.round(uploadProgress)}%
                          </Badge>
                        </div>
                        <Progress value={uploadProgress} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                          <span>2.5 MB / 5.2 MB</span>
                          <span>45 KB/s</span>
                        </div>
                      </motion.div>
                    )}

                    <div className="text-center py-8 text-muted-foreground">
                      {!isUploading && 'No active transfers'}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="logs">
                  <div className="rounded-lg border bg-black/90 text-green-400 font-mono text-sm p-4 h-64 overflow-y-auto">
                    {/* These logs are currently static, would be populated by backend events */}
                    <div>220 Welcome to FTP server</div>
                    <div>USER admin</div>
                    <div>331 Password required for admin</div>
                    <div>PASS ****</div>
                    <div>230 User admin logged in</div>
                    <div>PWD</div>
                    <div>257 "/var/www/html" is current directory</div>
                    <div>LIST</div>
                    <div>150 Opening ASCII mode data connection</div>
                    <div>226 Transfer complete</div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}