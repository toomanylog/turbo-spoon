# Email Sender Pro

Une application web de gestion d'envoi d'emails en masse, avec suivi des campagnes, gestion des limites SMTP et système de licences.

## Fonctionnalités

- Interface utilisateur intuitive pour la création et l'envoi d'emails
- Envoi d'emails en masse avec personnalisation des contenus
- Gestion des limites d'envoi SMTP (par seconde, minute, heure, jour)
- Mise en pause et reprise des campagnes d'envoi
- Historique des campagnes avec statuts détaillés
- Système d'authentification avec mots de passe temporaires
- Panneau d'administration pour la gestion des licences clients

## Prérequis

- Node.js 14+ et npm
- Un serveur SMTP pour l'envoi d'emails (en production)

## Installation

1. Cloner le dépôt
```bash
git clone https://github.com/votre-nom/web-sender.git
cd web-sender
```

2. Installer les dépendances
```bash
npm install
```

3. Créer un fichier `.env.local` à la racine du projet (ou copier le modèle)
```bash
cp .env.example .env.local
```

4. Modifier les variables d'environnement dans `.env.local`
```bash
MASTER_PASSWORD=votre_mot_de_passe_administrateur
SECRET_KEY=votre_clé_secrète_pour_les_tokens
```

5. Lancer le serveur de développement
```bash
npm run dev
```

## Déploiement sur Netlify

### Prérequis
- Un compte Netlify
- Un dépôt GitHub contenant votre projet

### Étapes

1. Dans Netlify, cliquez sur "New site from Git"
2. Sélectionnez GitHub comme fournisseur Git
3. Sélectionnez votre dépôt web-sender
4. Configurez les paramètres de build:
   - Build command: `npm run build`
   - Publish directory: `out`
5. Ajoutez les variables d'environnement dans les paramètres du site:
   - `MASTER_PASSWORD`
   - `SECRET_KEY`
6. Cliquez sur "Deploy site"

## Dépannage

### Erreurs d'authentification

Si vous rencontrez l'erreur `SyntaxError: JSON.parse: unexpected character at line 1 column 1 of the JSON data`, vérifiez les points suivants:

1. **Redirection API incorrecte**: Assurez-vous que le fichier `netlify.toml` contient bien les redirections suivantes:
   ```
   [[redirects]]
     from = "/api/*"
     to = "/.netlify/functions/:splat"
     status = 200
   ```

2. **En-têtes CORS manquants**: Vérifiez que vos fonctions Netlify renvoient bien les en-têtes CORS appropriés:
   ```javascript
   const headers = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Headers': 'Content-Type',
     'Content-Type': 'application/json'
   };
   ```

3. **Problème de format JSON**: Si le serveur ne renvoie pas du JSON valide, vérifiez le format de vos réponses API.

4. **Erreur dans les fonctions serverless**: Consultez les logs de Netlify pour identifier des erreurs potentielles.

### Problèmes de licences

Si les licences ne sont pas sauvegardées correctement:

1. Vérifiez les permissions du dossier `data` dans les fonctions Netlify
2. Assurez-vous que le chemin vers `licenses.json` est correct dans les fonctions
3. Vérifiez que le dossier `data` est bien créé lors du premier déploiement

### Erreurs de déploiement sur Netlify

1. **Erreur de build**: Vérifiez votre commande de build et que toutes les dépendances sont installées
2. **Problèmes avec les fonctions serverless**: Assurez-vous que le dossier `netlify/functions` est correctement configuré
3. **Variables d'environnement manquantes**: Vérifiez que toutes les variables nécessaires sont définies dans les paramètres du site Netlify

## Guide d'utilisation

### Accès administrateur

1. Accédez à l'application et connectez-vous avec le mot de passe administrateur
2. Cliquez sur "Panneau Admin" pour accéder à la gestion des licences
3. Créez des licences pour vos clients avec différentes durées de validité

### Envoi d'emails

1. Connectez-vous avec votre mot de passe (admin ou client)
2. Configurez votre serveur SMTP dans les paramètres
3. Créez une nouvelle campagne d'email:
   - Ajoutez les destinataires
   - Créez le contenu de l'email (texte ou HTML)
   - Personnalisez avec des variables (ex: {nom}, {email})
4. Lancez la campagne d'envoi
5. Suivez la progression et les statistiques en temps réel
6. Consultez l'historique pour voir les campagnes précédentes

## Sécurité

- Les mots de passe sont hashés avant stockage
- Les tokens d'authentification expirent automatiquement
- Les licences ont une durée de validité limitée
- Les configurations SMTP sont sécurisées

## Licence

Ce projet est sous licence privée.

## Support

Pour toute question ou assistance, veuillez contacter l'administrateur. 