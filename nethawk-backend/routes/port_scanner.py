import nmap # type: ignore
import re
import time
import eventlet
from threading import Event
import logging # Import logging module
import subprocess # Import subprocess module for direct command execution

# Configure logging at the top of the file or in app.py
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

ip_add_pattern = re.compile(r"^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$")

def parse_ports_string(ports_input_string):
    """
    Parses a string of ports, which can include ranges (e.g., '20-30')
    and comma-separated values (e.g., '80,443,22').
    Returns a string suitable for nmap's -p option.
    """
    ports_to_scan = []
    
    ports_input_string = ports_input_string.lower().replace(" ", "")

    parts = ports_input_string.split(',')
    for part in parts:
        if '-' in part:
            try:
                start, end = map(int, part.split('-'))
                if 0 <= start <= 65535 and 0 <= end <= 65535 and start <= end:
                    ports_to_scan.append(f"{start}-{end}")
            except ValueError:
                pass
        else:
            try:
                port = int(part)
                if 0 <= port <= 65535:
                    ports_to_scan.append(str(port))
            except ValueError:
                pass
    
    return ",".join(sorted(list(set(ports_to_scan)), key=lambda x: (int(x.split('-')[0]) if '-' in x else int(x.split('-')[0])) ))


def run_port_scan(ip_address, ports_string, stop_event):
    """
    Performs the nmap scan and yields a dictionary of updates.
    The stop_event allows the scan to be interrupted.
    """
    nmap_ports_arg = parse_ports_string(ports_string)
    if not nmap_ports_arg:
        logging.error("No valid ports to scan provided.")
        yield {"status": "error", "message": "No valid ports to scan."}
        return

    if stop_event.is_set():
        logging.info("Scan aborted before starting due to stop event.")
        yield {"status": "stopped", "message": "Scan aborted before starting."}
        return

    yield {"status": "info", "message": f"Starting scan on {ip_address} for ports: {nmap_ports_arg}"}
    
    try:
        nmap_options_list = ["-Pn", "-sT", "-T4", "-p", nmap_ports_arg, "--host-timeout", "5m", "--max-retries", "3", "-oX", "-"]  # -sT = TCP connect scan

        command = ['nmap'] + nmap_options_list + [ip_address] 


        full_command_str = " ".join(command) # For logging purposes
        yield {"status": "info", "message": f"Nmap command: {full_command_str}"}
        logging.info(f"Executing Nmap command: {full_command_str}")

        # Execute Nmap using subprocess.run
        # Use a timeout to prevent indefinite hangs, and allow interrupt
        process = None # Initialize process to None
        try:
            # We don't have real-time progress updates with this method unless we parse stderr
            # on the fly, which is more complex. So, progress will be basic.
            yield {"status": "progress", "message": "Scan started (no real-time progress).", "progress": 0}

            # Start the process without waiting for it to finish immediately
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True # Decode stdout/stderr automatically
            )
            
            # Simple loop to check for stop_event while process runs
            while process.poll() is None: # While process is still running
                if stop_event.is_set():
                    logging.info("Scan stopped by user request during execution (subprocess).")
                    process.terminate() # or process.kill() for more aggressive stop
                    yield {"status": "stopped", "message": "Scan stopped by user request."}
                    return
                eventlet.sleep(1) # Yield control

            stdout, stderr = process.communicate() # Get remaining output after process finishes

            if stop_event.is_set():
                logging.info("Scan stopped before processing results (subprocess).")
                return
            
            logging.info(f"Nmap process finished. Return code: {process.returncode}")

            if process.returncode == 0:
                try:
                    temp_scanner = nmap.PortScanner()
                    # Parse the XML output directly from stdout
                    temp_scanner.analyse_nmap_xml_scan(stdout)
                    
                    if ip_address in temp_scanner.all_hosts():
                        host_info = temp_scanner[ip_address]
                        if 'tcp' in host_info:
                            for port in sorted(host_info['tcp'].keys()):
                                if stop_event.is_set():
                                    logging.info(f"Scan stopped during result processing for {port}.")
                                    yield {"status": "stopped", "message": "Scan stopped by user request during result processing."}
                                    return
                                
                                port_status = host_info['tcp'][port]['state']
                                
                                if port_status == 'open':
                                    service = host_info['tcp'][port].get('name', 'unknown')
                                    product = host_info['tcp'][port].get('product', '')
                                    version = host_info['tcp'][port].get('version', '')
                                    extra_info = f" ({product} {version})" if product or version else ""
                                    yield {
                                        "status": "open_port",
                                        "port": port,
                                        "service": service,
                                        "state": port_status,
                                        "ip": ip_address,
                                        "details": f"{service}{extra_info}"
                                    }
                                else:
                                    yield {
                                        "status": "port_status",
                                        "port": port,
                                        "state": port_status,
                                        "ip": ip_address
                                    }
                    else:
                        logging.info(f"No detailed scan results found for {ip_address} in Nmap output.")
                        yield {"status": "info", "message": f"No detailed scan results found for {ip_address}."}

                except nmap.PortScannerError as e:
                    logging.error(f"Error parsing Nmap XML output: {e}")
                    yield {"status": "error", "message": f"Error parsing Nmap XML output: {e}"}
                except Exception as e:
                    logging.error(f"An unexpected error occurred during result parsing: {e}")
                    yield {"status": "error", "message": f"An unexpected error occurred during result parsing: {e}"}
            else:
                logging.error(f"Nmap scan failed with error code {process.returncode}. Stderr: {stderr}")
                yield {"status": "error", "message": f"Nmap scan failed with error code {process.returncode}. Stderr: {stderr[:500]}..."}
                
            yield {"status": "complete", "message": "Scan completed."}
            
        except FileNotFoundError:
            logging.error(f"Error: Nmap command not found. Ensure Nmap is installed on the server.")
            yield {"status": "error", "message": "Nmap command not found. Check server installation."}
        except Exception as e:
            logging.error(f"An unexpected error occurred during Nmap scan execution: {e}")
            yield {"status": "error", "message": f"An unexpected error occurred during scan: {e}"}
    finally:
        if process and process.poll() is None: # Ensure process is terminated if still running
            process.terminate()
        stop_event.clear()


# Example usage if run directly (for testing the scanner part)
if __name__ == "__main__":
    _test_stop_event = Event()

    while True:
        ip_add_entered = input("\nPlease enter the ip address that you want to scan: ")
        if ip_add_pattern.search(ip_add_entered):
            print(f"{ip_add_entered} is a valid ip address")
            break
        else:
            print("Invalid IP address format.")

    while True:
        print("Please enter the ports to scan (e.g., '80,443,22', '1-100', or '20-30,80,443'):")
        port_input = input("Enter ports: ")
        
        test_ports_string = parse_ports_string(port_input)
        if test_ports_string:
            print(f"Scanning with Nmap ports argument: {test_ports_string}")
            break
        else:
            print("No valid ports specified. Please try again.")

    print("\nStarting scan...")
    try:
        for update in run_port_scan(ip_add_entered, port_input, _test_stop_event):
            if update["status"] == "open_port":
                print(f"OPEN: Port {update['port']}/{update['state']} Service: {update['details']}")
            elif update["status"] == "port_status":
                print(f"Port {update['port']} is {update['state']}")
            elif update["status"] == "progress":
                # In this version, progress will be basic (0% at start, 100% at end)
                # as we don't parse real-time output like NmapProcess does.
                print(f"{update['message']}") 
            else:
                print(f"Status: {update['status']} - {update['message']}")
            time.sleep(0.1) # Small delay to prevent overwhelming terminal output
    except KeyboardInterrupt:
        print("\nScan interrupted by user.")
        _test_stop_event.set()
    finally:
        _test_stop_event.clear()