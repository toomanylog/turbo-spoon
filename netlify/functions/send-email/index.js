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
  // Définir les options SSL/TLS en fonction du paramètre d'encryption
  let secureOption = false;
  if (smtpConfig.encryption === 'ssl') {
    secureOption = true;
  }
  
  // Configuration du transporteur
  const transporterConfig = {
    host: smtpConfig.host,
    port: parseInt(smtpConfig.port),
    secure: secureOption, // true pour 465, false pour les autres ports
    auth: {
      user: smtpConfig.username,
      pass: smtpConfig.password
    }
  };
  
  // Pour TLS explicite (port 587), ajouter des options TLS
  if (smtpConfig.encryption === 'tls') {
    transporterConfig.tls = {
      ciphers: 'SSLv3',
      rejectUnauthorized: false // Désactiver la vérification du certificat (à utiliser avec prudence)
    };
  }
  
  console.log("API - Création du transporteur SMTP:", {
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: secureOption,
    encryption: smtpConfig.encryption
  });
  
  return nodemailer.createTransport(transporterConfig);
}

exports.handler = async (event, context) => {
  // En-têtes CORS pour permettre les requêtes cross-origin
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Gérer les requêtes OPTIONS (pre-flight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
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
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Corps de requête vide' })
      };
    }
    
    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (err) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Format JSON invalide' })
      };
    }
    
    const { 
      smtpConfig, 
      to, 
      cc, 
      bcc, 
      subject, 
      body, 
      htmlBody, 
      useHtml,
      senderName
    } = requestData;

    if (!smtpConfig || !to || !subject) {
      console.log("API - Données manquantes:", { 
        hasSmtpConfig: !!smtpConfig, 
        hasTo: !!to, 
        hasSubject: !!subject 
      });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Configuration SMTP, destinataire et sujet sont requis' 
        })
      };
    }

    // Vérifier les limites de débit si elles sont configurées
    if (smtpConfig.rateLimits && smtpConfig.rateLimits.enabled) {
      // S'assurer que toutes les propriétés sont définies avec des valeurs par défaut
      const safeRateLimits = {
        perSecond: 0,
        perMinute: 0,
        perHour: 0,
        perDay: 0,
        enabled: true,
        ...smtpConfig.rateLimits
      };
      
      // Copier les limites nettoyées dans la configuration
      smtpConfig.rateLimits = safeRateLimits;
      
      const limitCheckResult = checkRateLimits(smtpConfig);
      if (!limitCheckResult.canSend) {
        console.log(`API - Limite d'envoi dépassée: ${limitCheckResult.reason}`);
        return {
          statusCode: 429,
          headers: {
            ...headers,
            'Retry-After': Math.ceil(limitCheckResult.waitTime / 1000)
          },
          body: JSON.stringify({ 
            success: false, 
            error: `Limite d'envoi dépassée: ${limitCheckResult.reason}`,
            retryAfter: limitCheckResult.waitTime
          })
        };
      }
    }

    // Variable pour activer/désactiver la simulation
    // Définir à false pour envoyer réellement des emails
    const SIMULATE_SENDING = process.env.SIMULATE_EMAILS === 'true';
    
    if (SIMULATE_SENDING) {
      console.log("API - SIMULATION D'ENVOI (pas d'envoi réel)");
      
      // Incrémenter les compteurs de limites
      if (smtpConfig.rateLimits && smtpConfig.rateLimits.enabled) {
        updateRateLimitCounters();
      }
      
      // Simuler un délai
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          messageId: `simulated-${Date.now()}`
        })
      };
    } else {
      // Véritable envoi d'email
      console.log("API - Préparation de l'envoi réel d'email");
      
      try {
        // Créer le transporteur SMTP
        const transporter = createTransporter(smtpConfig);
        
        // Préparer l'email
        const mailOptions = {
          from: senderName 
            ? `"${senderName}" <${smtpConfig.username}>`
            : smtpConfig.username,
          to: to,
          subject: subject
        };
        
        // Ajouter CC et BCC si fournis
        if (cc) mailOptions.cc = cc;
        if (bcc) mailOptions.bcc = bcc;
        
        // Ajouter le contenu en fonction du format
        if (useHtml) {
          mailOptions.html = htmlBody;
          // Ajouter une version texte plain pour la compatibilité
          if (body) {
            mailOptions.text = body;
          }
        } else {
          mailOptions.text = body;
        }
        
        console.log("API - Options d'email préparées:", {
          from: mailOptions.from,
          to: mailOptions.to,
          subject: mailOptions.subject,
          hasHtml: !!mailOptions.html,
          hasText: !!mailOptions.text
        });
        
        // Envoyer l'email
        const info = await transporter.sendMail(mailOptions);
        console.log("API - Email envoyé avec succès:", info.messageId);
        
        // Incrémenter les compteurs de limites
        if (smtpConfig.rateLimits && smtpConfig.rateLimits.enabled) {
          updateRateLimitCounters();
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            messageId: info.messageId
          })
        };
      } catch (smtpError) {
        console.error("API - Erreur SMTP lors de l'envoi:", smtpError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: `Erreur SMTP: ${smtpError.message}`,
            details: smtpError.response || null
          })
        };
      }
    }
    
  } catch (error) {
    console.error("API - Erreur lors du traitement de la requête:", error);
    // Assurer que la réponse est toujours un JSON valide, même en cas d'erreur
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message || "Erreur interne du serveur" 
      })
    };
  }
}; 