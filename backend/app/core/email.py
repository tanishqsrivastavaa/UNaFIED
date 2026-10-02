import smtplib
from email.message import EmailMessage
from ..config.settings import settings


def email_configured() -> bool:
    return bool(settings.SMTP_HOST)


def send_email(to: str, subject: str, body: str) -> None:
    """Blocking; call it off the event loop."""
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM or settings.SMTP_USER or "unafied@localhost"
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    if settings.SMTP_PORT == 465:
        smtp = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
    else:
        smtp = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
    with smtp:
        if settings.SMTP_PORT != 465:
            smtp.ehlo()
            if smtp.has_extn("starttls"):
                smtp.starttls()
                smtp.ehlo()
            elif settings.SMTP_USER:
                raise RuntimeError("SMTP server offers no TLS; refusing to send the password in clear")
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
        smtp.send_message(message)
