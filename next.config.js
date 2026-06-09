/** @type {import('next').NextConfig} */

// CSP : enforcing si CSP_ENFORCE=1, sinon Report-Only (non bloquant).
const cspEnforce = process.env.CSP_ENFORCE === "1";
const cspValue = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com",
  "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// En-têtes de sécurité appliqués à toutes les réponses.
const securityHeaders = [
  // Empêche le rendu du site dans une iframe (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Bloque le MIME-sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limite les informations de référent envoyées aux tiers.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Désactive des API navigateur sensibles par défaut.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Force HTTPS (HSTS) — Netlify sert en HTTPS.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // CSP : Report-Only par défaut (ne casse rien). Mettre CSP_ENFORCE=1 pour l'imposer.
  {
    key: cspEnforce
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only",
    value: cspValue,
  },
];

const nextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer doit rester un package serveur externe (fontkit & co).
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer", "unpdf"],
  },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
