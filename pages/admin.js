import { useState, useEffect } from 'react';
import { Key, Clock, Trash, Plus, Copy, RefreshCw, ArrowLeft, Shield } from 'lucide-react';

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [licenses, setLicenses] = useState([]);
  const [newLicense, setNewLicense] = useState({
    name: '',
    days: 30,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Vérifier si l'utilisateur est admin au chargement
  useEffect(() => {
    const checkAuth = () => {
      const storedAuth = localStorage.getItem('emailSenderAuth');
      
      if (storedAuth) {
        try {
          const auth = JSON.parse(storedAuth);
          if (auth.token && auth.expiry && new Date(auth.expiry) > new Date() && auth.isAdmin) {
            setIsAdmin(true);
            fetchLicenses();
          } else {
            // Redirection vers la page d'accueil
            window.location.href = '/';
          }
        } catch (e) {
          console.error("Erreur de lecture de l'authentification:", e);
          window.location.href = '/';
        }
      } else {
        // Pas authentifié, redirection
        window.location.href = '/';
      }
      
      setLoading(false);
    };
    
    checkAuth();
  }, []);
  
  // Fonction pour récupérer les licences
  const fetchLicenses = async () => {
    try {
      // Récupérer le token d'authentification
      const storedAuth = localStorage.getItem('emailSenderAuth');
      if (!storedAuth) {
        setError('Session expirée, veuillez vous reconnecter');
        return;
      }
      
      const auth = JSON.parse(storedAuth);
      
      // Adaptation pour Netlify
      const apiUrl = process.env.NODE_ENV === 'production'
        ? '/.netlify/functions/licenses'
        : '/api/licenses';
        
      // S'assurer qu'il n'y a pas de barre oblique finale
      const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
        
      const response = await fetch(cleanUrl, {
        headers: {
          'Authorization': `Bearer ${btoa(JSON.stringify(auth))}`
        }
      });
      
      // Vérifier si la réponse est OK
      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setLicenses(data.licenses);
      } else {
        setError(data.error || 'Erreur lors du chargement des licences');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des licences:', error);
      setError(`Erreur de connexion: ${error.message}`);
    }
  };
  
  // Fonction pour créer une nouvelle licence
  const createLicense = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!newLicense.name || !newLicense.days) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    
    try {
      // Récupérer le token d'authentification
      const storedAuth = localStorage.getItem('emailSenderAuth');
      if (!storedAuth) {
        setError('Session expirée, veuillez vous reconnecter');
        return;
      }
      
      const auth = JSON.parse(storedAuth);
      
      // Adaptation pour Netlify
      const apiUrl = process.env.NODE_ENV === 'production'
        ? '/.netlify/functions/licenses'
        : '/api/licenses';
        
      // S'assurer qu'il n'y a pas de barre oblique finale
      const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
        
      const response = await fetch(cleanUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${btoa(JSON.stringify(auth))}`
        },
        body: JSON.stringify(newLicense)
      });
      
      // Vérifier si la réponse est OK
      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess(`Licence créée avec succès: ${result.password}`);
        // Copier le mot de passe dans le presse-papier
        navigator.clipboard.writeText(result.password);
        // Mettre à jour la liste
        fetchLicenses();
        // Réinitialiser le formulaire
        setNewLicense({
          name: '',
          days: 30,
        });
      } else {
        setError(result.error || 'Erreur lors de la création de la licence');
      }
    } catch (error) {
      console.error('Erreur lors de la création de la licence:', error);
      setError(`Erreur lors de la création de la licence: ${error.message}`);
    }
  };
  
  // Fonction pour supprimer une licence
  const deleteLicense = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette licence ?')) {
      return;
    }
    
    try {
      // Récupérer le token d'authentification
      const storedAuth = localStorage.getItem('emailSenderAuth');
      if (!storedAuth) {
        setError('Session expirée, veuillez vous reconnecter');
        return;
      }
      
      const auth = JSON.parse(storedAuth);
      
      // Adaptation pour Netlify
      const apiUrl = process.env.NODE_ENV === 'production'
        ? `/.netlify/functions/licenses?id=${id}`
        : `/api/licenses?id=${id}`;
        
      // S'assurer qu'il n'y a pas de barre oblique finale
      const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
        
      const response = await fetch(cleanUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${btoa(JSON.stringify(auth))}`
        }
      });
      
      // Vérifier si la réponse est OK
      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess('Licence supprimée avec succès');
        fetchLicenses();
      } else {
        setError(result.error || 'Erreur lors de la suppression de la licence');
      }
    } catch (error) {
      console.error('Erreur lors de la suppression de la licence:', error);
      setError(`Erreur lors de la suppression de la licence: ${error.message}`);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center">
            <div className="bg-red-100 text-red-600 p-3 rounded-full inline-flex items-center justify-center mb-4">
              <Shield className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Accès refusé</h1>
            <p className="text-gray-600 mt-1">Vous n'avez pas les droits administrateur</p>
            <a 
              href="/"
              className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
            >
              Retour à l'accueil
            </a>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center">
            <a 
              href="/"
              className="mr-4 text-blue-600 hover:text-blue-800 flex items-center"
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Retour à l'application
            </a>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Shield className="h-6 w-6 mr-2 text-indigo-600" />
              Panneau d'administration
            </h1>
          </div>
          
          <button
            onClick={fetchLicenses}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <RefreshCw className="h-5 w-5 mr-1" />
            Actualiser
          </button>
        </div>
        
        {/* Formulaire de création */}
        <div className="bg-white shadow rounded-lg mb-6 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Créer une nouvelle licence</h2>
          
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 text-green-700 p-3 rounded-md mb-4 text-sm flex justify-between items-center">
              <span>{success}</span>
              <button 
                onClick={() => navigator.clipboard.writeText(success.replace('Licence créée avec succès: ', ''))}
                className="text-green-800 hover:text-green-900 p-1"
                title="Copier le mot de passe"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          )}
          
          <form onSubmit={createLicense}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du client
                </label>
                <input
                  type="text"
                  value={newLicense.name}
                  onChange={(e) => setNewLicense({...newLicense, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ex: Entreprise ABC"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Durée de validité (jours)
                </label>
                <select
                  value={newLicense.days}
                  onChange={(e) => setNewLicense({...newLicense, days: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="7">7 jours</option>
                  <option value="15">15 jours</option>
                  <option value="30">30 jours</option>
                  <option value="60">60 jours</option>
                  <option value="90">90 jours</option>
                  <option value="180">180 jours</option>
                  <option value="365">365 jours</option>
                </select>
              </div>
            </div>
            
            <button
              type="submit"
              className="mt-4 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md flex items-center justify-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Créer une licence
            </button>
          </form>
        </div>
        
        {/* Liste des licences */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Licences actives ({licenses.length})</h2>
          </div>
          
          {licenses.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Aucune licence trouvée
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mot de passe
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Créée le
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expire le
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {licenses.map(license => (
                    <tr key={license.id} className={`${new Date(license.expiry) < new Date() ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{license.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 flex items-center">
                          <span className="font-mono">{license.plainPassword || '********'}</span>
                          {license.plainPassword && (
                            <button 
                              onClick={() => navigator.clipboard.writeText(license.plainPassword)}
                              className="ml-2 text-blue-600 hover:text-blue-800"
                              title="Copier le mot de passe"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(license.created).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm flex items-center ${
                          new Date(license.expiry) < new Date() 
                            ? 'text-red-600' 
                            : 'text-green-600'
                        }`}>
                          <Clock className="h-4 w-4 mr-1" />
                          {new Date(license.expiry).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => deleteLicense(license.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Supprimer"
                        >
                          <Trash className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 