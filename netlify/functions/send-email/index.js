const nodemailer = require('nodemailer');

// Stockage des timestamps d'envoi pour les limites de débit
const sendTimestamps = {
  perSecond: [],
  perMinute: [],
  perHour: [],
  perDay: []
};

// Vérifier si les limites de débit permettent un nouvel envoi
function checkRateLimits(smtpConfig) {
  console.log("API - Vérification des limites de débit pour", smtpConfig.username);
  
  if (!smtpConfig.rateLimits || !smtpConfig.rateLimits.enabled) {
    console.log("API - Pas de limites configurées ou désactivées");
    return { canSend: true };
  }
  
  const now = Date.now();
  const oneSecondAgo = now - 1000;
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  
  // Nettoyer les anciennes timestamps
  sendTimestamps.perSecond = sendTimestamps.perSecond.filter(t => t > oneSecondAgo);
  sendTimestamps.perMinute = sendTimestamps.perMinute.filter(t => t > oneMinuteAgo);
  sendTimestamps.perHour = sendTimestamps.perHour.filter(t => t > oneHourAgo);
  sendTimestamps.perDay = sendTimestamps.perDay.filter(t => t > oneDayAgo);
  
  console.log("API - Compteurs actuels:", {
    perSecond: sendTimestamps.perSecond.length,
    perMinute: sendTimestamps.perMinute.length,
    perHour: sendTimestamps.perHour.length,
    perDay: sendTimestamps.perDay.length
  });
  
  // Vérifier les limites
  const limits = smtpConfig.rateLimits;
  let canSend = true;
  let waitTime = 0;
  let reason = "";
  
  // Vérifier limite par seconde
  if (limits.perSecond > 0 && sendTimestamps.perSecond.length >= limits.perSecond) {
    const oldestInSecond = sendTimestamps.perSecond[0];
    const waitForSecond = Math.max(0, 1000 - (now - oldestInSecond));
    if (waitForSecond > 0) {
      canSend = false;
      waitTime = Math.max(waitTime, waitForSecond);
      reason = `Limite de ${limits.perSecond} emails/seconde atteinte`;
      console.log("API - Limite par seconde atteinte");
    }
  }
  
  // Vérifier limite par minute
  if (limits.perMinute > 0 && sendTimestamps.perMinute.length >= limits.perMinute) {
    const oldestInMinute = sendTimestamps.perMinute[0];
    const waitForMinute = Math.max(0, 60 * 1000 - (now - oldestInMinute));
    if (waitForMinute > 0) {
      canSend = false;
      waitTime = Math.max(waitTime, waitForMinute);
      reason = `Limite de ${limits.perMinute} emails/minute atteinte`;
      console.log("API - Limite par minute atteinte");
    }
  }
  
  // Vérifier limite par heure
  if (limits.perHour > 0 && sendTimestamps.perHour.length >= limits.perHour) {
    const oldestInHour = sendTimestamps.perHour[0];
    const waitForHour = Math.max(0, 60 * 60 * 1000 - (now - oldestInHour));
    if (waitForHour > 0) {
      canSend = false;
      waitTime = Math.max(waitTime, waitForHour);
      reason = `Limite de ${limits.perHour} emails/heure atteinte`;
      console.log("API - Limite par heure atteinte");
    }
  }
  
  // Vérifier limite par jour
  if (limits.perDay > 0 && sendTimestamps.perDay.length >= limits.perDay) {
    const oldestInDay = sendTimestamps.perDay[0];
    const waitForDay = Math.max(0, 24 * 60 * 60 * 1000 - (now - oldestInDay));
    if (waitForDay > 0) {
      canSend = false;
      waitTime = Math.max(waitTime, waitForDay);
      reason = `Limite de ${limits.perDay} emails/jour atteinte`;
      console.log("API - Limite par jour atteinte");
    }
  }
  
  console.log("API - Résultat vérification:", { canSend, reason, waitTime });
  return { canSend, waitTime, reason };
}

// Mettre à jour les compteurs après un envoi réussi
function updateRateLimitCounters() {
  const now = Date.now();
  sendTimestamps.perSecond.push(now);
  sendTimestamps.perMinute.push(now);
  sendTimestamps.perHour.push(now);
  sendTimestamps.perDay.push(now);
  console.log("API - Compteurs mis à jour après envoi");
}

// Créer un transporteur SMTP avec Nodemailer
function createTransporter(smtpConfig) {
  console.log("API - Configuration SMTP reçue:", {
    host: smtpConfig.host,
    port: smtpConfig.port,
    encryption: smtpConfig.encryption,
    username: smtpConfig.username
  });
  
  // Définir les options SSL/TLS en fonction du paramètre d'encryption
  let secureOption = false;
  if (smtpConfig.encryption === 'ssl' || parseInt(smtpConfig.port) === 465) {
    secureOption = true;
  }
  
  // Configuration du transporteur avec des options très permissives
  const transporterConfig = {
    host: smtpConfig.host,
    port: parseInt(smtpConfig.port),
    secure: secureOption,
    auth: {
      user: smtpConfig.username,
      pass: smtpConfig.password
    },
    // Timeouts très longs
    connectionTimeout: 60000, // 60 secondes
    greetingTimeout: 60000,   // 60 secondes
    socketTimeout: 120000,    // 120 secondes
    // Pas de mise en pool pour éviter les problèmes
    pool: false,
    // Options TLS permissives
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1'
    },
    // Accepter différents types de connexions
    ignoreTLS: true,
    opportunisticTLS: true,
    requireTLS: false,
    // Logs détaillés
    debug: true,
    logger: true
  };
  
  console.log("API - Configuration du transporteur SMTP:", transporterConfig);
  return nodemailer.createTransport(transporterConfig);
}

exports.handler = async (event, context) => {
  // En-têtes CORS pour les requêtes cross-origin
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Gérer les requêtes OPTIONS (pre-flight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    console.log("API - Requête d'envoi d'email reçue");
    
    // Vérifier et parser le corps de la requête
    if (!event.body) {
      console.log("API - Erreur: Corps de requête vide");
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Corps de requête vide' })
      };
    }
    
    let requestData;
    try {
      requestData = JSON.parse(event.body);
      console.log("API - Données reçues:", {
        to: requestData.to,
        subject: requestData.subject,
        smtpConfig: requestData.smtpConfig ? {
          host: requestData.smtpConfig.host,
          port: requestData.smtpConfig.port,
          username: requestData.smtpConfig.username
        } : null
      });
    } catch (err) {
      console.log("API - Erreur de parsing JSON:", err.message);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Format JSON invalide',
          details: err.message
        })
      };
    }
    
    const { smtpConfig, to, cc, bcc, subject, body, htmlBody, useHtml, senderName, testMode } = requestData;

    // Validation des données
    if (!smtpConfig) {
      console.log("API - Erreur: Configuration SMTP manquante");
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Configuration SMTP requise' })
      };
    }
    
    if (!to) {
      console.log("API - Erreur: Destinataire manquant");
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Destinataire requis' })
      };
    }
    
    if (!subject) {
      console.log("API - Erreur: Sujet manquant");
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Sujet requis' })
      };
    }
    
    // Vérifier que les champs essentiels de smtpConfig sont présents
    if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.username || !smtpConfig.password) {
      console.log("API - Erreur: Champs SMTP incomplets:", {
        hasHost: !!smtpConfig.host,
        hasPort: !!smtpConfig.port,
        hasUsername: !!smtpConfig.username,
        hasPassword: !!smtpConfig.password
      });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Configuration SMTP incomplète (host, port, username, password requis)'
        })
      };
    }

    // Vérifier les limites de débit
    if (smtpConfig.rateLimits && smtpConfig.rateLimits.enabled) {
      const safeRateLimits = {
        perSecond: 0,
        perMinute: 0,
        perHour: 0,
        perDay: 0,
        enabled: true,
        ...smtpConfig.rateLimits
      };
      
      smtpConfig.rateLimits = safeRateLimits;
      
      const limitCheck = checkRateLimits(smtpConfig);
      
      if (!limitCheck.canSend) {
        console.log(`API - Limite de débit atteinte: ${limitCheck.reason}, attente: ${limitCheck.waitTime}ms`);
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({
            success: false,
            error: limitCheck.reason,
            retryAfter: limitCheck.waitTime
          })
        };
      }
    }
    
    // Mode test - simuler un envoi sans réellement l'effectuer
    if (testMode === true) {
      console.log("API - Mode TEST activé - L'email ne sera pas réellement envoyé");
      await new Promise(resolve => setTimeout(resolve, 1000));
      const fakeMessageId = `test-${Date.now()}@simulated.mail`;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          testMode: true,
          message: "Email simulé avec succès",
          messageId: fakeMessageId
        })
      };
    }
    
    // Mode envoi réel
    try {
      console.log("API - Tentative d'envoi réel en cours...");
      
      // Créer le transporteur avec des options permissives
      const transporter = createTransporter(smtpConfig);
      
      // Préparer les options d'email
      const mailOptions = {
        from: senderName ? `"${senderName}" <${smtpConfig.username}>` : smtpConfig.username,
        to: to,
        subject: subject,
        // Options supplémentaires
        headers: {
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'Importance': 'Normal',
        },
        disableFileAccess: true,
        disableUrlAccess: true
      };
      
      // Ajouter CC et BCC s'ils sont présents
      if (cc) mailOptions.cc = cc;
      if (bcc) mailOptions.bcc = bcc;
      
      // Configurer le corps du message selon le format
      if (useHtml) {
        mailOptions.html = htmlBody;
        // Version texte alternative
        mailOptions.text = body || htmlBody.replace(/<[^>]*>/g, '');
      } else {
        mailOptions.text = body;
      }
      
      console.log("API - Envoi de l'email:", {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        hasHTML: !!mailOptions.html,
        hasText: !!mailOptions.text
      });
      
      // Essayer d'envoyer l'email sans vérification préalable
      const info = await transporter.sendMail(mailOptions);
      
      console.log("API - Email envoyé avec succès:", info.messageId);
      
      // Mettre à jour les compteurs de limite de débit
      if (smtpConfig.rateLimits && smtpConfig.rateLimits.enabled) {
        updateRateLimitCounters();
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: "Email envoyé avec succès",
          messageId: info.messageId,
          response: info.response
        })
      };
    } catch (mailError) {
      console.error("API - Erreur lors de l'envoi de l'email:", mailError);
      
      // Message d'erreur détaillé
      let errorDetails = mailError.message || "Erreur inconnue";
      if (mailError.code) {
        errorDetails += ` (Code: ${mailError.code})`;
      }
      
      // Essayer une autre méthode si la première a échoué
      try {
        if (errorDetails.includes("ESOCKET") || errorDetails.includes("ETIMEDOUT") || errorDetails.includes("connect")) {
          console.log("API - Tentative de connexion alternative...");
          
          // Configurer un transporteur alternatif avec des options différentes
          const altConfig = {
            ...smtpConfig,
            port: smtpConfig.encryption === 'ssl' ? 465 : 587, // Tenter l'autre port standard
          };
          
          const altTransporter = createTransporter(altConfig);
          
          // Envoyer l'email avec le transporteur alternatif
          console.log("API - Tentative d'envoi via port alternatif:", altConfig.port);
          const altInfo = await altTransporter.sendMail(mailOptions);
          
          console.log("API - Email envoyé avec succès via méthode alternative:", altInfo.messageId);
          
          if (smtpConfig.rateLimits && smtpConfig.rateLimits.enabled) {
            updateRateLimitCounters();
          }
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: "Email envoyé avec succès (méthode alternative)",
              messageId: altInfo.messageId,
              alternative: true
            })
          };
        }
      } catch (altError) {
        console.error("API - Échec de la méthode alternative:", altError.message);
      }
      
      // Si tout échoue, retourner l'erreur originale
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Impossible de se connecter au serveur SMTP",
          details: errorDetails
        })
      };
    }
  } catch (error) {
    console.error("API - Erreur globale:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Une erreur interne est survenue",
        details: error.message
      })
    };
  }
};