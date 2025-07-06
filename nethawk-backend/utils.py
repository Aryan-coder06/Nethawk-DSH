# backend/utils.py
import re

def parse_ftp_list(lines: list[str]) -> list[dict]:
    """
    Parses raw FTP LIST command output into a structured list of file items.
    Assumes Unix-style listing (most common) and is more robust using regex.
    """
    items = []
    
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
            
            if data['name'] == "." or data['name'] == "..":
                continue

            items.append({
                "name": data['name'],
                "type": file_type,
                "size": int(data['size']),
                "modified": f"{data['month']} {data['day']} {data['time_or_year']}",
                "permissions": data['permissions'],
                "owner": data['owner']
            })
    return items
