#!/bin/bash
# Project folder mein jayein
cd ~

# Agar koi bhi changes ya nayi files hain toh unhe add aur commit karein
git add .
git commit -m "Auto-backup: $(date +'%Y-%m-%d %H:%M:%S')"

# GitHub par push kar dein
git push origin main
