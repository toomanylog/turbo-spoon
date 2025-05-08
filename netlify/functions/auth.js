const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Constantes pour la sécurité
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'admin123';
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-for-tokens';

// Chemin vers le fichier de stockage des licences
const LICENSES_FILE = path.join(__dirname, '../../data/licenses.json');

// Fonction pour charger les licences
function loadLicenses() {
  try {
    if (fs.existsSync(LICENSES_FILE)) {
      const data = fs.readFileSync(LICENSES_FILE, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error("Erreur lors du chargement des licences:", error);
    return [];
  }
}

// Fonction pour générer un token
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// Fonction pour hacher un mot de passe
function hashPassword(password) {
  return crypto
    .createHash('sha256')
    .update(password + SECRET_KEY)
    .digest('hex');
}

exports.handler = async function(event, context) {
  // En-têtes CORS pour permettre les requêtes cross-origin
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  
  // Vérifier la méthode
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

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
    
    const { password } = data;

    if (!password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Mot de passe requis' })
      };
    }

    // Vérifier si c'est le mot de passe maître
    if (password === MASTER_PASSWORD) {
      // Créer un token valide 24h pour l'administrateur
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 1); // 24h
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          token: generateToken(),
          expiry: expiry.toISOString(),
          isAdmin: true
        })
      };
    }

    // Vérifier les licences
    const licenses = loadLicenses();
    const license = licenses.find(lic => lic.password === hashPassword(password) && new Date(lic.expiry) > new Date());

    if (license) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          token: generateToken(),
          expiry: license.expiry,
          isAdmin: false
        })
      };
    }

    // Si aucune correspondance n'est trouvée
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Mot de passe incorrect ou licence expirée'
      })
    };
  } catch (error) {
    console.error("Erreur d'authentification:", error);
    
    // Toujours renvoyer une réponse JSON valide, même en cas d'erreur
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: `Erreur de serveur: ${error.message || 'Erreur inconnue'}`
      })
    };
  }
}; 