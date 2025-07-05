import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Plus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Settings,
  RefreshCw,
  Eye,
  Trash2,
  Edit,
  Send,
  Loader2,
  Folder,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// FIXED: Changed `=>` to `from` in the import statement
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast'; // Corrected import path
import { Textarea } from '@/components/ui/textarea';
import io from 'socket.io-client';

// --- Socket.IO Client Setup ---
// Replace with your Flask backend URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// const SOCKET_IO_URL = 'http://127.0.0.1:5000';
const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling']
});

// --- Interfaces adjusted to backend response ---

interface MailAccount {
  id: string;
  name: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  username: string; // Corresponds to email
  status: 'connected' | 'disconnected' | 'error' | 'connecting'; // Added 'connecting' state
  lastCheck: string; // Timestamp from backend
  messageCount?: number; // Total messages in INBOX
  unreadCount?: number; // Unread messages in INBOX
  error?: string;
  is_active_session?: boolean; // To indicate if this account is currently connected via Socket.IO
  current_mailbox?: string; // Track currently selected mailbox for this account
}

interface MailMessage {
  uid: string; // Unique ID from IMAP
  from: string;
  subject: string;
  date: string;
  message_id: string; // Added from backend
  // size and read status not directly available from current backend list, will derive or fetch on demand
}

interface EmailContent {
  uid: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  date: string;
  message_id: string;
  body: string; // Primary display content (HTML if available, else plain)
  plain_text_body: string;
  html_body: string;
  attachments: {
    filename: string;
    content_type: string;
    size: number;
  }[];
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'connected': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'connecting': // New state for actively trying to connect
    case 'checking': return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
    default: return <AlertTriangle className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'connected': return 'text-green-500';
    case 'error': return 'text-red-500';
    case 'connecting':
    case 'checking': return 'text-yellow-500';
    default: return 'text-gray-500';
  }
};

// Protocol color for IMAP/SMTP (POP3 is not directly supported by current backend)
const getProtocolColor = (protocol: string) => {
  switch (protocol) {
    case 'IMAP': return 'bg-blue-500';
    case 'SMTP': return 'bg-orange-500';
    case 'POP3': return 'bg-green-500'; // Keep for now if UI expects it, though backend is IMAP/SMTP
    default: return 'bg-gray-500';
  }
};

const formatFileSize = (bytes: number): string => {
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export function MailChecker() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [inboxEmails, setInboxEmails] = useState<MailMessage[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<MailAccount | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailContent | null>(null); // For viewing email content
  const [activeTab, setActiveTab] = useState('accounts');

  // Add Account form states
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountImapHost, setNewAccountImapHost] = useState('');
  const [newAccountImapPort, setNewAccountImapPort] = useState('993');
  const [newAccountSmtpHost, setNewAccountSmtpHost] = useState('');
  const [newAccountSmtpPort, setNewAccountSmtpPort] = useState('587');
  const [newAccountUsername, setNewAccountUsername] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [newAccountSsl, setNewAccountSsl] = useState(true); // SSL is assumed true for IMAP_SSL/SMTP+TLS
  const [newAccountDialog, setNewAccountDialog] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  // Send Test Email form states
  const [sendTestDialog, setSendTestDialog] = useState(false);
  const [testRecipientEmail, setTestRecipientEmail] = useState('');
  const [testSubject, setTestSubject] = useState('');
  const [testBody, setTestBody] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // Pagination for inbox
  const [currentPage, setCurrentPage] = useState(1);
  const [emailsPerPage, setEmailsPerPage] = useState(10);
  const [totalInboxEmails, setTotalInboxEmails] = useState(0);


  // Settings states (auto-check will be implemented differently)
  const [autoCheck, setAutoCheck] = useState(false); // No direct backend support for auto-check all
  const [checkInterval, setCheckInterval] = useState('5'); // Remains a frontend setting for future use or manual trigger


  // --- Fetch Mail Accounts (HTTP GET) ---
  const fetchMailAccounts = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/mail/connections`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setAccounts(data.map((acc: any) => ({
        ...acc,
        email: acc.username, // Map backend 'username' to frontend 'email'
        server: acc.imap_host, // Use imap_host for general 'server' display
        port: acc.imap_port, // Use imap_port for general 'port' display
        protocol: 'IMAP', // Our backend uses IMAP, so hardcode for UI display
        ssl: true, // Our backend uses SSL for IMAP_SSL
        status: 'disconnected', // Default to disconnected until connected via Socket.IO
        lastCheck: 'N/A',
        is_active_session: false,
        current_mailbox: 'INBOX'
      })));
    } catch (error: any) {
      console.error("Failed to fetch mail accounts:", error);
      toast({
        title: "Error fetching accounts",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [toast,BACKEND_URL]);

  // --- Socket.IO Event Listeners ---
  useEffect(() => {
    // Initial fetch of accounts when component mounts
    fetchMailAccounts();

    socket.on('connect', () => {
      console.log('Socket.IO connected:', socket.id);
      toast({
        title: "Backend Connected",
        description: `Connected to Flask backend. Your SID: ${socket.id}`,
      });
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      toast({
        title: "Backend Disconnected",
        description: "Lost connection to Flask backend.",
        variant: "destructive",
      });
      // Reset all accounts to disconnected status
      setAccounts(prevAccounts => prevAccounts.map(account => ({
        ...account,
        status: 'disconnected',
        is_active_session: false,
        error: undefined
      })));
      setSelectedAccount(null);
      setInboxEmails([]);
      setSelectedEmail(null);
    });

    socket.on('mail_status', (data: any) => {
      console.log('Mail Status:', data);
      toast({
        title: data.status === 'success' || data.status === 'connected' ? "Mail Status" : "Mail Error",
        description: data.message,
        variant: data.status === 'success' || data.status === 'connected' ? "default" : "destructive",
      });

      setAccounts(prevAccounts => prevAccounts.map(account => {
        if (account.id === data.current_mail_config_id) {
          const newStatus = data.status === 'connected' ? 'connected' : (data.status === 'error' ? 'error' : 'disconnected');
          const newError = data.status === 'error' ? data.message : undefined;
          return {
            ...account,
            status: newStatus,
            error: newError,
            lastCheck: new Date().toLocaleString(),
            is_active_session: data.status === 'connected'
          };
        } else if (data.status === 'connected' && account.is_active_session) {
          // If a new account connects, disconnect the previously active one for this session
          return { ...account, status: 'disconnected', is_active_session: false, error: undefined };
        }
        return account;
      }));

      // If a new account connected, set it as the selected one
      if (data.status === 'connected' && data.current_mail_config_id) {
        setAccounts(prevAccounts => {
          const connectedAccount = prevAccounts.find(acc => acc.id === data.current_mail_config_id);
          if (connectedAccount) {
            setSelectedAccount({ ...connectedAccount, status: 'connected', is_active_session: true });
          }
          return prevAccounts;
        });
        setActiveTab('messages'); // Automatically switch to messages tab
      } else if (data.status === 'disconnected') {
         setSelectedAccount(null);
         setInboxEmails([]);
         setSelectedEmail(null);
         setActiveTab('accounts'); // Go back to accounts tab
      }
    });

    socket.on('mail_inbox_summary', (data: { unreadCount: number; totalMessages: number }) => {
      console.log('Inbox Summary:', data);
      setAccounts(prevAccounts => prevAccounts.map(account => {
        if (account.is_active_session) { // Update the active account
          return {
            ...account,
            messageCount: data.totalMessages,
            unreadCount: data.unreadCount
          };
        }
        return account;
      }));
    });

    socket.on('mail_inbox_listing', (data: { mailbox: string; emails: any[]; totalCount: number }) => {
      console.log('Inbox Listing:', data);
      // Map backend fields to frontend MailMessage interface
      const mappedEmails: MailMessage[] = data.emails.map((email: any) => ({
        uid: email.uid,
        from: email.from,
        subject: email.subject,
        date: email.date,
        message_id: email.message_id,
        // Backend doesn't explicitly send 'read' or 'size' in listing, so omit or derive if needed
      }));
      setInboxEmails(mappedEmails);
      setTotalInboxEmails(data.totalCount);
      toast({
        title: "Inbox Updated",
        description: `Loaded ${mappedEmails.length} messages from ${data.mailbox}. Total: ${data.totalCount}`,
      });
    });

    socket.on('mail_email_content', (data: EmailContent) => {
        console.log('Email Content:', data);
        setSelectedEmail(data); // Set the full email content for display
        toast({
            title: "Email Loaded",
            description: `Content for '${data.subject}' loaded.`,
        });
    });


    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('mail_status');
      socket.off('mail_inbox_summary');
      socket.off('mail_inbox_listing');
      socket.off('mail_email_content');
      // socket.disconnect(); // Don't disconnect here, manage globally
    };
  }, [fetchMailAccounts, toast]); // Dependencies for useEffect


  // --- Event Emitters / Handlers ---

  const handleConnect = (account: MailAccount, password?: string) => {
    // Prevent connecting if already connecting/connected
    if (account.status === 'connecting' || account.status === 'connected' && account.is_active_session) {
        toast({
            title: "Connection in Progress",
            description: "Account is already connecting or connected.",
            variant: "info",
        });
        return;
    }

    setAccounts(prev => prev.map(a =>
        a.id === account.id ? { ...a, status: 'connecting', error: undefined } : { ...a, is_active_session: false } // Mark current as connecting, others as inactive
    ));
    setSelectedAccount(null); // Clear selected to prevent issues during connection change
    setInboxEmails([]); // Clear inbox when connecting new account
    setSelectedEmail(null);

    socket.emit('mail_connect', { id: account.id, password: password });
  };

  const handleDisconnect = () => {
    socket.emit('mail_disconnect');
    // UI will be updated by mail_status event from backend
  };

  const handleFetchInbox = useCallback(() => {
    if (!selectedAccount || !selectedAccount.is_active_session) {
      toast({
        title: "Not Connected",
        description: "Please connect to a mail account first.",
        variant: "warning",
      });
      return;
    }
    const offset = (currentPage - 1) * emailsPerPage;
    socket.emit('mail_list_inbox', {
      mailbox: selectedAccount.current_mailbox || 'INBOX',
      limit: emailsPerPage,
      offset: offset
    });
  }, [selectedAccount, currentPage, emailsPerPage, toast]);

  useEffect(() => {
    if (selectedAccount && activeTab === 'messages' && selectedAccount.is_active_session) {
      handleFetchInbox();
    }
  }, [selectedAccount, activeTab, currentPage, emailsPerPage, handleFetchInbox]);

  const handleViewEmail = (uid: string) => {
    if (!selectedAccount || !selectedAccount.is_active_session) {
        toast({
            title: "Not Connected",
            description: "Please connect to a mail account first.",
            variant: "warning",
        });
        return;
    }
    socket.emit('mail_get_email_content', { uid: uid, mailbox: selectedAccount.current_mailbox || 'INBOX' });
  };

  const handleCloseEmailView = () => {
    setSelectedEmail(null);
  };

  const handleAddAccount = async () => {
    setIsAddingAccount(true);
    try {
      // Define the request body
      const requestBody = {
        name: newAccountName,
        imap_host: newAccountImapHost,
        imap_port: parseInt(newAccountImapPort),
        smtp_host: newAccountSmtpHost,
        smtp_port: parseInt(newAccountSmtpPort),
        username: newAccountUsername,
        password: newAccountPassword,
        // SSL is assumed true for our backend IMAP_SSL/SMTP+TLS
      };

      // Log the data being sent (for debugging)
      console.log("Sending request to backend with body:", requestBody);

      // Make the fetch request with the absolute URL
      const response = await fetch(`${BACKEND_URL}/api/mail/add_connection`, { // FIX: Changed to absolute URL
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Log the raw response for inspection (for debugging)
      console.log("Received raw response:", response);

      // Check if the response is OK (status 2xx)
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json(); // Attempt to parse error JSON
        } catch (jsonError) {
          // If response is not JSON, use default error message
          console.error("Failed to parse error response as JSON:", jsonError);
          throw new Error(`HTTP error! Status: ${response.status}. Response: ${await response.text()}`);
        }
        // Throw an error with the message from backend or a generic one
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      // If response is OK, parse the success JSON
      const data = await response.json();
      console.log("Successfully added account data from backend:", data); // Log success data

      toast({
        title: "Account Added",
        description: data.message || "Mail account added successfully.", // Use data.message if available, else generic
        variant: "success", // Added variant: "success" (assuming it's defined in your toast.tsx)
      });
      
      // Close the "Add New Account" dialog/modal
      // Assuming setNewAccountDialog(false) closes the dialog
      setNewAccountDialog(false); 

      // Re-fetch accounts to update the list in the UI
      fetchMailAccounts();

      // Clear form fields after successful addition
      setNewAccountName('');
      // setNewAccountEmail(''); // This state variable was not used in the body, removed for clarity.
      setNewAccountImapHost('');
      setNewAccountImapPort('993');
      setNewAccountSmtpHost('');
      setNewAccountSmtpPort('587');
      setNewAccountUsername('');
      setNewAccountPassword('');

    } catch (error: any) {
      console.error("Failed to add account:", error);
      toast({
        title: "Error adding account",
        description: error.message || "An unexpected error occurred.", // Provide a fallback message
        variant: "destructive",
      });
    } finally {
      setIsAddingAccount(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Are you sure you want to delete this account?")) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/mail/delete_connection/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      toast({
        title: "Account Deleted",
        description: data.message,
      });
      fetchMailAccounts(); // Re-fetch accounts to update the list
      if (selectedAccount?.id === id) { // If the deleted account was selected, clear selection
        setSelectedAccount(null);
        setInboxEmails([]);
        setSelectedEmail(null);
        handleDisconnect(); // Ensure backend session is also disconnected
      }
    } catch (error: any) {
      console.error("Failed to delete account:", error);
      toast({
        title: "Error deleting account",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSendTestEmail = async () => {
    setIsSendingTestEmail(true);
    if (!selectedAccount) {
      toast({
        title: "No Account Selected",
        description: "Please select an account to send a test email from.",
        variant: "warning",
      });
      setIsSendingTestEmail(false);
      return;
    }

    // For simplicity, we are passing the password directly in the socket event.
    // In a production app, the password might be stored server-side temporarily
    // after initial login, or a more secure token-based system used.
    socket.emit('mail_send_test', {
      connection_id: selectedAccount.id,
      recipient_email: testRecipientEmail,
      subject: testSubject,
      body: testBody,
      password: newAccountPassword // This assumes the password from add form is available, or use a separate input for sending
    });

    // The toast for success/failure will come from the mail_status event listener
    setIsSendingTestEmail(false); // Reset immediately, actual status via socket event
    setSendTestDialog(false);
    setTestRecipientEmail('');
    setTestSubject('');
    setTestBody('');
  };


  // --- Derived State for UI ---
  const totalMessages = accounts.reduce((sum, acc) => sum + (acc.messageCount || 0), 0);
  const totalUnreadMessages = accounts.reduce((sum, acc) => sum + (acc.unreadCount || 0), 0);
  const connectedAccountsCount = accounts.filter(acc => acc.status === 'connected' || acc.status === 'connecting').length;


  // Pagination calculations for emails
  const totalPages = Math.ceil(totalInboxEmails / emailsPerPage);
  const currentEmailsDisplayed = inboxEmails.length;


  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold">Mail Checker</h1>
        <p className="text-muted-foreground">Monitor and manage email server connections</p>
      </motion.div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accounts.length}</div>
              <p className="text-xs text-muted-foreground">
                {connectedAccountsCount} connected
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <Mail className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalMessages}</div>
              <p className="text-xs text-muted-foreground">
                {totalUnreadMessages} unread
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Global Status</CardTitle>
              {connectedAccountsCount > 0 ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {connectedAccountsCount > 0 ? 'Active' : 'Inactive'}
              </div>
              <p className="text-xs text-muted-foreground">
                {accounts.filter(a => a.status === 'error').length} errors
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Auto Check</CardTitle>
              <RefreshCw className={`h-4 w-4 ${autoCheck ? 'text-green-500 animate-spin' : 'text-gray-500'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{autoCheck ? 'ON' : 'OFF'}</div>
              <p className="text-xs text-muted-foreground">
                Every {checkInterval} minutes (Manual trigger available)
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Mail Accounts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Mail className="h-5 w-5" />
                  <span>Mail Accounts</span>
                </CardTitle>
                <CardDescription>Manage and monitor email server connections</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                {/* No "Check All" equivalent for mail checker as connection is per-session */}
                {selectedAccount?.is_active_session ? (
                   <Button variant="outline" onClick={handleDisconnect}>
                       <XCircle className="h-4 w-4 mr-2" />
                       Disconnect
                   </Button>
                ) : (
                    <Dialog open={sendTestDialog} onOpenChange={setSendTestDialog}>
                        <DialogTrigger asChild>
                            <Button variant="outline" disabled={!selectedAccount}>
                                <Send className="h-4 w-4 mr-2" />
                                Send Test Email
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Send Test Email</DialogTitle>
                                <DialogDescription>Send a test email from the selected account.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="sender-email">From</Label>
                                    <Input id="sender-email" value={selectedAccount?.username || ''} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="recipient-email">Recipient Email</Label>
                                    <Input
                                        id="recipient-email"
                                        type="email"
                                        placeholder="recipient@example.com"
                                        value={testRecipientEmail}
                                        onChange={(e) => setTestRecipientEmail(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="test-subject">Subject</Label>
                                    <Input
                                        id="test-subject"
                                        placeholder="Test Email from NetHawk"
                                        value={testSubject}
                                        onChange={(e) => setTestSubject(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="test-body">Body</Label>
                                    <Textarea
                                        id="test-body"
                                        placeholder="This is a test email."
                                        rows={5}
                                        value={testBody}
                                        onChange={(e) => setTestBody(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setSendTestDialog(false)} disabled={isSendingTestEmail}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSendTestEmail} disabled={isSendingTestEmail}>
                                    {isSendingTestEmail ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="mr-2 h-4 w-4" />
                                    )}
                                    Send Email
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}


                <Dialog open={newAccountDialog} onOpenChange={setNewAccountDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Account
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Mail Account</DialogTitle>
                      <DialogDescription>Configure a new email account for monitoring</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                          <Label htmlFor="account-name">Account Name</Label>
                          <Input id="account-name" placeholder="Corporate Email" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="imap-host">IMAP Host</Label>
                          <Input id="imap-host" placeholder="imap.gmail.com" value={newAccountImapHost} onChange={(e) => setNewAccountImapHost(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="imap-port">IMAP Port</Label>
                          <Input id="imap-port" type="number" placeholder="993" value={newAccountImapPort} onChange={(e) => setNewAccountImapPort(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="smtp-host">SMTP Host</Label>
                          <Input id="smtp-host" placeholder="smtp.gmail.com" value={newAccountSmtpHost} onChange={(e) => setNewAccountSmtpHost(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="smtp-port">SMTP Port</Label>
                          <Input id="smtp-port" type="number" placeholder="587" value={newAccountSmtpPort} onChange={(e) => setNewAccountSmtpPort(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="username">Username (Full Email)</Label>
                          <Input id="username" placeholder="user@example.com" value={newAccountUsername} onChange={(e) => setNewAccountUsername(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">Password (or App Password)</Label>
                          <Input id="password" type="password" placeholder="password" value={newAccountPassword} onChange={(e) => setNewAccountPassword(e.target.value)} />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="ssl" checked={newAccountSsl} onCheckedChange={setNewAccountSsl} disabled /> {/* SSL is implicitly true */}
                        <Label htmlFor="ssl">Use SSL/TLS (Always On)</Label>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setNewAccountDialog(false)} disabled={isAddingAccount}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddAccount} disabled={isAddingAccount}>
                          {isAddingAccount ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4 mr-2" />
                          )}
                          Add Account
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="accounts">
                  Accounts ({accounts.length})
                </TabsTrigger>
                <TabsTrigger value="messages" disabled={!selectedAccount || !selectedAccount.is_active_session}>
                  Messages ({selectedAccount?.messageCount ?? 0})
                </TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              {/* Accounts Tab Content */}
              <TabsContent value="accounts">
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>IMAP Server</TableHead>
                        <TableHead>SMTP Server</TableHead> {/* New column for SMTP */}
                        <TableHead>Status</TableHead>
                        <TableHead>Messages</TableHead>
                        <TableHead>Last Check</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No mail accounts configured. Add one to get started!
                          </TableCell>
                        </TableRow>
                      ) : (
                        accounts.map((account, index) => (
                          <motion.tr
                            key={account.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            className={`hover:bg-accent/50 transition-colors cursor-pointer ${
                              selectedAccount?.id === account.id ? 'bg-primary/5' : ''
                            }`}
                            onClick={() => {
                                setSelectedAccount(account);
                                if (!account.is_active_session) {
                                    // Optionally prompt for password or automatically connect if no password required
                                    // For now, let's keep it simple: if not connected, prepare for connect.
                                }
                            }}
                          >
                            <TableCell>
                              <div>
                                <div className="font-medium">{account.name}</div>
                                <div className="text-sm text-muted-foreground">{account.username}</div> {/* Use username for email */}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-sm">
                                {account.imap_host}:{account.imap_port}
                              </div>
                            </TableCell>
                            <TableCell> {/* New Cell for SMTP */}
                              <div className="font-mono text-sm">
                                {account.smtp_host}:{account.smtp_port}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                {getStatusIcon(account.status)}
                                <span className={getStatusColor(account.status)}>
                                  {account.status === 'connecting' ? 'Connecting...' : account.status}
                                </span>
                              </div>
                              {account.error && (
                                <div className="text-xs text-red-500 mt-1">{account.error}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              {account.messageCount !== undefined ? (
                                <Badge variant="outline">{account.messageCount} ({account.unreadCount} unread)</Badge>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {account.lastCheck}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end space-x-1">
                                {account.is_active_session ? (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={(e) => { e.stopPropagation(); handleFetchInbox(); }} // Fetch on click
                                            title="Refresh Inbox"
                                        >
                                            <RefreshCw className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500"
                                            onClick={(e) => { e.stopPropagation(); handleDisconnect(); }} // Disconnect active session
                                            title="Disconnect"
                                        >
                                            <XCircle className="h-3 w-3" />
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={(e) => { e.stopPropagation(); handleConnect(account, newAccountPassword); }} // Pass password for demo simplicity, in real app prompt or secure
                                            title="Connect to Mail Server"
                                        >
                                            <Mail className="h-3 w-3" />
                                        </Button>
                                        {/* Edit functionality would involve a dialog prepopulated with account data */}
                                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                                            <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteAccount(account.id); }}
                                            title="Delete Account"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </>
                                )}
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Messages Tab Content */}
              <TabsContent value="messages">
                {selectedAccount && selectedAccount.is_active_session ? (
                    <AnimatePresence mode="wait">
                        {selectedEmail ? (
                            <motion.div
                                key="email-detail"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                            >
                                <Button variant="outline" onClick={handleCloseEmailView} className="mb-4">
                                    <ChevronLeft className="h-4 w-4 mr-2" /> Back to Inbox
                                </Button>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>{selectedEmail.subject}</CardTitle>
                                        <CardDescription>
                                            From: {selectedEmail.from} <br/>
                                            To: {selectedEmail.to} {selectedEmail.cc && `(Cc: ${selectedEmail.cc})`} <br/>
                                            Date: {selectedEmail.date}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {selectedEmail.html_body ? (
                                            <div
                                                className="prose max-w-none dark:prose-invert"
                                                dangerouslySetInnerHTML={{ __html: selectedEmail.html_body }}
                                            />
                                        ) : (
                                            <p className="whitespace-pre-wrap">{selectedEmail.plain_text_body}</p>
                                        )}

                                        {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                                            <div className="border-t pt-4 mt-4">
                                                <h4 className="font-medium mb-2">Attachments ({selectedEmail.attachments.length})</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedEmail.attachments.map((attachment, idx) => (
                                                        <Badge key={idx} variant="secondary" className="flex items-center space-x-1">
                                                            <Download className="h-3 w-3" />
                                                            <span>{attachment.filename}</span>
                                                            <span className="text-xs text-muted-foreground ml-1">({formatFileSize(attachment.size)})</span>
                                                        </Badge>
                                                    ))}
                                                    {/* Note: Actual download would require a new backend route that serves file content */}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="inbox-list"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium flex items-center space-x-2">
                                            <Folder className="h-5 w-5" />
                                            <span>{selectedAccount.current_mailbox || 'INBOX'} ({selectedAccount.name})</span>
                                        </h3>
                                        <p className="text-sm text-muted-foreground">{selectedAccount.username}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Badge variant="outline">
                                            {selectedAccount.messageCount ?? 0} messages
                                        </Badge>
                                        <Button variant="outline" size="sm" onClick={handleFetchInbox} title="Refresh Inbox">
                                            <RefreshCw className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="rounded-lg border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>From</TableHead>
                                                <TableHead>Subject</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead className="w-[100px]">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {inboxEmails.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                        No messages in this mailbox.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                inboxEmails.map((message, index) => (
                                                    <motion.tr
                                                        key={message.uid} // Use UID as key
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.2, delay: index * 0.03 }}
                                                        className={`hover:bg-accent/50 transition-colors cursor-pointer`}
                                                        onClick={() => handleViewEmail(message.uid)}
                                                    >
                                                        <TableCell>{message.from}</TableCell>
                                                        <TableCell>{message.subject}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {message.date}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={(e) => { e.stopPropagation(); handleViewEmail(message.uid); }}
                                                                title="View Email"
                                                            >
                                                                <Eye className="h-3 w-3" />
                                                            </Button>
                                                        </TableCell>
                                                    </motion.tr>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                {/* Pagination Controls */}
                                {totalInboxEmails > emailsPerPage && (
                                    <div className="flex justify-end items-center space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>Please select and connect to a mail account to view messages.</p>
                  </div>
                )}
              </TabsContent>

              {/* Settings Tab Content */}
              <TabsContent value="settings">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Auto Check Settings</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="auto-check">Enable Auto Check</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically check all accounts at regular intervals (Not fully implemented with backend in this demo)
                        </p>
                      </div>
                      <Switch
                        id="auto-check"
                        checked={autoCheck}
                        onCheckedChange={setAutoCheck}
                        disabled // Disabled as backend doesn't support generic 'auto check all'
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Check Interval</Label>
                      <Select value={checkInterval} onValueChange={setCheckInterval} disabled> {/* Disabled */}
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Every minute</SelectItem>
                          <SelectItem value="5">Every 5 minutes</SelectItem>
                          <SelectItem value="10">Every 10 minutes</SelectItem>
                          <SelectItem value="30">Every 30 minutes</SelectItem>
                          <SelectItem value="60">Every hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}