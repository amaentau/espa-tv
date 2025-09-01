# Raspberry Pi Setup Guide

This guide will help you set up the Raspberry Pi component of the Veo Dongle system.

## Hardware Requirements

- Raspberry Pi 4 or newer (recommended)
- MicroSD card (32GB or larger)
- Power supply (official Raspberry Pi power supply recommended)
- Ethernet cable or WiFi dongle (for network connectivity)
- HDMI cable and display (for initial setup)

## Software Prerequisites

### Operating System
- Raspberry Pi OS (64-bit) - Lite or Desktop version
- Latest updates installed

### System Packages
```bash
sudo apt update
sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chromium
sudo apt install -y chromium-browser

# Install additional dependencies
sudo apt install -y libnss3-dev libatk-bridge2.0-dev libdrm2 libxkbcommon-dev libxss1 libasound2
```

## Project Setup

### 1. Clone or Download the Project

```bash
cd ~
git clone <your-repo-url> veo-dongle
cd veo-dongle/raspberry-pi
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure the Application

```bash
cp config.example.js config.js
```

Edit `config.js` with your settings:

```javascript
module.exports = {
  // Your Veo stream URL
  veoStreamUrl: "https://your-veo-stream-url.com",

  // Local control port
  port: 3000,

  // Cloud service URL (if using remote control)
  cloudUrl: "http://your-cloud-server.com:4000",

  // Device identifier
  deviceId: "raspberry-pi-living-room",

  // Chromium configuration
  chromium: {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--start-fullscreen',
      '--kiosk',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  }
};
```

## Testing the Setup

### 1. Test Chromium Launch

```bash
# Test basic Chromium functionality
chromium-browser --no-sandbox --version

# Test fullscreen mode
chromium-browser --no-sandbox --start-fullscreen --kiosk https://example.com
```

### 2. Test Node.js Application

```bash
# Start the application
npm start
```

You should see output like:
```
Initializing Veo Dongle Raspberry Pi...
Launching Chromium browser...
Chromium browser launched successfully
Navigating to veo stream: https://your-veo-stream-url.com
Successfully loaded veo stream
Veo Dongle ready. Access control interface at http://localhost:3000
```

### 3. Test Local Control API

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test play command
curl -X POST http://localhost:3000/control/play

# Test fullscreen command
curl -X POST http://localhost:3000/control/fullscreen
```

## Auto-start Configuration

### Using systemd (Recommended)

1. Create a systemd service file:

```bash
sudo nano /etc/systemd/system/veo-dongle.service
```

2. Add the following content:

```ini
[Unit]
Description=Veo Dongle Raspberry Pi Service
After=network.target graphical.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/veo-dongle/raspberry-pi
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=graphical.target
```

3. Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable veo-dongle
sudo systemctl start veo-dongle
sudo systemctl status veo-dongle
```

### Using Cron (@reboot)

1. Edit crontab:

```bash
crontab -e
```

2. Add the following line:

```bash
@reboot cd /home/pi/veo-dongle/raspberry-pi && /usr/bin/node src/index.js
```

## Troubleshooting

### Common Issues

#### 1. Chromium Won't Start
**Symptoms**: Application fails to launch browser
**Solutions**:
- Check if Chromium is installed: `which chromium-browser`
- Verify display is connected and working
- Try running without kiosk mode first
- Check system resources (RAM, CPU)

#### 2. Stream Won't Load
**Symptoms**: Browser opens but stream doesn't play
**Solutions**:
- Verify the Veo stream URL is correct and accessible
- Check network connectivity
- Try loading the URL manually in Chromium
- Check for authentication requirements

#### 3. Fullscreen Mode Not Working
**Symptoms**: Browser starts but not in fullscreen
**Solutions**:
- Ensure display is properly connected
- Check Chromium command line arguments
- Try different fullscreen flags
- Verify no other window manager interference

#### 4. Application Crashes on Startup
**Symptoms**: Node.js process exits immediately
**Solutions**:
- Check Node.js version: `node --version`
- Verify all dependencies are installed: `npm list`
- Check configuration file syntax
- Review application logs

### Log Files

#### systemd Logs
```bash
# View service logs
sudo journalctl -u veo-dongle -f

# View recent logs
sudo journalctl -u veo-dongle -n 50
```

#### Application Logs
The application logs to console by default. For persistent logging, you can redirect output:

```bash
# In systemd service file, add:
StandardOutput=journal
StandardError=journal
```

### Performance Optimization

#### Memory Management
```bash
# Check memory usage
free -h

# Monitor process
top -p $(pgrep node)
```

#### Disable Unnecessary Services
```bash
# Stop unnecessary services
sudo systemctl disable bluetooth
sudo systemctl disable avahi-daemon
```

#### GPU Memory Allocation
Edit `/boot/config.txt`:
```
gpu_mem=256
```

## Network Configuration

### Static IP (Recommended for Production)

1. Edit dhcpcd configuration:

```bash
sudo nano /etc/dhcpcd.conf
```

2. Add static IP configuration:

```bash
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1
```

3. Restart networking:

```bash
sudo systemctl restart dhcpcd
```

### Firewall Configuration

```bash
# Allow SSH (if needed)
sudo ufw allow ssh

# Allow Veo Dongle port
sudo ufw allow 3000

# Enable firewall
sudo ufw enable
```

## Security Considerations

### User Permissions
- Run the service as non-root user (pi)
- Use minimal required permissions
- Avoid running as root

### Network Security
- Use HTTPS for cloud communications
- Implement proper authentication
- Keep system updated

### Physical Security
- Secure physical access to the device
- Use official power supplies
- Protect against power surges

## Monitoring

### Health Checks
```bash
# Check if service is running
sudo systemctl is-active veo-dongle

# Check application health
curl http://localhost:3000/health
```

### System Monitoring
```bash
# System resources
htop

# Network connections
netstat -tlnp

# Disk usage
df -h
```

## Backup and Recovery

### Backup Configuration
```bash
# Backup application files
tar -czf veo-dongle-backup.tar.gz ~/veo-dongle

# Backup systemd configuration
sudo cp /etc/systemd/system/veo-dongle.service ~/veo-dongle-backup/
```

### Recovery Procedure
1. Restore from backup
2. Reinstall dependencies: `npm install`
3. Restore systemd service: `sudo cp veo-dongle.service /etc/systemd/system/`
4. Reload systemd: `sudo systemctl daemon-reload`
5. Start service: `sudo systemctl start veo-dongle`

## Support

For additional help:
1. Check the application logs
2. Verify network connectivity
3. Test individual components
4. Consult the main project documentation
