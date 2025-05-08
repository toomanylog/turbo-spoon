import React from 'react';

function Error({ statusCode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-red-600 mb-4">
          {statusCode
            ? `Une erreur ${statusCode} s'est produite`
            : "Une erreur s'est produite"}
        </h1>
        <p className="text-gray-600 mb-6">
          Nous sommes désolés pour ce désagrément.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
}

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error; 