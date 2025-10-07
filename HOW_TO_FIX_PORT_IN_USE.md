# How to Fix "Address Already in Use" Error

## The Problem

When you try to run `pnpm run db:studio` and get:

```
Error: listen EADDRINUSE: address already in use 127.0.0.1:4983
```

This means Drizzle Studio is already running in the background.

---

## The Solution (Windows)

### Step 1: Find the Process

Run this command:

```bash
netstat -ano | findstr :4983
```

### Step 2: Read the Output

You'll see something like this:

```
TCP    127.0.0.1:4983    0.0.0.0:0    LISTENING    16344
TCP    127.0.0.1:4983    127.0.0.1:52511    FIN_WAIT_2    16344
```

**What to look for:**

- Find the line with **`LISTENING`**
- Look at the **last number** on that line
- That's your PID (Process ID)

In this example: **16344**

### Step 3: Kill the Process

Use the PID you found:

```bash
taskkill /F /PID 16344
```

**Replace `16344` with YOUR PID from Step 2!**

You should see:

```
SUCCESS: The process with PID 16344 has been terminated.
```

### Step 4: Restart Drizzle Studio

Now you can start it again:

```bash
pnpm run db:studio
```

---

## Visual Guide

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Run netstat                                         │
└─────────────────────────────────────────────────────────────┘

  C:\> netstat -ano | findstr :4983

┌─────────────────────────────────────────────────────────────┐
│ Step 2: Find the PID (last number on LISTENING line)       │
└─────────────────────────────────────────────────────────────┘

  TCP  127.0.0.1:4983  0.0.0.0:0  LISTENING  16344
                                              ↑↑↑↑↑
                                          This is the PID!

┌─────────────────────────────────────────────────────────────┐
│ Step 3: Kill the process                                    │
└─────────────────────────────────────────────────────────────┘

  C:\> taskkill /F /PID 16344

  SUCCESS: The process with PID 16344 has been terminated.

┌─────────────────────────────────────────────────────────────┐
│ Step 4: Start Drizzle Studio                                │
└─────────────────────────────────────────────────────────────┘

  C:\> pnpm run db:studio

  Drizzle Studio is up and running on https://local.drizzle.studio
```

---

## Quick Copy-Paste Solution

Just run these commands one by one:

```bash
# 1. Find the PID
netstat -ano | findstr :4983

# 2. Kill it (replace 16344 with YOUR PID from step 1)
taskkill /F /PID 16344

# 3. Restart
pnpm run db:studio
```

---

## For Mac/Linux Users

Much simpler - just run:

```bash
# Find and kill in one command
lsof -ti:4983 | xargs kill -9

# Restart
pnpm run db:studio
```

---

## Why Does This Happen?

Drizzle Studio runs in the background even after you close your terminal or browser. Common causes:

- You closed the terminal without stopping the server (Ctrl+C)
- You started it multiple times
- The previous session didn't shut down cleanly
- You ran it in background mode

---

## How to Properly Stop Drizzle Studio

When you're done using it:

1. Go to the terminal where it's running
2. Press **`Ctrl+C`**
3. Wait for it to say it's shut down

This prevents the port-in-use error next time!

---

## Still Having Issues?

If the process keeps coming back:

1. Check Task Manager for any `node.exe` processes
2. Right-click and "End Task" on any suspicious ones
3. Restart your terminal
4. Try again

---

**Need more help?** Check `TROUBLESHOOTING.md` for other common issues.
