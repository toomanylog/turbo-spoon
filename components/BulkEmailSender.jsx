import React, { useState, useEffect, useRef } from 'react';
import { Send, Settings, AlertTriangle, Check, RefreshCw, Info, FilePlus, Users, ChevronDown, ChevronUp, Trash, Pause, Play, Clock, Save, X, CheckCircle } from 'lucide-react';
import CsvImporter from './CsvImporter';
import { parseTemplate, parseHtmlTemplate, extractTemplateVariables } from '../utils/templateParser';

const BulkEmailSender = ({ onClose, smtpConfig, initialEmailData }) => {
  const [step, setStep] = useState(1); // 1: importer, 2: configurer, 3: aperçu, 4: envoi
  const [emailData, setEmailData] = useState({
    subject: initialEmailData?.subject || '',
    body: initialEmailData?.body || '',
    htmlBody: initialEmailData?.htmlBody || '',
    useHtml: initialEmailData?.useHtml || false
  });
  const [recipients, setRecipients] = useState([]);
  const [foundVariables, setFoundVariables] = useState([]);
  const [previewRecipient, setPreviewRecipient] = useState(null);
  const [lastSendTimeRef, setLastSendTimeRef] = useState(0);
  const [sendingStatus, setSendingStatus] = useState({
    inProgress: false,
    isPaused: false,
    success: 0,
    failed: 0,
    total: 0,
    currentIndex: 0,
    errors: [],
    currentStatus: "",
    startTime: null,
    pauseTime: null,
    totalPauseDuration: 0,
    id: null // Identifiant unique pour cet envoi
  });
  const [bulkSettings, setBulkSettings] = useState({
    batchSize: 10,
    delayBetweenBatches: 5,
    sendingMode: 'all', // 'all' ou 'batch'
    testMode: false     // Toujours désactivé par défaut
  });
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  
  // Nouvel état pour l'historique des envois
  const [sendHistory, setSendHistory] = useState([]);
  
  // Référence pour le contrôle de l'annulation
  const cancelSendingRef = useRef(false);
  const batchTimeoutRef = useRef(null);
  
  // Référence pour stocker les timestamps des derniers envois
  const sentTimestampsRef = useRef({
    perSecond: [],
    perMinute: [],
    perHour: [],
    perDay: []
  });
  
  // Fonction pour vérifier les limites de débit avant d'envoyer un email
  const checkLimitsBeforeSend = () => {
    // Log de débogage pour voir si cette fonction est appelée
    console.log("Vérification des limites SMTP avant envoi", smtpConfig);
    
    if (!smtpConfig.rateLimits || !smtpConfig.rateLimits.enabled) {
      console.log("Pas de limites SMTP configurées ou désactivées");
      return { canSend: true };
    }
    
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    // Nettoyer les anciennes timestamps
    sentTimestampsRef.current.perSecond = sentTimestampsRef.current.perSecond.filter(t => t > oneSecondAgo);
    sentTimestampsRef.current.perMinute = sentTimestampsRef.current.perMinute.filter(t => t > oneMinuteAgo);
    sentTimestampsRef.current.perHour = sentTimestampsRef.current.perHour.filter(t => t > oneHourAgo);
    sentTimestampsRef.current.perDay = sentTimestampsRef.current.perDay.filter(t => t > oneDayAgo);
    
    // Vérifier les limites
    const limits = smtpConfig.rateLimits;
    let canSend = true;
    let waitTime = 0;
    let reason = "";
    
    // Log des compteurs actuels
    console.log("Compteurs actuels:", {
      perSecond: sentTimestampsRef.current.perSecond.length,
      perMinute: sentTimestampsRef.current.perMinute.length,
      perHour: sentTimestampsRef.current.perHour.length,
      perDay: sentTimestampsRef.current.perDay.length
    });
    console.log("Limites configurées:", limits);
    
    // Vérifier limite par seconde
    if (limits.perSecond > 0 && sentTimestampsRef.current.perSecond.length >= limits.perSecond) {
      const oldestInSecond = sentTimestampsRef.current.perSecond[0];
      const waitForSecond = Math.max(0, 1000 - (now - oldestInSecond));
      if (waitForSecond > 0) {
        canSend = false;
        waitTime = Math.max(waitTime, waitForSecond);
        reason = `Limite de ${limits.perSecond} emails/seconde atteinte`;
        console.log("Limite par seconde atteinte:", { waitForSecond });
      }
    }
    
    // Vérifier limite par minute
    if (limits.perMinute > 0 && sentTimestampsRef.current.perMinute.length >= limits.perMinute) {
      const oldestInMinute = sentTimestampsRef.current.perMinute[0];
      const waitForMinute = Math.max(0, 60 * 1000 - (now - oldestInMinute));
      if (waitForMinute > 0) {
        canSend = false;
        waitTime = Math.max(waitTime, waitForMinute);
        reason = `Limite de ${limits.perMinute} emails/minute atteinte`;
        console.log("Limite par minute atteinte:", { waitForMinute });
      }
    }
    
    // Vérifier limite par heure
    if (limits.perHour > 0 && sentTimestampsRef.current.perHour.length >= limits.perHour) {
      const oldestInHour = sentTimestampsRef.current.perHour[0];
      const waitForHour = Math.max(0, 60 * 60 * 1000 - (now - oldestInHour));
      if (waitForHour > 0) {
        canSend = false;
        waitTime = Math.max(waitTime, waitForHour);
        reason = `Limite de ${limits.perHour} emails/heure atteinte`;
        console.log("Limite par heure atteinte:", { waitForHour });
      }
    }
    
    // Vérifier limite par jour
    if (limits.perDay > 0 && sentTimestampsRef.current.perDay.length >= limits.perDay) {
      const oldestInDay = sentTimestampsRef.current.perDay[0];
      const waitForDay = Math.max(0, 24 * 60 * 60 * 1000 - (now - oldestInDay));
      if (waitForDay > 0) {
        canSend = false;
        waitTime = Math.max(waitTime, waitForDay);
        reason = `Limite de ${limits.perDay} emails/jour atteinte`;
        console.log("Limite par jour atteinte:", { waitForDay });
      }
    }
    
    console.log("Résultat de la vérification:", { canSend, waitTime, reason });
    return { canSend, waitTime, reason };
  };
  
  // Fonction pour enregistrer un envoi réussi dans les compteurs de limites
  const recordSuccessfulSend = () => {
    const now = Date.now();
    sentTimestampsRef.current.perSecond.push(now);
    sentTimestampsRef.current.perMinute.push(now);
    sentTimestampsRef.current.perHour.push(now);
    sentTimestampsRef.current.perDay.push(now);
  };
  
  // Charger l'historique des envois au démarrage
  useEffect(() => {
    const savedHistory = localStorage.getItem('bulkSendHistory');
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        setSendHistory(parsedHistory);
      } catch (e) {
        console.error("Erreur lors du chargement de l'historique d'envoi", e);
      }
    }
  }, []);
  
  // Sauvegarder l'historique des envois lors des changements
  useEffect(() => {
    if (sendHistory.length > 0) {
      localStorage.setItem('bulkSendHistory', JSON.stringify(sendHistory));
    }
  }, [sendHistory]);
  
  // Ajouter les nouvelles fonctions pour gérer l'historique des campagnes
  const deleteCampaignFromHistory = (campaignId) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette campagne de l'historique ?")) {
      console.log("Suppression de la campagne:", campaignId);
      setSendHistory(prev => prev.filter(item => item.id !== campaignId));
    }
  };
  
  const clearAllHistory = () => {
    if (confirm("Êtes-vous sûr de vouloir supprimer tout l'historique des campagnes ?")) {
      console.log("Suppression de tout l'historique");
      setSendHistory([]);
      localStorage.removeItem('bulkSendHistory');
    }
  };
  
  // Fonction pour mettre en pause l'envoi - Version améliorée
  const pauseSending = () => {
    if (sendingStatus.inProgress && !sendingStatus.isPaused) {
      console.log("Mise en pause de l'envoi");
      
      // Définir le flag d'annulation pour les lots en cours
      cancelSendingRef.current = true;
      
      // Annuler tout timeout en cours pour les lots
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
      
      // Capturer l'index courant pour la reprise
      const currentIndex = sendingStatus.currentIndex;
      console.log("Sauvegarde de l'index actuel pour la reprise:", currentIndex);
      
      setSendingStatus(prev => {
        const pausedStatus = {
          ...prev,
          isPaused: true,
          pauseTime: Date.now(),
          currentStatus: "Envoi en pause",
          // S'assurer que l'index est bien conservé
          currentIndex: currentIndex
        };
        
        // Sauvegarder immédiatement l'état en pause
        setTimeout(() => {
          console.log("Sauvegarde de l'état pausé:", pausedStatus);
          saveCurrentSendStateToHistory(false);
        }, 100);
        
        return pausedStatus;
      });
    }
  };
  
  // Fonction pour reprendre l'envoi - Correction
  const resumeSending = () => {
    if (sendingStatus.isPaused) {
      const pauseDuration = Date.now() - (sendingStatus.pauseTime || Date.now());
      console.log("Calcul de la durée de pause:", pauseDuration, "ms");
      
      // Capture l'index actuel avant de mettre à jour l'état
      const currentIndex = sendingStatus.currentIndex;
      console.log("Index actuel avant reprise:", currentIndex);
      
      setSendingStatus(prev => ({
        ...prev,
        isPaused: false,
        pauseTime: null,
        totalPauseDuration: prev.totalPauseDuration + pauseDuration,
        currentStatus: "Reprise de l'envoi..."
      }));
      
      // Utilise setTimeout pour laisser le temps à l'état d'être mis à jour
      setTimeout(() => {
        // Reprendre l'envoi à partir de l'index capturé
        console.log("Reprise effective à partir de l'index:", currentIndex);
        startBulkSend(currentIndex);
      }, 100);
    }
  };
  
  // Fonction pour redémarrer un envoi depuis le début
  const restartSending = () => {
    if (confirm("Voulez-vous vraiment redémarrer cette campagne depuis le début?")) {
      console.log("Redémarrage de la campagne depuis le début");
      
      // Réinitialiser les compteurs mais garder l'ID
      setSendingStatus(prev => ({
        ...prev,
        inProgress: false,
        isPaused: false,
        success: 0,
        failed: 0,
        currentIndex: 0,
        errors: [],
        currentStatus: "Prêt à démarrer",
        pauseTime: null,
        totalPauseDuration: 0
      }));
      
      // Commencer l'envoi depuis l'index 0 (explicitement un nombre)
      setTimeout(() => startBulkSend(0), 100);
    }
  };
  
  // Fonction pour annuler l'envoi
  const cancelSending = () => {
    if (sendingStatus.inProgress) {
      cancelSendingRef.current = true;
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      
      setSendingStatus(prev => ({
        ...prev,
        inProgress: false,
        isPaused: false,
        currentStatus: "Envoi annulé"
      }));
      
      // Sauvegarder l'état final dans l'historique
      saveCurrentSendStateToHistory(true);
    }
  };
  
  // Fonction pour sauvegarder l'état actuel dans l'historique
  const saveCurrentSendStateToHistory = (isComplete = false) => {
    console.log("Sauvegarde de l'état dans l'historique:", { isComplete });
    console.log("État actuel:", { 
      success: sendingStatus.success, 
      failed: sendingStatus.failed, 
      total: sendingStatus.total 
    });
    
    // Ne pas marquer comme terminé si aucun email n'a été envoyé avec succès
    if (isComplete && sendingStatus.success === 0 && sendingStatus.total > 0) {
      console.log("Aucun email envoyé avec succès, ne pas marquer comme terminé");
      console.log("État de sendingStatus:", JSON.stringify(sendingStatus));
      isComplete = false;
    }
    
    const now = Date.now();
    const sendId = sendingStatus.id || `send-${now}`;
    
    const sendState = {
      id: sendId,
      emailData,
      recipients,
      sendingStatus: {
        ...sendingStatus,
        id: sendId,
        inProgress: !isComplete && sendingStatus.inProgress,
        isPaused: !isComplete && sendingStatus.isPaused,
        lastUpdated: now,
        isComplete
      },
      bulkSettings,
      smtpConfig: {
        name: smtpConfig.name,
        host: smtpConfig.host,
        port: smtpConfig.port,
        username: smtpConfig.username,
        rateLimits: smtpConfig.rateLimits
      }
    };
    
    console.log("État à sauvegarder:", {
      id: sendId,
      isComplete,
      inProgress: !isComplete && sendingStatus.inProgress,
      isPaused: !isComplete && sendingStatus.isPaused
    });
    
    // Mettre à jour l'historique
    setSendHistory(prev => {
      // Rechercher si cet envoi existe déjà dans l'historique
      const existingIndex = prev.findIndex(item => item.id === sendId);
      
      if (existingIndex >= 0) {
        // Mettre à jour l'entrée existante
        const updatedHistory = [...prev];
        updatedHistory[existingIndex] = sendState;
        console.log("Mise à jour d'une entrée existante dans l'historique");
        return updatedHistory;
      } else {
        // Ajouter une nouvelle entrée (au début)
        console.log("Ajout d'une nouvelle entrée dans l'historique");
        return [sendState, ...prev].slice(0, 20); // Limiter à 20 entrées
      }
    });
  };
  
  // Fonction pour charger un envoi depuis l'historique
  const loadSendFromHistory = (historyItem) => {
    if (sendingStatus.inProgress && !sendingStatus.isPaused) {
      if (!confirm("Un envoi est actuellement en cours. Voulez-vous l'annuler et charger l'envoi sélectionné ?")) {
        return;
      }
      cancelSending();
    }
    
    console.log("Chargement d'un envoi depuis l'historique:", historyItem);
    
    // Charger les données de l'envoi
    setEmailData(historyItem.emailData);
    setRecipients(historyItem.recipients);
    if (historyItem.recipients.length > 0) {
      setPreviewRecipient(historyItem.recipients[0]);
    }
    setBulkSettings(historyItem.bulkSettings);
    
    // Charger le statut d'envoi et permettre la reprise
    const loadedStatus = {
      ...historyItem.sendingStatus,
      // Garder l'état en pause si c'était en pause
      isPaused: historyItem.sendingStatus.isPaused,
      // Si c'est complet, ne pas le marquer comme en cours
      inProgress: historyItem.sendingStatus.isComplete ? false : historyItem.sendingStatus.inProgress
    };
    
    console.log("Statut chargé:", loadedStatus);
    setSendingStatus(loadedStatus);
    
    // Aller à l'étape d'envoi
    setStep(4);
    
    // Si l'envoi était en pause, permettre de le reprendre à partir de l'index actuel
    if (historyItem.sendingStatus.isPaused) {
      console.log("Chargement d'un envoi en pause, prêt à reprendre depuis l'index:", historyItem.sendingStatus.currentIndex);
      
      // Réinitialiser les timestamps de limite d'envoi pour éviter de bloquer la reprise
      sentTimestampsRef.current = {
        perSecond: [],
        perMinute: [],
        perHour: [],
        perDay: []
      };
      
      // Option: reprendre automatiquement la campagne
      if (confirm("Voulez-vous reprendre immédiatement cette campagne en pause?")) {
        // Utiliser setTimeout pour s'assurer que l'état est bien mis à jour
        setTimeout(() => resumeSending(), 200);
      }
    }
  };

  // Extraire les variables du contenu quand il change
  useEffect(() => {
    const contentToCheck = emailData.useHtml ? emailData.htmlBody : emailData.body;
    const variables = extractTemplateVariables(contentToCheck);
    // Ajouter les variables du sujet aussi
    const subjectVariables = extractTemplateVariables(emailData.subject);
    const allVariables = [...new Set([...variables, ...subjectVariables])];
    setFoundVariables(allVariables);
  }, [emailData.subject, emailData.body, emailData.htmlBody, emailData.useHtml]);

  // Gérer l'import des destinataires depuis le CSV
  const handleImportComplete = (importedRecipients) => {
    setRecipients(importedRecipients);
    setPreviewRecipient(importedRecipients[0] || null);
    
    // Réinitialiser le statut d'envoi pour un nouvel envoi
    setSendingStatus({
      inProgress: false,
      isPaused: false,
      success: 0,
      failed: 0,
      total: importedRecipients.length,
      currentIndex: 0,
      errors: [],
      currentStatus: "",
      startTime: null,
      pauseTime: null,
      totalPauseDuration: 0,
      id: null
    });
    
    setStep(2);
  };

  // Fonction pour analyser et valider le contenu HTML
  const validateHtmlContent = () => {
    if (!emailData.useHtml || !emailData.htmlBody) return [];
    
    const warnings = [];
    const html = emailData.htmlBody;
    
    // Vérifier les balises non fermées (algorithme simplifié)
    const openTags = html.match(/<[a-z][a-z0-9]*(?=\s|>)[^>]*>/gi) || [];
    const closeTags = html.match(/<\/[a-z][a-z0-9]*>/gi) || [];
    if (openTags.length - closeTags.length > 5) { // Tolérance pour certaines balises auto-fermantes
      warnings.push("Certaines balises HTML semblent ne pas être fermées correctement.");
    }
    
    // Vérifier les styles inline complexes qui peuvent causer des problèmes
    if (html.includes("!important") && html.match(/style="[^"]*!important/g)) {
      warnings.push("Les styles avec '!important' peuvent causer des problèmes de rendu dans certains clients email.");
    }
    
    // Vérifier les attributs de balises style problématiques
    if (html.match(/<[^>]*style=('|")[^'"]*(\${|{{)[^'"]*('|")/g)) {
      warnings.push("Variables dans les attributs style détectées. Cela peut causer des problèmes de rendu.");
    }
    
    // Vérifier la taille du HTML
    if (html.length > 100000) {
      warnings.push("Le contenu HTML est très volumineux (plus de 100KB), ce qui peut causer des problèmes d'envoi.");
    }
    
    return warnings;
  };

  // Passer à l'étape d'aperçu
  const goToPreview = () => {
    if (!emailData.subject) {
      setError("Veuillez spécifier un sujet pour votre email.");
      return;
    }
    
    if (emailData.useHtml && !emailData.htmlBody) {
      setError("Veuillez ajouter du contenu HTML à votre email.");
      return;
    }
    
    if (!emailData.useHtml && !emailData.body) {
      setError("Veuillez ajouter du contenu texte à votre email.");
      return;
    }
    
    // Vérifier le contenu HTML pour les problèmes potentiels
    const htmlWarnings = validateHtmlContent();
    setWarnings(htmlWarnings);
    
    // Mettre à jour le nombre total de destinataires
    setSendingStatus(prev => ({
      ...prev,
      total: recipients.length
    }));
    
    setError(null);
    setStep(3);
  };

  // Fonction pour démarrer l'envoi en masse
  const startBulkSend = async (startFromIndex = 0) => {
    // Si on a déjà un envoi en cours et qu'il n'est pas en pause, ne pas démarrer un nouvel envoi
    if (sendingStatus.inProgress && !sendingStatus.isPaused) {
      console.log("Un envoi est déjà en cours");
      return;
    }
    
    // Confirmation avant envoi si c'est un nouvel envoi
    if (startFromIndex === 0 && !sendingStatus.id) {
      if (!confirm(`IMPORTANT: Vous êtes sur le point d'envoyer des emails réels à ${recipients.length} destinataires. Voulez-vous continuer?`)) {
        return;
      }
    }

    // Force testMode to false
    setBulkSettings(prevSettings => ({
      ...prevSettings,
      testMode: false
    }));
    
    // Si c'est un nouvel envoi (pas une reprise)
    if (startFromIndex === 0 && !sendingStatus.id) {
      if (recipients.length === 0) {
        setError("Aucun destinataire à qui envoyer les emails.");
        return;
      }
      
      // Générer un nouvel ID pour cet envoi
      const sendId = `send-${Date.now()}`;
      
      // Initialiser l'état d'envoi
      setSendingStatus({
        inProgress: true,
        isPaused: false,
        success: 0,
        failed: 0,
        total: recipients.length,
        currentIndex: 0,
        errors: [],
        currentStatus: "Démarrage de l'envoi...",
        startTime: Date.now(),
        pauseTime: null,
        totalPauseDuration: 0,
        id: sendId
      });
      
      // Réinitialiser les compteurs de timestamps d'envoi
      sentTimestampsRef.current = {
        perSecond: [],
        perMinute: [],
        perHour: [],
        perDay: []
      };
      
      console.log("Démarrage d'un nouvel envoi, ID:", sendId);
    } else {
      // Reprise d'un envoi existant
      setSendingStatus(prev => ({
        ...prev,
        inProgress: true,
        isPaused: false,
        currentStatus: `Reprise de l'envoi à partir du destinataire ${startFromIndex + 1}/${prev.total}...`
      }));
      console.log("Reprise d'un envoi, index de départ:", startFromIndex);
    }
    
    // Aller à l'étape d'envoi si on n'y est pas déjà
    if (step !== 4) {
      setStep(4);
    }
    
    // Réinitialiser le flag d'annulation
    cancelSendingRef.current = false;
    
    // Initialiser le statut
    const totalRecipients = recipients.length;
    const batchSize = bulkSettings.batchSize;
    const delayInMs = bulkSettings.delayBetweenBatches * 1000;
    
    console.log("Configuration d'envoi:", { 
      totalRecipients, 
      batchSize, 
      delayInMs,
      sendingMode: bulkSettings.sendingMode 
    });
    
    // Fonction pour envoyer un lot d'emails
    const sendBatch = async (startIndex) => {
      console.log("Démarrage d'un lot d'envoi, index:", startIndex);
      
      // Si l'envoi a été annulé ou mis en pause, arrêter
      if (cancelSendingRef.current || sendingStatus.isPaused) {
        console.log("Envoi annulé ou en pause, arrêt du lot");
        return;
      }
      
      const endIndex = Math.min(startIndex + batchSize, totalRecipients);
      const batch = recipients.slice(startIndex, endIndex);
      console.log(`Préparation du lot: ${startIndex} -> ${endIndex} (${batch.length} destinataires)`);
      
      // Vérifier les limites si elles sont activées
      const checkRateLimits = smtpConfig.rateLimits && smtpConfig.rateLimits.enabled;
      console.log("Vérification des limites activée:", checkRateLimits);
      
      // Traiter les emails un par un pour respecter les limites
      for (let i = 0; i < batch.length; i++) {
        // Vérifier à nouveau si l'envoi a été annulé ou mis en pause
        if (cancelSendingRef.current || sendingStatus.isPaused) {
          console.log("Envoi annulé ou en pause pendant le traitement du lot");
          return;
        }
        
        const recipient = batch[i];
        console.log(`Traitement de l'email pour: ${recipient.email}`);
        let success = false;
        let errorMessage = "";
        
        try {
          // Vérifier les limites avant d'envoyer
          if (checkRateLimits) {
            console.log("Vérification des limites avant envoi");
            const limitCheck = checkLimitsBeforeSend();
            
            if (!limitCheck.canSend) {
              // Afficher un log d'attente pour informer l'utilisateur
              console.log(`Attente de ${limitCheck.waitTime}ms pour respecter les limites de débit...`);
              
              // Mettre à jour l'UI pour montrer l'attente des limites de débit
              setSendingStatus(prev => ({
                ...prev,
                currentStatus: `Pause: ${limitCheck.reason}. Reprise dans ${Math.ceil(limitCheck.waitTime/1000)}s...`
              }));
              
              // Attendre le temps nécessaire
              await new Promise(resolve => setTimeout(resolve, limitCheck.waitTime));
              
              // Vérifier à nouveau l'annulation après l'attente
              if (cancelSendingRef.current || sendingStatus.isPaused) {
                console.log("Envoi annulé ou en pause après l'attente des limites");
                return;
              }
              
              // Vérifier à nouveau
              console.log("Re-vérification des limites après attente");
              const recheckLimits = checkLimitsBeforeSend();
              if (!recheckLimits.canSend) {
                errorMessage = recheckLimits.reason;
                console.error("Toujours impossible d'envoyer après attente:", errorMessage);
                throw new Error(errorMessage);
              }
            }
          }
          
          // Appliquer les variables au sujet et au contenu
          const parsedSubject = parseTemplate(emailData.subject, recipient);
          const htmlContent = emailData.useHtml
            ? parseHtmlTemplate(emailData.htmlBody, recipient)
            : null;
          const textContent = !emailData.useHtml
            ? parseTemplate(emailData.body, recipient)
            : null;
          
          console.log("Contenu préparé:", { 
            sujet: parsedSubject,
            useHtml: emailData.useHtml
          });
          
          // Mise à jour de l'UI pour montrer le destinataire actuel
          setSendingStatus(prev => ({
            ...prev,
            currentStatus: `Envoi à ${recipient.email}...`,
            currentIndex: startIndex + i
          }));
          
          // Préparer les données pour l'API
          const emailPayload = {
            smtpConfig: {
              host: smtpConfig.host,
              port: smtpConfig.port,
              username: smtpConfig.username,
              password: smtpConfig.password,
              senderName: smtpConfig.senderName,
              encryption: smtpConfig.encryption,
              rateLimits: smtpConfig.rateLimits ? {
                perSecond: smtpConfig.rateLimits.perSecond || 0,
                perMinute: smtpConfig.rateLimits.perMinute || 0,
                perHour: smtpConfig.rateLimits.perHour || 0,
                perDay: smtpConfig.rateLimits.perDay || 0,
                enabled: smtpConfig.rateLimits.enabled || false
              } : undefined
            },
            to: recipient.email,
            subject: parsedSubject,
            body: !emailData.useHtml ? textContent : undefined,
            htmlBody: emailData.useHtml ? htmlContent : undefined,
            useHtml: emailData.useHtml,
            senderName: smtpConfig.senderName,
            testMode: false  // Forcer à false pour toujours envoyer de vrais emails
          };
          
          // Envoyer l'email
          console.log("Envoi de la requête API...");
          
          // Adapter l'URL pour Netlify en production
          const apiUrl = process.env.NODE_ENV === 'production'
            ? '/.netlify/functions/send-email'
            : '/api/send-email';
            
          // S'assurer qu'il n'y a pas de barre oblique finale
          const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
          
          const response = await fetch(cleanUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailPayload)
          });
          
          console.log("Réponse API reçue:", response.status);
          const result = await response.json();
          console.log("Résultat de l'API:", result);
          
          if (response.ok && result.success) {
            success = true;
            console.log("Email envoyé avec succès");
            // Enregistrer cet envoi réussi dans les compteurs de limites
            recordSuccessfulSend();
            // Mettre à jour le statut de réussite immédiatement pour chaque email
            setSendingStatus(prev => {
              const newSuccessCount = prev.success + 1;
              console.log("Incrémentation du compteur de succès:", { avant: prev.success, après: newSuccessCount });
              return {
                ...prev,
                success: newSuccessCount,
                currentStatus: `${newSuccessCount} emails envoyés sur ${totalRecipients}`
              };
            });
          } else {
            errorMessage = result.message || result.error || "Échec de l'envoi";
            console.error("Échec de l'envoi:", errorMessage);
            throw new Error(errorMessage);
          }
        } catch (error) {
          console.error(`Erreur lors de l'envoi à ${recipient.email}:`, error);
          
          // Mettre à jour les erreurs
          setSendingStatus(prev => ({
            ...prev,
            failed: prev.failed + 1,
            errors: [...prev.errors, { 
              success: false, 
              recipient, 
              error: error.message || errorMessage || "Erreur inconnue"
            }],
            currentStatus: `Échec pour ${recipient.email}: ${error.message || errorMessage || "Erreur inconnue"}`
          }));
        }
        
        // Pause après chaque envoi pour éviter de surcharger le serveur SMTP
        console.log("Pause de 200ms entre chaque email");
        await new Promise(resolve => setTimeout(resolve, 1000)); // Augmenté à 1000ms (1 seconde) pour réduire la pression sur le serveur SMTP
        
        // Enregistrer l'état actuel dans l'historique périodiquement (tous les 5 emails)
        if ((startIndex + i + 1) % 5 === 0) {
          console.log("Sauvegarde de l'état actuel dans l'historique");
          saveCurrentSendStateToHistory();
        }
      }
      
      // Mise à jour du statut pour le batch complet
      setSendingStatus(prev => ({
        ...prev,
        currentIndex: endIndex
      }));
      
      // Vérifier s'il reste des destinataires
      if (endIndex < totalRecipients) {
        console.log(`Lot terminé. Traité jusqu'à l'index ${endIndex}/${totalRecipients}`);
        
        if (bulkSettings.sendingMode === 'all') {
          // Si on envoie tout d'un coup, continuer avec le lot suivant après une courte pause
          console.log("Mode 'all': pause de 500ms avant le prochain lot");
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Vérifier l'annulation ou la pause avant de continuer
          if (cancelSendingRef.current || sendingStatus.isPaused) {
            console.log("Envoi annulé ou en pause après traitement du lot");
            return;
          }
          
          return sendBatch(endIndex);
        } else {
          // Si on envoie par lots, attendre le délai spécifié
          console.log(`Mode 'batch': pause de ${delayInMs}ms avant le prochain lot`);
          setSendingStatus(prev => ({
            ...prev,
            currentStatus: `Pause entre lots: ${delayInMs/1000}s...`
          }));
          
          // Utiliser une référence pour pouvoir annuler le timeout
          batchTimeoutRef.current = setTimeout(() => {
            // Vérifier l'annulation ou la pause avant de continuer
            if (!cancelSendingRef.current && !sendingStatus.isPaused) {
              sendBatch(endIndex);
            }
          }, delayInMs);
        }
      } else {
        // Tous les emails ont été envoyés
        console.log("Tous les emails ont été traités. Envoi terminé!");
        setSendingStatus(prev => {
          const updatedStatus = {
            ...prev,
            inProgress: false,
            currentStatus: "Envoi terminé!"
          };
          console.log("État final avant sauvegarde:", updatedStatus);
          
          // Sauvegarder l'état final dans l'historique après mise à jour
          setTimeout(() => saveCurrentSendStateToHistory(true), 100);
          
          return updatedStatus;
        });
      }
    };
    
    // Commencer l'envoi avec l'index spécifié
    try {
      console.log("Démarrage de l'envoi à partir de l'index:", startFromIndex);
      await sendBatch(startFromIndex);
    } catch (error) {
      console.error("Erreur globale lors de l'envoi:", error);
      setSendingStatus(prev => ({
        ...prev,
        inProgress: false,
        currentStatus: `Erreur: ${error.message || "Erreur inconnue lors de l'envoi"}`
      }));
    }
  };

  // Rendu de l'étape 1: Importation des destinataires
  const renderImportStep = () => (
    <>
      <h2 className="text-xl font-semibold mb-4">Importer des destinataires</h2>
      
      {/* Ajouter un bouton pour afficher l'historique des envois */}
      {sendHistory.length > 0 && (
        <div className="mb-4 bg-blue-50 p-3 rounded-lg">
          <div className="flex justify-between items-center">
            <h3 className="text-md font-medium text-blue-800">Vous avez {sendHistory.length} campagne(s) dans l'historique</h3>
            <button
              onClick={() => setStep(4)} // Aller directement à l'étape d'envoi qui contient l'historique
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center"
            >
              <Clock className="w-4 h-4 mr-1" />
              Voir l'historique
            </button>
          </div>
        </div>
      )}
      
      <CsvImporter onImportComplete={handleImportComplete} />
    </>
  );

  // Rendu de l'étape 2: Configuration de l'envoi en masse
  const renderConfigStep = () => (
    <>
      <h2 className="text-xl font-semibold mb-4">Configurer l'envoi en masse</h2>
      
      <div className="mb-5 p-3 bg-blue-50 rounded-lg flex items-start">
        <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Variables disponibles pour personnalisation</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {foundVariables.length > 0 ? (
              foundVariables.map((variable, index) => (
                <span key={index} className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  {`{{${variable}}}`}
                </span>
              ))
            ) : (
              <span className="text-blue-700">Aucune variable détectée. Utilisez le format {"{{nomVariable}}"} dans votre contenu.</span>
            )}
          </div>
        </div>
      </div>
      
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium">Destinataires</label>
          <span className="text-sm text-gray-500">{recipients.length} contacts</span>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg border">
          <div className="mb-2 flex justify-between items-center">
            <span className="text-sm font-medium">Aperçu de la liste</span>
            <button 
              className="text-blue-600 hover:text-blue-800 text-sm"
              onClick={() => setStep(1)}
            >
              Modifier la liste
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1 text-left">Email</th>
                  <th className="px-2 py-1 text-left">Prénom</th>
                  <th className="px-2 py-1 text-left">Nom</th>
                </tr>
              </thead>
              <tbody>
                {recipients.slice(0, 5).map((recipient, index) => (
                  <tr key={index} className="border-t border-gray-200">
                    <td className="px-2 py-1">{recipient.email}</td>
                    <td className="px-2 py-1">{recipient.firstName || '-'}</td>
                    <td className="px-2 py-1">{recipient.lastName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recipients.length > 5 && (
              <div className="px-2 py-1 text-gray-500 text-xs">
                ... et {recipients.length - 5} autres destinataires
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
          className="flex items-center text-gray-700 text-sm mb-2"
        >
          {showAdvancedSettings ? (
            <ChevronUp className="w-4 h-4 mr-1" />
          ) : (
            <ChevronDown className="w-4 h-4 mr-1" />
          )}
          Paramètres avancés d'envoi
        </button>
        
        {showAdvancedSettings && (
          <div className="bg-gray-50 p-3 rounded-lg border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Mode d'envoi</label>
                <select
                  value={bulkSettings.sendingMode}
                  onChange={(e) => setBulkSettings({...bulkSettings, sendingMode: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">Tout envoyer immédiatement</option>
                  <option value="batch">Envoyer par lots avec délai</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Taille des lots</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={bulkSettings.batchSize}
                  onChange={(e) => setBulkSettings({...bulkSettings, batchSize: parseInt(e.target.value)})}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Nombre d'emails envoyés par lot (1-50)</p>
              </div>
              
              {bulkSettings.sendingMode === 'batch' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Délai entre les lots (secondes)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={bulkSettings.delayBetweenBatches}
                    onChange={(e) => setBulkSettings({...bulkSettings, delayBetweenBatches: parseInt(e.target.value)})}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Temps d'attente entre chaque lot (1-60 sec)</p>
                </div>
              )}
              
              {/* Option de mode test modifiée pour être plus claire */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center">
                  <Check className="w-5 h-5 text-green-600 mr-2" />
                  <span className="font-medium text-green-700">Mode envoi réel activé</span>
                </div>
                <p className="text-xs text-green-600 mt-1 ml-7">
                  Tous les emails seront envoyés aux destinataires réels.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mb-4 p-2 bg-red-50 text-red-700 rounded-lg flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
      
      <div className="flex justify-between">
        <button
          onClick={() => onClose()}
          className="text-gray-600 hover:text-gray-800"
        >
          Annuler
        </button>
        <button
          onClick={goToPreview}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Passer à l'aperçu
        </button>
      </div>
    </>
  );

  // Rendu de l'étape 3: Aperçu de l'email avec personnalisation
  const renderPreviewStep = () => (
    <>
      <h2 className="text-xl font-semibold mb-4">Aperçu de l'email personnalisé</h2>
      
      {previewRecipient && (
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium">Aperçu pour</label>
            <div className="relative">
              <select
                value={recipients.indexOf(previewRecipient)}
                onChange={(e) => setPreviewRecipient(recipients[parseInt(e.target.value)])}
                className="appearance-none text-sm bg-gray-50 border border-gray-300 rounded-lg py-1 px-3 pr-8"
              >
                {recipients.map((recipient, index) => (
                  <option key={index} value={index}>
                    {recipient.email} {recipient.firstName ? `(${recipient.firstName})` : ''}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="border-b p-3 bg-gray-50">
              <div className="text-sm">
                <div><strong>À:</strong> {previewRecipient.email}</div>
                <div><strong>Sujet:</strong> {parseTemplate(emailData.subject, previewRecipient)}</div>
              </div>
            </div>
            <div className="p-4">
              {emailData.useHtml ? (
                <div 
                  className="overflow-hidden"
                  style={{ isolation: 'isolate' }}
                >
                  <iframe
                    srcDoc={`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <meta charset="UTF-8">
                          <meta name="viewport" content="width=device-width, initial-scale=1.0">
                          <style>
                            body { 
                              font-family: Arial, sans-serif; 
                              margin: 0;
                              padding: 0;
                            }
                            * { 
                              max-width: 100%; 
                            }
                          </style>
                        </head>
                        <body>${parseHtmlTemplate(emailData.htmlBody, previewRecipient)}</body>
                      </html>
                    `}
                    title="Aperçu HTML"
                    className="w-full border-0 min-h-[300px]"
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {parseTemplate(emailData.body, previewRecipient)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
      
      {warnings.length > 0 && (
        <div className="mb-5 p-3 bg-orange-50 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-orange-800">Avertissements de compatibilité email</h3>
              <ul className="mt-1 text-sm text-orange-700 list-disc list-inside">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-orange-600">
                Ces problèmes peuvent affecter l'apparence de votre email dans certains clients de messagerie.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="mb-5 p-3 bg-yellow-50 rounded-lg flex items-start">
        <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-yellow-800">
          <p className="font-medium">Information importante</p>
          <p>Vous êtes sur le point d'envoyer cet email à {recipients.length} destinataires. Vérifiez bien le contenu et les destinataires avant de procéder.</p>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-2 bg-red-50 text-red-700 rounded-lg flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
      
      <div className="flex justify-between">
        <button
          onClick={() => setStep(2)}
          className="text-gray-600 hover:text-gray-800"
        >
          Retour
        </button>
        <button
          onClick={() => startBulkSend(0)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Send className="w-4 h-4 mr-2" />
          Envoyer à {recipients.length} destinataires
        </button>
      </div>
    </>
  );

  // Rendu de l'étape 4: Envoi en masse
  const renderSendingStep = () => (
    <>
      <h2 className="text-xl font-semibold mb-4">Envoi en masse</h2>
      
      {/* Historique des envois */}
      {sendHistory.length > 0 && (
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium">Historique des campagnes</h3>
            <button
              onClick={clearAllHistory}
              className="text-sm text-red-600 hover:text-red-800 flex items-center"
            >
              <Trash className="w-4 h-4 mr-1" />
              Vider l'historique
            </button>
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sujet</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progression</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sendHistory.map((historyItem, index) => (
                  <tr key={historyItem.id} className={historyItem.id === sendingStatus.id ? "bg-blue-50" : ""}>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {new Date(historyItem.sendingStatus.startTime || historyItem.sendingStatus.lastUpdated).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      <div className="max-w-[200px] truncate">{historyItem.emailData.subject}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {historyItem.sendingStatus.isComplete ? (
                        <span className="text-green-600 flex items-center">
                          <Check className="w-3 h-3 mr-1" />
                          Terminé
                        </span>
                      ) : historyItem.sendingStatus.isPaused ? (
                        <span className="text-orange-600 flex items-center">
                          <Pause className="w-3 h-3 mr-1" />
                          En pause
                        </span>
                      ) : historyItem.sendingStatus.inProgress ? (
                        <span className="text-blue-600 flex items-center">
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          En cours
                        </span>
                      ) : (
                        <span className="text-gray-600">Inactif</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {historyItem.sendingStatus.success}/{historyItem.sendingStatus.total}
                      {historyItem.sendingStatus.failed > 0 && (
                        <span className="text-red-600 ml-1">
                          ({historyItem.sendingStatus.failed} échecs)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => loadSendFromHistory(historyItem)}
                          className="text-blue-600 hover:text-blue-800"
                          disabled={historyItem.id === sendingStatus.id}
                          title={historyItem.sendingStatus.isPaused ? "Reprendre" : "Charger"}
                        >
                          {historyItem.sendingStatus.isPaused ? "Reprendre" : "Charger"}
                        </button>
                        <button
                          onClick={() => deleteCampaignFromHistory(historyItem.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Supprimer"
                        >
                          <Trash className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Nouvelle campagne ou progression de l'envoi en cours */}
      {!sendingStatus.inProgress && !sendingStatus.isPaused && sendingStatus.currentIndex === 0 && (
        <div className="mb-5 p-4 bg-blue-50 rounded-lg text-center">
          <p className="mb-3 text-blue-800">Vous pouvez charger une campagne depuis l'historique ci-dessus ou démarrer une nouvelle.</p>
          <button
            onClick={() => setStep(1)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center mx-auto"
          >
            <FilePlus className="w-5 h-5 mr-2" />
            Nouvelle campagne
          </button>
        </div>
      )}
      
      {/* Progression de l'envoi en cours si applicable */}
      {(sendingStatus.inProgress || sendingStatus.isPaused || sendingStatus.currentIndex > 0 || sendingStatus.success > 0) && (
        <>
          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-medium">Progression</div>
              <div className="text-sm text-gray-500">
                {sendingStatus.currentIndex} / {sendingStatus.total} emails
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
              <div 
                className="bg-blue-600 h-4 rounded-full" 
                style={{ width: `${(sendingStatus.currentIndex / sendingStatus.total) * 100}%` }}
              ></div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg border text-center">
                <div className="text-sm text-gray-600">Total</div>
                <div className="text-xl font-semibold">{sendingStatus.total}</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg border text-center">
                <div className="text-sm text-green-600">Réussis</div>
                <div className="text-xl font-semibold text-green-700">{sendingStatus.success}</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg border text-center">
                <div className="text-sm text-red-600">Échoués</div>
                <div className="text-xl font-semibold text-red-700">{sendingStatus.failed}</div>
              </div>
            </div>
            
            {/* Statut actuel */}
            <div className="bg-blue-50 p-3 rounded-lg border mb-4">
              <h3 className="text-sm font-medium text-blue-800 mb-1">Statut actuel</h3>
              <div className="flex items-center">
                {sendingStatus.inProgress ? (
                  sendingStatus.isPaused ? (
                    <Pause className="w-4 h-4 mr-2 text-orange-500" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin text-blue-600" />
                  )
                ) : (
                  <Check className="w-4 h-4 mr-2 text-green-600" />
                )}
                <span className={`${sendingStatus.isPaused ? 'text-orange-800' : 'text-blue-800'}`}>
                  {sendingStatus.currentStatus || (sendingStatus.inProgress ? "Initialisation..." : "Envoi terminé!")}
                </span>
              </div>
              
              {/* Affichage du temps écoulé */}
              {sendingStatus.startTime && (
                <div className="mt-1 text-xs text-blue-700 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>
                    Démarré le {new Date(sendingStatus.startTime).toLocaleString()}
                    {sendingStatus.totalPauseDuration > 0 && 
                      ` (pauses: ${Math.floor(sendingStatus.totalPauseDuration / 60000)}min)`}
                  </span>
                </div>
              )}
              
              {/* Limites de débit */}
              {smtpConfig.rateLimits && smtpConfig.rateLimits.enabled && (
                <div className="mt-2 text-xs text-blue-700">
                  <p className="font-medium">Limites SMTP configurées:</p>
                  <ul className="list-disc list-inside mt-1">
                    {smtpConfig.rateLimits.perSecond > 0 && (
                      <li>{smtpConfig.rateLimits.perSecond} emails/seconde</li>
                    )}
                    {smtpConfig.rateLimits.perMinute > 0 && (
                      <li>{smtpConfig.rateLimits.perMinute} emails/minute</li>
                    )}
                    {smtpConfig.rateLimits.perHour > 0 && (
                      <li>{smtpConfig.rateLimits.perHour} emails/heure</li>
                    )}
                    {smtpConfig.rateLimits.perDay > 0 && (
                      <li>{smtpConfig.rateLimits.perDay} emails/jour</li>
                    )}
                  </ul>
                </div>
              )}
              
              {/* Boutons de contrôle */}
              <div className="mt-3 flex gap-2 flex-wrap">
                {sendingStatus.inProgress && !sendingStatus.isPaused ? (
                  <button
                    onClick={pauseSending}
                    className="flex items-center bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded"
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    Mettre en pause
                  </button>
                ) : sendingStatus.isPaused ? (
                  <button
                    onClick={resumeSending}
                    className="flex items-center bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Reprendre l'envoi
                  </button>
                ) : null}
                
                {(sendingStatus.inProgress || sendingStatus.isPaused) && (
                  <button
                    onClick={cancelSending}
                    className="flex items-center bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Annuler
                  </button>
                )}
                
                {/* Bouton pour redémarrer une campagne chargée ou terminée */}
                {sendingStatus.id && !sendingStatus.inProgress && (
                  <button
                    onClick={restartSending}
                    className="flex items-center bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1 rounded"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Redémarrer la campagne
                  </button>
                )}
                
                {/* Bouton pour réinitialiser complètement l'état */}
                <button
                  onClick={resetSendingState}
                  className="flex items-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Réinitialiser
                </button>
                
                {sendingStatus.id && !sendingStatus.inProgress && !sendingStatus.isPaused && (
                  <button
                    onClick={() => saveCurrentSendStateToHistory(true)}
                    className="flex items-center bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Enregistrer dans l'historique
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {sendingStatus.errors.length > 0 && (
            <div className="mb-5">
              <div className="text-sm font-medium mb-2">Erreurs ({sendingStatus.errors.length})</div>
              <div className="max-h-60 overflow-y-auto bg-red-50 rounded-lg border border-red-200">
                {sendingStatus.errors.map((error, index) => (
                  <div key={index} className="p-2 border-b border-red-200 last:border-b-0 text-sm">
                    <div className="font-medium text-red-800">{error.recipient.email}</div>
                    <div className="text-red-700 text-sm">{error.error}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
        >
          Fermer
        </button>
      </div>
    </>
  );

  // Fonction pour nettoyer l'historique des erreurs
  const cleanupHistoryErrors = () => {
    // Filtrer les entrées avec des états incohérents
    const cleanedHistory = sendHistory.filter(item => {
      // Vérifier si les données essentielles sont présentes
      if (!item.id || !item.sendingStatus || !item.recipients) {
        console.log("Entrée ignorée: données manquantes", item.id);
        return false;
      }
      
      // Corriger les états incohérents
      if (item.sendingStatus.inProgress && item.sendingStatus.isComplete) {
        console.log("Correction d'état: ne peut pas être en cours ET complété", item.id);
        item.sendingStatus.inProgress = false;
      }
      
      // Suppression des items avec des compteurs inconsistants
      const { success, failed, total } = item.sendingStatus;
      if (success + failed > total) {
        console.log("Entrée ignorée: compteurs incohérents", item.id, { success, failed, total });
        return false;
      }
      
      return true;
    });
    
    console.log(`Nettoyage terminé: ${sendHistory.length - cleanedHistory.length} entrées supprimées`);
    setSendHistory(cleanedHistory);
  };
  
  // Ajouter une fonction pour réinitialiser complètement l'état
  const resetSendingState = () => {
    if (sendingStatus.inProgress && !confirm("Cela va annuler l'envoi en cours. Continuer?")) {
      return;
    }
    
    console.log("Réinitialisation complète de l'état d'envoi");
    
    // Annuler tout timeout en cours
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    
    // Réinitialiser l'état d'envoi
    setSendingStatus({
      inProgress: false,
      isPaused: false,
      success: 0,
      failed: 0,
      total: recipients.length > 0 ? recipients.length : 0,
      currentIndex: 0,
      errors: [],
      currentStatus: "Réinitialisé",
      startTime: null,
      pauseTime: null,
      totalPauseDuration: 0,
      id: null
    });
    
    // Réinitialiser les compteurs de limites
    sentTimestampsRef.current = {
      perSecond: [],
      perMinute: [],
      perHour: [],
      perDay: []
    };
    
    cancelSendingRef.current = false;
  };
  
  // Exécuter un nettoyage initial lors du chargement
  useEffect(() => {
    if (sendHistory.length > 0) {
      cleanupHistoryErrors();
    }
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {step === 1 && renderImportStep()}
      {step === 2 && renderConfigStep()}
      {step === 3 && renderPreviewStep()}
      {step === 4 && renderSendingStep()}
    </div>
  );
};

export default BulkEmailSender; 