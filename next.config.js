/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Configuration conditionnelle selon l'environnement
  ...(process.env.NODE_ENV === 'production' ? {
    // Exportation statique pour Netlify en production uniquement
    output: 'export',
    // Désactiver le prérendu des pages avec des routes dynamiques
    trailingSlash: true,
    // Configuration pour l'export statique
    distDir: 'out',
  } : {}),

  // Gestion des images
  images: {
    unoptimized: true, // Pour l'export statique
  },
  
  // Environnement
  env: {
    APP_NAME: process.env.APP_NAME || 'EmailSender Pro',
    APP_ENV: process.env.APP_ENV || 'development',
  },
  
  eslint: {
    // Avertir seulement en production, pas d'erreurs fatales
    ignoreDuringBuilds: true,
  },
  
  // Gestion des erreurs et 404
  onDemandEntries: {
    // Période pendant laquelle les pages compilées sont gardées en mémoire
    maxInactiveAge: 60 * 60 * 1000,
    // Nombre de pages à garder en mémoire
    pagesBufferLength: 5,
  }
};

module.exports = nextConfig; 