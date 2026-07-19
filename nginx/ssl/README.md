# SSL Certificate Configuration

## Overview

This directory holds the TLS/SSL certificates used by the Nginx reverse proxy. Certificates are **not** included in version control for security reasons.

## Required Files

Place the following files in this directory (`nginx/ssl/`):

| File | Description |
|------|-------------|
| `fullchain.pem` | Full certificate chain (server cert + intermediate CA) |
| `privkey.pem` | Private key for the certificate |

## Certificate Options

### Option 1: Self-Signed Certificate (Development)

Generate a self-signed certificate for local development:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/C=MX/ST=Estado/L=Ciudad/O=Clinica/CN=localhost"
```

### Option 2: Let's Encrypt (Production)

For production deployments, use certbot to obtain a free certificate:

```bash
# Install certbot
sudo apt install certbot

# Obtain certificate (standalone mode)
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates to this directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/
```

For automatic renewal with docker-compose, the nginx.conf includes support for the ACME challenge at `/.well-known/acme-challenge/`.

### Option 3: Custom CA-Signed Certificate

If your organization provides certificates:

1. Obtain the certificate and key from your CA
2. Ensure the certificate chain is complete (concatenate server cert + intermediate)
3. Place files as `fullchain.pem` and `privkey.pem` in this directory

## File Permissions

Ensure proper permissions on the private key:

```bash
chmod 600 nginx/ssl/privkey.pem
chmod 644 nginx/ssl/fullchain.pem
```

## TLS Configuration

The Nginx configuration enforces:

- **TLS 1.3 only** — no support for older TLS versions
- **Modern cipher suites**: TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256, TLS_AES_128_GCM_SHA256
- **HSTS**: Strict-Transport-Security with 1-year max-age and includeSubDomains
- **OCSP Stapling**: Enabled for faster certificate validation
- **Session tickets**: Disabled for forward secrecy

## Security Headers

The following headers are applied on all HTTPS responses:

| Header | Value |
|--------|-------|
| Strict-Transport-Security | max-age=31536000; includeSubDomains |
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| X-XSS-Protection | 1; mode=block |
| Content-Security-Policy | default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws:; frame-ancestors 'none' |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=() |

## Troubleshooting

- **Certificate not found**: Ensure files are named exactly `fullchain.pem` and `privkey.pem`
- **Permission denied**: Check file permissions (see above)
- **Certificate expired**: Renew and restart the nginx container: `docker compose restart nginx`
- **Mixed content warnings**: Ensure all resources are loaded over HTTPS
