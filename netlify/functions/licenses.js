const crypto = require('crypto');

// Constantes pour la sécurité
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'adminEmailSenderPro2024';
const SECRET_KEY = process.env.SECRET_KEY || 'P6nM@5kL9qR#7sT2wX4yZ8aB1cD3eF';

// Utiliser les variables d'environnement pour stocker les licences au lieu des fichiers
let licensesCache = null;

// Fonction pour générer un ID unique
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Fonction pour générer un mot de passe
function generatePassword(length = 10) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

// Fonction pour hacher un mot de passe
function hashPassword(password) {
  return crypto
    .createHash('sha256')
    .update(password + SECRET_KEY)
    .digest('hex');
}

// Fonction pour charger les licences depuis la variable d'environnement
function loadLicenses() {
  try {
    // Si on a déjà chargé les licences dans cette instance, retourner le cache
    if (licensesCache !== null) {
      return licensesCache;
    }
    
    // Sinon, charger depuis la variable d'environnement
    const licensesEnv = process.env.LICENSES_DATA;
    if (licensesEnv) {
      licensesCache = JSON.parse(licensesEnv);
      return licensesCache;
    }
    
    // Si pas de données, retourner un tableau vide
    licensesCache = [];
    return licensesCache;
  } catch (error) {
    console.error("Erreur lors du chargement des licences:", error);
    // En cas d'erreur, initialiser avec un tableau vide
    licensesCache = [];
    return licensesCache;
  }
}

// Fonction pour sauvegarder les licences - dans un environnement Netlify, 
// on ne peut pas réellement sauvegarder dans les variables d'environnement à l'exécution
// Cette fonction simule donc un succès mais les données sont temporaires
function saveLicenses(licenses) {
  try {
    // Mettre à jour le cache en mémoire
    licensesCache = licenses;
    console.log("Licences sauvegardées en mémoire (temporaire)", licenses);
    return true;
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des licences:", error);
    return false;
  }
}

// Vérifier l'authentification admin
function verifyAdmin(event) {
  try {
    const auth = event.headers.authorization;
    if (!auth) return false;
    
    const token = auth.split(' ')[1];
    if (!token) return false;
    
    const storedAuth = JSON.parse(Buffer.from(token, 'base64').toString());
    if (!storedAuth.token || !storedAuth.expiry || !storedAuth.isAdmin) return false;
    
    // Vérifier l'expiration
    if (new Date(storedAuth.expiry) < new Date()) return false;
    
    return true;
  } catch (error) {
    console.error("Erreur lors de la vérification de l'authentification admin:", error);
    return false;
  }
}

exports.handler = async function(event, context) {
  // En-têtes CORS pour permettre les requêtes cross-origin
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Traiter les requêtes OPTIONS (pre-flight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }
  
  // Vérification de l'authentification pour toutes les méthodes sauf GET sans ID
  if (!(event.httpMethod === 'GET' && !event.queryStringParameters?.id)) {
    // Vérification d'authentification
    const isAuthenticated = verifyAdmin(event);
    
    if (!isAuthenticated) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Authentification requise' 
        })
      };
    }
  }
  
  // Méthode GET - Récupérer les licences
  if (event.httpMethod === 'GET') {
    try {
      const licenses = loadLicenses();
      const id = event.queryStringParameters?.id;
      
      // Si on demande une licence spécifique
      if (id) {
        const license = licenses.find(lic => lic.id === id);
        if (!license) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Licence non trouvée'
            })
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            license
          })
        };
      }
      
      // Sinon, renvoyer toutes les licences
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          licenses
        })
      };
    } catch (error) {
      console.error("Erreur lors de la récupération des licences:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Erreur de serveur: ${error.message || 'Erreur inconnue'}`
        })
      };
    }
  }
  
  // Méthode POST - Créer une licence
  if (event.httpMethod === 'POST') {
    try {
      // Vérifier que le corps de la requête est valide
      if (!event.body) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Corps de requête vide' })
        };
      }
      
      let data;
      try {
        data = JSON.parse(event.body);
      } catch (err) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Format JSON invalide' })
        };
      }
      
      const { name, days } = data;
      
      if (!name || !days) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Nom du client et durée de validité requis'
          })
        };
      }
      
      // Charger les licences existantes
      const licenses = loadLicenses();
      
      // Générer un mot de passe
      const plainPassword = generatePassword();
      const password = hashPassword(plainPassword);
      
      // Créer la licence
      const now = new Date();
      const expiry = new Date();
      expiry.setDate(now.getDate() + parseInt(days));
      
      const newLicense = {
        id: generateId(),
        name,
        password,
        plainPassword, // À ne pas stocker en production!
        created: now.toISOString(),
        expiry: expiry.toISOString()
      };
      
      // Ajouter la licence
      licenses.push(newLicense);
      
      // Sauvegarder les licences
      if (!saveLicenses(licenses)) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Erreur lors de la sauvegarde de la licence'
          })
        };
      }
      
      // Renvoyer la licence créée
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          password: plainPassword,
          license: { ...newLicense, plainPassword: undefined }
        })
      };
    } catch (error) {
      console.error("Erreur lors de la création de la licence:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Erreur de serveur: ${error.message || 'Erreur inconnue'}`
        })
      };
    }
  }
  
  // Méthode DELETE - Supprimer une licence
  if (event.httpMethod === 'DELETE') {
    try {
      const id = event.queryStringParameters?.id;
      
      if (!id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'ID de licence requis'
          })
        };
      }
      
      // Charger les licences
      const licenses = loadLicenses();
      
      // Trouver la licence
      const licenseIndex = licenses.findIndex(lic => lic.id === id);
      
      if (licenseIndex === -1) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Licence non trouvée'
          })
        };
      }
      
      // Supprimer la licence
      licenses.splice(licenseIndex, 1);
      
      // Sauvegarder les licences
      if (!saveLicenses(licenses)) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Erreur lors de la suppression de la licence'
          })
        };
      }
      
      // Renvoyer le résultat
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Licence supprimée avec succès'
        })
      };
    } catch (error) {
      console.error("Erreur lors de la suppression de la licence:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Erreur de serveur: ${error.message || 'Erreur inconnue'}`
        })
      };
    }
  }
  
  // Si la méthode n'est pas supportée
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({
      success: false,
      error: 'Méthode non autorisée'
    })
  };
}; 