import subprocess
import time
import re
import sys

def run_tunnel(port=5000):
    """
    Cloudflare Quick Tunnel ke zariye local 5000 port ko public HTTPS URL par map karta hai.
    PRoot / Alpine me install karne ke liye: apk add cloudflared
    """
    cmd = ["cloudflared", "tunnel", "--url", f"http://127.0.0.1:{port}"]
    
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True
        )
        print("[*] Initiating secure Cloudflare tunnel...")
        
        for line in proc.stdout:
            match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
            if match:
                url = match.group(0)
                print("==================================================")
                print(f"[✔] Public URL: {url}")
                print(f"[✔] Dashboard : {url}/dev-dashboard")
                print("==================================================")
                break
                
        while True:
            time.sleep(1)
            
    except FileNotFoundError:
        print("[!] 'cloudflared' command nahi mili. Alpine me chalayein: apk add cloudflared")
    except KeyboardInterrupt:
        print("\n[*] Stopping tunnel...")
        proc.terminate()

if __name__ == "__main__":
    port_arg = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    run_tunnel(port_arg)
