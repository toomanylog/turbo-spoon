import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Constantes pour la sécurité
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'admin123'; // À changer en production
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

// Fonction pour sauvegarder les licences
function saveLicenses(licenses) {
  try {
    fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2));
    return true;
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des licences:", error);
    return false;
  }
}

// Vérifier l'authentification admin
function verifyAdmin(req) {
  try {
    const auth = req.headers.authorization;
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

export default async function handler(req, res) {
  // Vérification de l'authentification pour toutes les méthodes sauf GET sans ID
  if (!(req.method === 'GET' && !req.query.id)) {
    // Simuler la vérification d'authentification (à remplacer par une véritable vérification)
    const isAuthenticated = verifyAdmin(req);
    
    if (!isAuthenticated) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentification requise' 
      });
    }
  }
  
  // Méthode GET - Récupérer les licences
  if (req.method === 'GET') {
    try {
      const licenses = loadLicenses();
      
      // Si on demande une licence spécifique
      if (req.query.id) {
        const license = licenses.find(lic => lic.id === req.query.id);
        if (!license) {
          return res.status(404).json({
            success: false,
            error: 'Licence non trouvée'
          });
        }
        
        return res.status(200).json({
          success: true,
          license
        });
      }
      
      // Sinon, renvoyer toutes les licences
      return res.status(200).json({
        success: true,
        licenses
      });
    } catch (error) {
      console.error("Erreur lors de la récupération des licences:", error);
      return res.status(500).json({
        success: false,
        error: 'Erreur de serveur lors de la récupération des licences'
      });
    }
  }
  
  // Méthode POST - Créer une licence
  if (req.method === 'POST') {
    try {
      const { name, days } = req.body;
      
      if (!name || !days) {
        return res.status(400).json({
          success: false,
          error: 'Nom du client et durée de validité requis'
        });
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
        return res.status(500).json({
          success: false,
          error: 'Erreur lors de la sauvegarde de la licence'
        });
      }
      
      // Renvoyer la licence créée
      return res.status(201).json({
        success: true,
        password: plainPassword,
        license: { ...newLicense, plainPassword: undefined }
      });
    } catch (error) {
      console.error("Erreur lors de la création de la licence:", error);
      return res.status(500).json({
        success: false,
        error: 'Erreur de serveur lors de la création de la licence'
      });
    }
  }
  
  // Méthode DELETE - Supprimer une licence
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID de licence requis'
        });
      }
      
      // Charger les licences
      const licenses = loadLicenses();
      
      // Trouver la licence
      const licenseIndex = licenses.findIndex(lic => lic.id === id);
      
      if (licenseIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Licence non trouvée'
        });
      }
      
      // Supprimer la licence
      licenses.splice(licenseIndex, 1);
      
      // Sauvegarder les licences
      if (!saveLicenses(licenses)) {
        return res.status(500).json({
          success: false,
          error: 'Erreur lors de la suppression de la licence'
        });
      }
      
      // Renvoyer le résultat
      return res.status(200).json({
        success: true,
        message: 'Licence supprimée avec succès'
      });
    } catch (error) {
      console.error("Erreur lors de la suppression de la licence:", error);
      return res.status(500).json({
        success: false,
        error: 'Erreur de serveur lors de la suppression de la licence'
      });
    }
  }
  
  // Méthode non supportée
  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
} 