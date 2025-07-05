# backend/utils.py
import re

def parse_ftp_list(lines: list[str]) -> list[dict]:
    """
    Parses raw FTP LIST command output into a structured list of file items.
    Assumes Unix-style listing (most common) and is more robust using regex.
    """
    items = []
    
    # Regex to parse Unix-style FTP LIST output:
    # Captures: permissions, num_links, owner, group, size, month, day, time_or_year, name
    # Example line: drwxr-xr-x 2 owner group 4096 Jan 1 10:00 directory_name
    # Example line: -rw-r--r-- 1 owner group 12345 Jan 1 2024 file_name
    
    # This regex is designed to capture common variations.
    # (\S+) = Non-whitespace characters (for permissions, owner, group, parts of date)
    # \s+   = One or more whitespace characters
    # (\d+) = One or more digits (for num_links, size, day)
    # (?:\d{2}:\d{2}|\d{4}) = Non-capturing group for either HH:MM or YYYY
    # (.*)  = Captures the rest of the line for the name
    
    # Note: Some older FTP servers might not include num_links, owner, or group.
    # This regex expects them, but you can adjust it if you face issues with very minimal outputs.
    regex = re.compile(
        r"^(?P<permissions>[drwx-]{10})\s+"    # Permissions (e.g., drwxr-xr-x)
        r"(?P<num_links>\d+)\s+"               # Number of links
        r"(?P<owner>\S+)\s+"                   # Owner
        r"(?P<group>\S+)\s+"                   # Group
        r"(?P<size>\d+)\s+"                    # Size
        r"(?P<month>\w{3})\s+"                 # Month (e.g., Jan, Feb)
        r"(?P<day>\d{1,2})\s+"                 # Day (e.g., 1, 31)
        r"(?P<time_or_year>(?:\d{2}:\d{2})|(?:\d{4}))\s+" # Time (HH:MM) or Year (YYYY)
        r"(?P<name>.*)$"                       # Name (rest of the line)
    )

    for line in lines:
        match = regex.match(line)
        if match:
            data = match.groupdict()
            
            # Determine file type
            file_type = 'file'
            if data['permissions'].startswith('d'):
                file_type = 'directory'
            elif data['permissions'].startswith('l'):
                file_type = 'symlink'
                # For symlinks, the 'name' might include ' -> target', we just want the link name
                if ' -> ' in data['name']:
                    data['name'] = data['name'].split(' -> ')[0]
            
            # Skip '.' and '..' entries which represent current and parent directories
            if data['name'] == "." or data['name'] == "..":
                continue

            items.append({
                "name": data['name'],
                "type": file_type,
                "size": int(data['size']),
                # Combine date/time parts for the modified string
                "modified": f"{data['month']} {data['day']} {data['time_or_year']}",
                "permissions": data['permissions'],
                "owner": data['owner']
                # You can also include 'group': data['group'] if needed on frontend
            })
    return items