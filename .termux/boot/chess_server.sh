#!/bin/bash
# Prevent Android from killing the background server
termux-wake-lock

# Automatically log into Ubuntu and start your server script in the background
proot-distro login ubuntu -- bash -c 'cd ~ && ./start.sh' &
