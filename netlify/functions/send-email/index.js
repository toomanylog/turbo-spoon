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
    connectionTimeout: 120000, // 120 secondes (augmenté)
    greetingTimeout: 120000,   // 120 secondes (augmenté)
    socketTimeout: 240000,    // 240 secondes (augmenté)
    // Pas de mise en pool pour éviter les problèmes
    pool: false,
    // Options TLS très permissives (pas de vérification de certificat)
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1'
    },
    // Accepter différents types de connexions
    ignoreTLS: false, // Changé pour forcer TLS
    opportunisticTLS: true,
    requireTLS: false, // Garde cette option flexible
    // Logs détaillés
    debug: true,
    logger: true
  };
  
  console.log("API - Configuration du transporteur SMTP:", transporterConfig);
  return nodemailer.createTransport(transporterConfig);
}

// Fonction pour tester directement la connectivité SMTP
async function testSmtpConnection(smtpConfig) {
  try {
    console.log("API - Test de connexion SMTP directe...");
    
    // Créer un transporteur minimal pour tester la connexion
    const testTransporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port),
      secure: parseInt(smtpConfig.port) === 465,
      auth: {
        user: smtpConfig.username,
        pass: smtpConfig.password
      },
      connectionTimeout: 10000, // timeout court pour le test
      debug: true,
      tls: {
        rejectUnauthorized: false
      }
    });
    
    // Vérifier la connexion sans envoyer d'email
    const verification = await testTransporter.verify();
    console.log("API - Test de connexion SMTP réussi:", verification);
    return { success: true };
  } catch (error) {
    console.error("API - Échec du test de connexion SMTP:", error.message);
    return { 
      success: false, 
      error: error.message,
      code: error.code || null
    };
  }
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
      
      // Test de connexion avant d'essayer d'envoyer
      const connectionTest = await testSmtpConnection(smtpConfig);
      if (!connectionTest.success) {
        console.log("API - Le test de connexion a échoué, tentative d'envoi quand même");
      } else {
        console.log("API - Le test de connexion a réussi, on continue avec l'envoi");
      }
      
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
      let info;
      try {
        info = await transporter.sendMail(mailOptions);
        console.log("API - Email envoyé avec succès:", info.messageId);
      }
      catch (mailError) {
        console.log("API - Premier échec d'envoi, tentative avec configuration alternative 1");
        
        // Tentative 1: Port 465 avec SSL
        const altConfig1 = {
          ...smtpConfig,
          port: 465, 
          encryption: 'ssl'
        };
        
        const altTransporter1 = createTransporter(altConfig1);
        info = await altTransporter1.sendMail(mailOptions);
        console.log("API - Email envoyé avec succès via port 465/SSL");
      }
      
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
      
      // Essayer d'autres méthodes si les premières ont échoué
      try {
        if (errorDetails.includes("ESOCKET") || errorDetails.includes("ETIMEDOUT") || errorDetails.includes("connect") || errorDetails.includes("ECONNREFUSED")) {
          console.log("API - Tentative avec configuration alternative 2");
          
          // Tentative 2: Port 587 avec STARTTLS
          const altConfig2 = {
            ...smtpConfig,
            port: 587,
            secure: false,
            encryption: 'tls'
          };
          
          // Configuration spécifique avec TLS désactivé
          const altTransporter2Config = {
            host: altConfig2.host,
            port: parseInt(altConfig2.port),
            secure: false,
            auth: {
              user: altConfig2.username,
              pass: altConfig2.password
            },
            connectionTimeout: 120000,
            greetingTimeout: 120000,
            socketTimeout: 240000,
            tls: {
              rejectUnauthorized: false
            },
            ignoreTLS: true,
            requireTLS: false,
            debug: true,
            logger: true
          };
          
          console.log("API - Tentative d'envoi via config alternative 2:", altConfig2.port);
          const altTransporter2 = nodemailer.createTransport(altTransporter2Config);
          const altInfo2 = await altTransporter2.sendMail(mailOptions);
          
          console.log("API - Email envoyé avec succès via méthode alternative 2:", altInfo2.messageId);
          
          if (smtpConfig.rateLimits && smtpConfig.rateLimits.enabled) {
            updateRateLimitCounters();
          }
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: "Email envoyé avec succès (méthode alternative 2)",
              messageId: altInfo2.messageId,
              alternative: true
            })
          };
        }
      } catch (altError2) {
        console.error("API - Échec de la méthode alternative 2:", altError2.message);
        
        try {
          // Tentative 3: Utiliser le port 25 (port SMTP par défaut)
          console.log("API - Tentative avec configuration alternative 3 (port 25)");
          
          const altConfig3 = {
            ...smtpConfig,
            port: 25,
            secure: false
          };
          
          const altTransporter3Config = {
            host: altConfig3.host,
            port: 25,
            secure: false,
            auth: {
              user: altConfig3.username,
              pass: altConfig3.password
            },
            connectionTimeout: 120000,
            greetingTimeout: 120000,
            socketTimeout: 240000,
            tls: {
              rejectUnauthorized: false
            },
            ignoreTLS: true,
            debug: true
          };
          
          console.log("API - Tentative d'envoi via port 25");
          const altTransporter3 = nodemailer.createTransport(altTransporter3Config);
          const altInfo3 = await altTransporter3.sendMail(mailOptions);
          
          console.log("API - Email envoyé avec succès via port 25:", altInfo3.messageId);
          
          if (smtpConfig.rateLimits && smtpConfig.rateLimits.enabled) {
            updateRateLimitCounters();
          }
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: "Email envoyé avec succès (port 25)",
              messageId: altInfo3.messageId,
              alternative: true
            })
          };
        } catch (altError3) {
          console.error("API - Échec de la méthode alternative 3 (port 25):", altError3.message);
          // Continuer vers l'erreur finale
        }
      }
      
      // Si tout échoue, retourner l'erreur originale avec plus de détails
      const connectionTestFinal = await testSmtpConnection(smtpConfig);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Impossible de se connecter au serveur SMTP",
          details: errorDetails,
          serverInfo: {
            host: smtpConfig.host,
            port: smtpConfig.port,
            encryption: smtpConfig.encryption
          },
          connectionTest: connectionTestFinal,
          troubleshooting: "Vérifiez que le serveur SMTP est accessible, que les identifiants sont corrects, et que les ports ne sont pas bloqués par un pare-feu."
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