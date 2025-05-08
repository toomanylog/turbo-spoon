import React from 'react';
import Link from 'next/link';

export default function Custom500() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-6 bg-white rounded-lg shadow-md max-w-md">
        <h1 className="text-4xl font-bold text-red-600 mb-6">500</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Erreur serveur</h2>
        <p className="text-gray-600 mb-8">
          Une erreur s'est produite sur notre serveur. Nous nous excusons pour ce désagrément.
        </p>
        <Link href="/" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
} 