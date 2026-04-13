# backend/discord_utils.py
'''
Utility functions for sending notifications to Discord via webhooks or bot.
Supports both webhook and bot modes with fallback logic.
'''
import os
import httpx
import asyncio
import logging

logger = logging.getLogger(__name__)

# Webhook configuration
BOOKING_WEBHOOK = os.getenv("BOOKING_WEBHOOK", "")
ADMIN_WEBHOOK = os.getenv("ADMIN_WEBHOOK", "")

# Bot configuration
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
DISCORD_BOT_ENABLED = bool(DISCORD_BOT_TOKEN)
DISCORD_USE_DM = os.getenv("DISCORD_USE_DM", "false").lower() == "true"
MAX_DISCORD_CONTENT_LEN = 1900
DISCORD_TRUNCATION_SUFFIX = "\n> ...message truncated."


def _truncate_discord_content(content: str) -> str:
    if not content:
        return content
    
    if len(content) <= MAX_DISCORD_CONTENT_LEN:
        return content
    
    max_body_len = MAX_DISCORD_CONTENT_LEN - len(DISCORD_TRUNCATION_SUFFIX)
    if max_body_len <= 0:
        return DISCORD_TRUNCATION_SUFFIX[:MAX_DISCORD_CONTENT_LEN]

    lines = content.splitlines()
    kept_lines = []
    current_len = 0

    for line in lines:
        candidate = line if not kept_lines else f"\n{line}"
        if current_len + len(candidate) > max_body_len:
            break
        kept_lines.append(line)
        current_len += len(candidate)

    if kept_lines:
        return "\n".join(kept_lines) + DISCORD_TRUNCATION_SUFFIX
    
    return content[:max_body_len] + DISCORD_TRUNCATION_SUFFIX

# Bot client (lazy-loaded)
_bot_client = None

def _has_bot_capability():
    """Check if bot mode is configured."""
    return DISCORD_BOT_ENABLED

def _has_webhook_capability():
    """Check if webhook mode is available."""
    return bool(BOOKING_WEBHOOK or ADMIN_WEBHOOK)

async def _get_bot_client():
    """Lazy-load and return Discord bot client."""
    global _bot_client
    if _bot_client is not None:
        return _bot_client
    
    if not DISCORD_BOT_ENABLED:
        return None
    
    try:
        import discord
        
        # Create a simple bot client for sending messages
        intents = discord.Intents.default()
        _bot_client = discord.Client(intents=intents)
        
        # Start the bot in background and wait until it's ready
        await _bot_client.login(DISCORD_BOT_TOKEN)
        asyncio.create_task(_bot_client.connect(reconnect=True))
        await asyncio.wait_for(_bot_client.wait_until_ready(), timeout=10.0)

        logger.info("Discord bot connected and ready")
        return _bot_client
    except ImportError:
        logger.warning("discord.py not installed; bot mode unavailable")
        return None
    except Exception as e:
        logger.error(f"Failed to initialize Discord bot: {e}")
        return None

async def _send_bot_dm(discord_id: str, content: str):
    """Send a direct message via Discord bot."""
    try:
        client = await _get_bot_client()
        if not client:
            logger.warning("Bot client not available for DM")
            return False
        if not client.is_ready():
            logger.warning("Discord bot client is not ready for DM")
            return False
        
        user = await client.fetch_user(int(discord_id))
        safe_content = _truncate_discord_content(content)
        await user.send(safe_content)
        logger.info(f"Sent Discord DM to user {discord_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to send DM to {discord_id}: {e}")
        return False

async def send_direct_discord_dm(discord_id: str, content: str) -> bool:
    """Send a direct Discord DM via bot, without webhook fallback."""
    if not DISCORD_BOT_ENABLED or not DISCORD_USE_DM or not discord_id:
        logger.warning("Discord DM mode unavailable for direct auth/message delivery")
        return False
    return await _send_bot_dm(discord_id, content)

async def _post_to_webhook(url: str, content: str, allowed_mentions: dict | None = None):
    """Post a message to a Discord webhook."""
    if not url:
        return False

    try:
        payload = {"content": _truncate_discord_content(content)}
        if allowed_mentions is not None:
            payload["allowed_mentions"] = allowed_mentions

        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=5.0)
            return resp.status_code in (200, 204)
    except Exception as e:
        logger.error(f"Failed to post to webhook: {e}")
        return False

async def initialize_discord_bot():
    """Initialize and connect the Discord bot client on startup."""
    if not DISCORD_BOT_ENABLED:
        logger.debug("Discord bot mode is disabled")
        return None

    client = await _get_bot_client()
    if client is None:
        logger.warning("Discord bot client could not be initialized")
        return None

    logger.info("Discord bot client initialized")
    return client

async def send_booking_created_notification(content: str):
    """Send booking creation notification via bot or webhook."""
    if DISCORD_BOT_ENABLED and _has_bot_capability():
        # Bot mode: post to a configured channel webhook or skip if no webhook configured
        if BOOKING_WEBHOOK:
            await _post_to_webhook(BOOKING_WEBHOOK, content)
        else:
            logger.debug("Bot mode enabled but no BOOKING_WEBHOOK configured; skipping notification")
    else:
        # Webhook mode
        await _post_to_webhook(BOOKING_WEBHOOK, content)

async def send_admin_action_notification(content: str, discord_id: str):
    """Send admin action notification via bot DM or webhook."""
    if DISCORD_BOT_ENABLED and DISCORD_USE_DM and discord_id:
        # Bot DM mode: send direct message to user
        sent = await _send_bot_dm(discord_id, content)
        if sent:
            return
        # Fall back to webhook if DM fails
        logger.info(f"Bot DM failed for {discord_id}; falling back to webhook")
    
    # Webhook mode (default or fallback)
    MAX_DISCORD_CONTENT_LEN = 1900
    if content and len(content) > MAX_DISCORD_CONTENT_LEN:
        content = content[:MAX_DISCORD_CONTENT_LEN - 24] + "\n> ...message truncated."
    if ADMIN_WEBHOOK:
        mentions = {
            "users": [discord_id] if discord_id else [],
            "parse": []   
        }
        await _post_to_webhook(ADMIN_WEBHOOK, content, allowed_mentions=mentions)

