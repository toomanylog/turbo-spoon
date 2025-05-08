import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Constantes pour la sécurité
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'admin123'; // À changer en production et à définir dans .env
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-for-tokens'; // Changer en production

// Chemin vers le fichier de stockage des licences
const LICENSES_FILE = path.join(process.cwd(), 'data', 'licenses.json');

// Vérifier/créer le dossier data si nécessaire
try {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(LICENSES_FILE)) {
    fs.writeFileSync(LICENSES_FILE, JSON.stringify([]));
  }
} catch (err) {
  console.error('Erreur lors de la création du répertoire data:', err);
}

// Fonction pour charger les licences
function loadLicenses() {
  try {
    const data = fs.readFileSync(LICENSES_FILE, 'utf8');
    return JSON.parse(data);
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, error: 'Mot de passe requis' });
    }

    // Vérifier si c'est le mot de passe maître
    if (password === MASTER_PASSWORD) {
      // Créer un token valide 24h pour l'administrateur
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 1); // 24h
      
      return res.status(200).json({
        success: true,
        token: generateToken(),
        expiry: expiry.toISOString(),
        isAdmin: true
      });
    }

    // Vérifier les licences
    const licenses = loadLicenses();
    const license = licenses.find(lic => lic.password === hashPassword(password) && new Date(lic.expiry) > new Date());

    if (license) {
      return res.status(200).json({
        success: true,
        token: generateToken(),
        expiry: license.expiry,
        isAdmin: false
      });
    }

    // Si aucune correspondance n'est trouvée
    return res.status(401).json({
      success: false,
      error: 'Mot de passe incorrect ou licence expirée'
    });
  } catch (error) {
    console.error("Erreur d'authentification:", error);
    return res.status(500).json({
      success: false,
      error: 'Erreur de serveur lors de l\'authentification'
    });
  }
} 