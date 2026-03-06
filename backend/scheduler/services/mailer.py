import os
import smtplib
from email.message import EmailMessage


def send_password_reset_email(to_email, reset_url, ttl_minutes):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USERNAME")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM_EMAIL", "no-reply@example.com")


    if not smtp_host:
        # TODO: Fill with some error here
        return 
    
    msg = EmailMessage()
    msg["Subject"] = "Password reset request"
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg.set_content(
        f"We receivced a request to reset your password. \n\n"
        f"Use this link (valid for {ttl_minutes} minutes):\n{reset_url}\n\n"
        f"If you did not request this, you can ignore this email."
    )
    msg.add_alternative(
        f"""\
    <html>
    <body>
        <p>We received a request to reset your password.</p>
        <p><a href="{reset_url}">Reset your password</a> (valid for {ttl_minutes} minutes)</p>
        <p>If you did not request this, ignore this email.</p>
    </body>
    </html>
    """,
        subtype="html",
    )

    smtp_use_tls = os.getenv("SMTP_USE_TLS", "false").lower() in ("1", "true", "yes")

    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
        if smtp_use_tls:
            server.starttls()
        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)
        server.send_message(msg)
