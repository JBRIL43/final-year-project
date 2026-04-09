# HU Student Debt System - Demo Setup Guide

## Network Configuration
1. **Presenter**: Enable Arch Linux hotspot
   ```bash
   # Start backend server
   cd backend/api
   node server.js
   
   # Enable hotspot (if not already running)
   nmcli device wifi hotspot ifname wlan0 ssid "HU-Demo" password "demo1234"