import nodemailer from 'nodemailer';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    console.log("API - Requête d'envoi d'email reçue");
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
    } = req.body;

    if (!smtpConfig || !to || !subject) {
      console.log("API - Données manquantes:", { 
        hasSmtpConfig: !!smtpConfig, 
        hasTo: !!to, 
        hasSubject: !!subject 
      });
      return res.status(400).json({ 
        success: false,
        error: 'Configuration SMTP, destinataire et sujet sont requis' 
      });
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
        return res.status(429).json({ 
          success: false, 
          error: `Limite d'envoi dépassée: ${limitCheckResult.reason}`,
          retryAfter: limitCheckResult.waitTime
        });
      }
    }

    // Pour les tests/démo, simuler un envoi réussi sans réellement envoyer
    // Mode simulation activé
    console.log("API - SIMULATION D'ENVOI (pas d'envoi réel)");
    
    // Incrémenter les compteurs de limites
    if (smtpConfig.rateLimits && smtpConfig.rateLimits.enabled) {
      updateRateLimitCounters();
    }
    
    // Toujours retourner un JSON valide avec un délai simulé
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return res.status(200).json({ 
      success: true, 
      messageId: `simulated-${Date.now()}`
    });
    
  } catch (error) {
    console.error("API - Erreur lors du traitement de la requête:", error);
    // Assurer que la réponse est toujours un JSON valide, même en cas d'erreur
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Erreur interne du serveur" 
    });
  }
} 