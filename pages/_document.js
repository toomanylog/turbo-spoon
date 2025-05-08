import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="fr">
      <Head>
        <meta charSet="utf-8" />
        <meta name="description" content="Application d'envoi d'emails professionnelle via SMTP" />
        <meta name="theme-color" content="#3b82f6" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="author" content="EmailPro SMTP" />
        <meta name="keywords" content="email, smtp, email sender, email client, professional email" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
} 