# Discord Notification Setup

The booking system supports two modes for sending Discord notifications: **Webhook Mode** (simpler) and **Bot Mode** (more powerful, supports DMs).

## Mode 1: Webhook Mode (Recommended for simple setup)

Webhooks are easier to set up and require no additional dependencies. Notifications are posted to Discord channels via webhook URLs.

### Setup Steps

1. **Create Discord Webhooks**
   - Go to your Discord server
   - Right-click a channel → Edit Channel → Integrations → Webhooks → New Webhook
   - Copy the webhook URL
   - Create two webhooks: one for booking notifications, one for admin notifications

2. **Configure Environment Variables**
   
   In `docker-compose.yml` or your environment:
   ```yaml
   environment:
     - BOOKING_WEBHOOK=https://discord.com/api/webhooks/XXXXXXXXX/YYYYYYYYYYYY
     - ADMIN_WEBHOOK=https://discord.com/api/webhooks/XXXXXXXXX/YYYYYYYYYYYY
   ```

3. **Restart Backend**
   ```bash
   docker compose restart backend
   ```

### What Gets Posted

- **BOOKING_WEBHOOK**: Booking creation, rebook, and group recreation notifications
- **ADMIN_WEBHOOK**: Admin confirmations/rejections (mentions user by Discord ID)
  - Also used for maintenance-related booking declines

### Fallback Behavior

If a webhook URL is empty, that notification type is silently skipped.

---

## Mode 2: Bot Mode (Advanced - Supports DMs)

Bot mode allows sending direct messages to users instead of channel messages. Requires a Discord bot token.

### Setup Steps

1. **Create a Discord Bot**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application"
   - Go to Bot → Add Bot
   - Under TOKEN, click "Copy"
   - Save the token securely

2. **Grant Bot Permissions**
   - In Developer Portal → OAuth2 → URL Generator
   - Select scopes: `bot`
   - Select permissions:
     - `Send Messages`
     - `Send Messages in Threads`
   - Copy the generated URL and add the bot to your server

3. **Configure Environment Variables**

   In `docker-compose.yml` or your environment:
   ```yaml
   environment:
     - DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
     - DISCORD_USE_DM=true  # Set to 'true' for DMs, 'false' or omit for channel messages
   ```

4. **Rebuild and Restart**
   ```bash
   docker compose build backend
   docker compose restart backend
   ```

### What Gets Posted

- **BOOKING_WEBHOOK** (optional): Still posts booking notifications to a channel if configured
- **Admin Notifications**: Sent as DMs to user (if `DISCORD_USE_DM=true`) or to channel (if `false`)

### Hybrid Mode (Bot + Webhook)

You can configure both bot token AND webhooks:
- Bot will be used for admin/DM notifications
- Webhooks will still post booking creation notifications to channels
- If bot DM fails, it falls back to webhook

---

## Configuration Reference

| Environment Variable | Description | Example |
|---|---|---|
| `BOOKING_WEBHOOK` | Webhook URL for booking notifications | `https://discord.com/api/webhooks/123/abc` |
| `ADMIN_WEBHOOK` | Webhook URL for admin action notifications | `https://discord.com/api/webhooks/456/def` |
| `DISCORD_BOT_TOKEN` | Discord bot token (enables bot mode) | `YOUR_TOKEN_HERE` |
| `DISCORD_USE_DM` | Send admin notifications as DMs instead of channel | `true` or `false` |

---

## Troubleshooting

### Notifications not appearing
- Check that webhook/bot token environment variables are set correctly
- Verify webhook URLs are still valid (they can expire)
- Check Docker logs: `docker compose logs backend`

### Bot token not working
- Verify the token is correct and hasn't been regenerated
- Ensure bot has been added to your Discord server
- Check bot permissions (needs "Send Messages" at minimum)

### DMs not being received
- Verify `DISCORD_USE_DM=true` is set
- Ensure bot is in the same server as the user
- Check if user has DMs from bots enabled in privacy settings

### Dependencies missing
If you get `discord.py not installed`, rebuild the backend:
```bash
docker compose build --no-cache backend
docker compose restart backend
```

---

## When Notifications Are Sent

1. **Booking Created** → `BOOKING_WEBHOOK`
   - User submits a new booking

2. **Booking Rebooked** → `BOOKING_WEBHOOK`
   - User reschedules an existing booking

3. **Admin Confirmed/Rejected** → `ADMIN_WEBHOOK` (with DM fallback)
   - Admin approves or rejects a booking
   - Sent to booking owner (mentions user or sends DM)

4. **Maintenance Impact** → `ADMIN_WEBHOOK` (with DM fallback)
   - Device enters maintenance, bookings are declined
   - Sent to affected users

---

## Examples

### Webhook-Only Setup
```yaml
environment:
  - BOOKING_WEBHOOK=https://discord.com/api/webhooks/123456/abcdef
  - ADMIN_WEBHOOK=https://discord.com/api/webhooks/789012/ghijkl
```

### Bot with DMs
```yaml
environment:
  - DISCORD_BOT_TOKEN=NzkyNzI5NDc2NzE4NTY4MDA.X-hvzA.Ew_example_token
  - DISCORD_USE_DM=true
```

### Hybrid (Bot DMs + Channel Webhooks)
```yaml
environment:
  - DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN
  - DISCORD_USE_DM=true
  - BOOKING_WEBHOOK=https://discord.com/api/webhooks/BOOKING_WEBHOOK_ID
  - ADMIN_WEBHOOK=https://discord.com/api/webhooks/ADMIN_WEBHOOK_ID
```
