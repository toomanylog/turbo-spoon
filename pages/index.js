import { useState, useEffect } from 'react';
import EmailSender from '../components/EmailSender';
import { Lock, Key, LogIn, Shield } from 'lucide-react';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Vérifier si l'utilisateur est déjà authentifié
  useEffect(() => {
    const storedAuth = localStorage.getItem('emailSenderAuth');
    if (storedAuth) {
      try {
        const auth = JSON.parse(storedAuth);
        if (auth.token && auth.expiry && new Date(auth.expiry) > new Date()) {
          setIsAuthenticated(true);
          setIsAdmin(auth.isAdmin || false);
        } else {
          // Token expiré, nettoyer
          localStorage.removeItem('emailSenderAuth');
        }
      } catch (e) {
        console.error("Erreur de lecture de l'authentification:", e);
        localStorage.removeItem('emailSenderAuth');
      }
    }
    setLoading(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      // Adaptation pour Netlify: utiliser /.netlify/functions/auth au lieu de /api/auth
      const apiUrl = process.env.NODE_ENV === 'production'
        ? '/.netlify/functions/auth'
        : '/api/auth';
        
      // S'assurer qu'il n'y a pas de barre oblique finale dans l'URL
      const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
        
      const response = await fetch(cleanUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      // Vérifier d'abord si la réponse est OK avant de tenter le parsing JSON
      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status} ${response.statusText}`);
      }
      
      // S'assurer que le contenu est bien du JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('La réponse du serveur n\'est pas au format JSON');
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Stocker l'authentification
        localStorage.setItem('emailSenderAuth', JSON.stringify({
          token: result.token,
          expiry: result.expiry,
          isAdmin: result.isAdmin
        }));
        
        setIsAuthenticated(true);
        setIsAdmin(result.isAdmin || false);
      } else {
        setError(result.error || "Échec de l'authentification");
      }
    } catch (error) {
      console.error("Erreur d'authentification:", error);
      setError(`Erreur de connexion: ${error.message}`);
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('emailSenderAuth');
    setIsAuthenticated(false);
    setIsAdmin(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-600 to-indigo-800">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center mb-6">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-full inline-flex items-center justify-center mb-4">
              <Lock className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Email Sender Pro</h1>
            <p className="text-gray-600 mt-1">Veuillez vous authentifier pour accéder à l'application</p>
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pl-10"
                  placeholder="Entrez votre mot de passe"
                  required
                />
                <Key className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>
            
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md flex items-center justify-center"
            >
              <LogIn className="h-5 w-5 mr-2" />
              Se connecter
            </button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Pour obtenir un accès, veuillez contacter l'administrateur</p>
          </div>
        </div>
      </div>
    );
  }

  // Version avec les boutons admin et déconnexion intégrés dans EmailSender
  return (
    <EmailSender isAdmin={isAdmin} onLogout={handleLogout} />
  );
} 