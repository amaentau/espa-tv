#!/bin/bash
# diagnose-provisioning.sh
# Run this on the Raspberry Pi to diagnose provisioning connectivity issues

echo "🔍 Veo Dongle Provisioning Diagnostic"
echo "======================================"
echo "Date: $(date)"
echo "User: $(whoami)"
echo ""

echo "1. Checking Node.js processes..."
ps aux | grep node | grep -v grep
echo ""

echo "2. Checking listening ports..."
if command -v netstat > /dev/null; then
    sudo netstat -tulpn | grep :3000
else
    sudo ss -tulpn | grep :3000
fi
echo ""

echo "3. Checking Network Interfaces..."
ip addr show wlan0
echo ""

echo "4. Checking NetworkManager Connections..."
nmcli connection show
echo ""
nmcli connection show --active
echo ""

echo "5. Checking Firewall Status..."
if command -v ufw > /dev/null; then
    sudo ufw status verbose
else
    echo "ufw not installed"
fi
echo ""
if command -v iptables > /dev/null; then
    echo "Iptables rules (INPUT chain):"
    sudo iptables -L INPUT -n -v | head -n 20
fi
echo ""

echo "6. Testing local connection to port 3000..."
curl -v http://localhost:3000/health 2>&1
echo ""

echo "7. Checking logs (last 50 lines)..."
if [ -f /var/log/syslog ]; then
    grep "Veo" /var/log/syslog | tail -n 20
else
    journalctl -u veo-dongle.service -n 20 --no-pager
fi
echo ""

echo "✅ Diagnostic complete."

