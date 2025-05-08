import React, { useState, useEffect, useRef } from 'react';
import { Settings, Send, Save, RefreshCw, Check, X, Mail, Server, Key, User, Lock, Edit, Trash, ChevronDown, ChevronUp, Info, Clock, List, Copy, Eye, Code, FileText, Loader, AlertTriangle, Menu, Users, Shield, LogIn } from 'lucide-react';
import BulkEmailSender from './BulkEmailSender';

const EmailSender = ({ isAdmin, onLogout }) => {
  // États pour les configurations SMTP
  const [smtpConfigs, setSmtpConfigs] = useState([]);
  const [activeConfig, setActiveConfig] = useState(null);
  const [newConfig, setNewConfig] = useState({
    name: '',
    host: '',
    port: '',
    username: '',
    password: '',
    senderName: '',
    encryption: 'tls',
    isDefault: false,
    rateLimits: {
      perSecond: 0,
      perMinute: 0,
      perHour: 100,
      perDay: 500,
      enabled: true
    }
  });
  
  // États pour les groupes de rotation SMTP
  const [smtpGroups, setSmtpGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    configs: [],
    rotationMethod: 'roundRobin', // ou 'random'
    isDefault: false
  });
  const [editGroupMode, setEditGroupMode] = useState(false);
  
  // États pour l'email
  const [emailData, setEmailData] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
    htmlBody: '',
    useHtml: false,
    attachments: []
  });
  
  // Historique d'envois
  const [emailHistory, setEmailHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [recipientSuggestions, setRecipientSuggestions] = useState([]);
  const [subjectSuggestions, setSubjectSuggestions] = useState([]);
  const [showRecipientSuggestions, setShowRecipientSuggestions] = useState(false);
  const [showSubjectSuggestions, setShowSubjectSuggestions] = useState(false);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  
  // États UI
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [sendStatus, setSendStatus] = useState(null);
  const [autoDetectLoading, setAutoDetectLoading] = useState(false);
  const [advancedOptions, setAdvancedOptions] = useState(false);
  
  // Nouveaux états pour l'éditeur HTML et les logs
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  
  // Référence pour le défilement automatique des logs
  const logsEndRef = useRef(null);
  
  // Nouvel état pour le menu mobile
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Ajouter un état pour le mode d'envoi en masse
  const [showBulkMode, setShowBulkMode] = useState(false);
  
  // Nouvel état pour les groupes de rotation des templates
  const [templateGroups, setTemplateGroups] = useState([]);
  const [activeTemplateGroup, setActiveTemplateGroup] = useState(null);
  const [showTemplateGroupPanel, setShowTemplateGroupPanel] = useState(false);
  const [newTemplateGroup, setNewTemplateGroup] = useState({
    name: '',
    templates: [],
    rotationMethod: 'roundRobin', // ou 'random'
    isDefault: false
  });
  const [editTemplateGroupMode, setEditTemplateGroupMode] = useState(false);
  
  // Fonction pour ajouter des logs
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog = {
      id: Date.now(),
      message,
      type, // 'info', 'success', 'error', 'warning'
      timestamp
    };
    setLogs(prevLogs => [...prevLogs, newLog]);
    
    // Limiter à 100 logs maximum
    if (logs.length > 100) {
      setLogs(prevLogs => prevLogs.slice(-100));
    }
    
    // Ne pas déclencher de scroll automatique lors d'actions utilisateur
    if (type === 'info' && !message.includes('sauvegardé') && !message.includes('envoi')) {
      if (logsEndRef.current && showLogs) {
        logsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  };
  
  // Effet pour défiler automatiquement vers le bas des logs
  useEffect(() => {
    if (logsEndRef.current && showLogs) {
      // Utiliser preventDefault pour éviter le comportement par défaut de scroll
      logsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [logs.length, showLogs]);
  
  // Charger les configurations sauvegardées au démarrage
  useEffect(() => {
    const savedConfigs = localStorage.getItem('smtpConfigs');
    if (savedConfigs) {
      const configs = JSON.parse(savedConfigs);
      setSmtpConfigs(configs);
      
      // Définir la configuration par défaut comme active
      const defaultConfig = configs.find(config => config.isDefault);
      if (defaultConfig) {
        setActiveConfig(defaultConfig);
      } else if (configs.length > 0) {
        setActiveConfig(configs[0]);
      }
    }
  }, []);
  
  // Charger l'historique des emails au démarrage
  useEffect(() => {
    const savedHistory = localStorage.getItem('emailHistory');
    if (savedHistory) {
      setEmailHistory(JSON.parse(savedHistory));
    }
    
    const savedTemplates = localStorage.getItem('emailTemplates');
    if (savedTemplates) {
      setSavedTemplates(JSON.parse(savedTemplates));
    }
    
    // Extraire les destinataires et sujets uniques de l'historique pour les suggestions
    if (savedHistory) {
      const history = JSON.parse(savedHistory);
      
      // Récupérer tous les destinataires uniques
      const recipients = [...new Set(history.map(item => item.to).flat())];
      setRecipientSuggestions(recipients);
      
      // Récupérer tous les sujets uniques
      const subjects = [...new Set(history.map(item => item.subject))];
      setSubjectSuggestions(subjects);
    }
    
    // Ajouter un log initial
    addLog('Application démarrée. Prêt à envoyer des emails.');
  }, []);
  
  // Charger les groupes au démarrage
  useEffect(() => {
    const savedGroups = localStorage.getItem('smtpGroups');
    if (savedGroups) {
      const groups = JSON.parse(savedGroups);
      setSmtpGroups(groups);
      
      // Définir le groupe par défaut comme actif, sauf si une config SMTP est déjà active
      if (!activeConfig) {
        const defaultGroup = groups.find(group => group.isDefault);
        if (defaultGroup) {
          setActiveGroup(defaultGroup);
        }
      }
    }
  }, []);
  
  // Charger les groupes de templates lors du chargement initial
  useEffect(() => {
    const savedGroups = localStorage.getItem('templateGroups');
    if (savedGroups) {
      const groups = JSON.parse(savedGroups);
      setTemplateGroups(groups);
      
      // Définir le groupe par défaut comme actif
      const defaultGroup = groups.find(group => group.isDefault);
      if (defaultGroup) {
        setActiveTemplateGroup(defaultGroup);
      }
    }
  }, []);
  
  // Sauvegarder les configurations
  const saveConfigurations = () => {
    localStorage.setItem('smtpConfigs', JSON.stringify(smtpConfigs));
    
    if (smtpGroups.length > 0) {
      localStorage.setItem('smtpGroups', JSON.stringify(smtpGroups));
    }
  };
  
  // Ajouter un groupe de rotation SMTP
  const saveSmtpGroup = () => {
    if (!newGroup.name || newGroup.configs.length === 0) {
      alert('Veuillez spécifier un nom et sélectionner au moins une configuration SMTP');
      return;
    }
    
    if (editGroupMode) {
      // Mettre à jour le groupe existant
      const updatedGroups = smtpGroups.map(group => 
        group.name === newGroup.name ? newGroup : group
      );
      setSmtpGroups(updatedGroups);
      
      // Mettre à jour activeGroup si c'est celui en cours d'édition
      if (activeGroup && activeGroup.name === newGroup.name) {
        setActiveGroup(newGroup);
      }
      
      addLog(`Groupe de rotation "${newGroup.name}" mis à jour`, 'success');
    } else {
      // Vérifier si le nom existe déjà
      if (smtpGroups.some(group => group.name === newGroup.name)) {
        alert('Un groupe avec ce nom existe déjà');
        return;
      }
      
      // Si c'est le premier groupe ou marqué comme par défaut
      const isFirstGroup = smtpGroups.length === 0;
      
      // Si c'est le premier ou marqué comme par défaut, mettre à jour les autres
      const updatedGroups = newGroup.isDefault || isFirstGroup
        ? smtpGroups.map(group => ({ ...group, isDefault: false }))
        : [...smtpGroups];
      
      // Ajouter le nouveau groupe
      const groupToAdd = isFirstGroup 
        ? { ...newGroup, isDefault: true } 
        : newGroup;
        
      setSmtpGroups([...updatedGroups, groupToAdd]);
      
      // Définir comme actif si c'est le premier ou par défaut
      if (isFirstGroup || groupToAdd.isDefault) {
        setActiveGroup(groupToAdd);
      }
      
      addLog(`Nouveau groupe de rotation "${newGroup.name}" ajouté`, 'success');
    }
    
    // Réinitialiser le formulaire
    setNewGroup({
      name: '',
      configs: [],
      rotationMethod: 'roundRobin',
      isDefault: false
    });
    
    setEditGroupMode(false);
    setShowGroupPanel(false);
  };
  
  // Supprimer un groupe
  const deleteSmtpGroup = (groupName) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le groupe "${groupName}" ?`)) {
      const updatedGroups = smtpGroups.filter(group => group.name !== groupName);
      setSmtpGroups(updatedGroups);
      
      // Si le groupe actif est supprimé, en définir un autre
      if (activeGroup && activeGroup.name === groupName) {
        const defaultGroup = updatedGroups.find(group => group.isDefault);
        if (defaultGroup) {
          setActiveGroup(defaultGroup);
        } else if (updatedGroups.length > 0) {
          setActiveGroup(updatedGroups[0]);
        } else {
          setActiveGroup(null);
        }
      }
      
      addLog(`Groupe "${groupName}" supprimé`, 'info');
    }
  };
  
  // Éditer un groupe
  const editSmtpGroup = (group) => {
    setNewGroup({ ...group });
    setEditGroupMode(true);
    setShowGroupPanel(true);
  };
  
  // Définir un groupe comme défaut
  const setDefaultSmtpGroup = (groupName) => {
    const updatedGroups = smtpGroups.map(group => ({
      ...group,
      isDefault: group.name === groupName
    }));
    setSmtpGroups(updatedGroups);
    
    // Mettre à jour activeGroup si nécessaire
    const newDefault = updatedGroups.find(group => group.name === groupName);
    if (newDefault) {
      setActiveGroup(newDefault);
    }
    
    addLog(`Groupe "${groupName}" défini par défaut`, 'info');
  };
  
  // Obtenir la prochaine configuration SMTP dans la rotation
  const getNextSmtpConfig = (group) => {
    if (!group || group.configs.length === 0) return null;
    
    // Stocker l'index de rotation pour chaque groupe
    const rotationIndexKey = `smtpRotationIndex-${group.name}`;
    let currentIndex = parseInt(localStorage.getItem(rotationIndexKey) || '0');
    
    let nextConfig;
    
    if (group.rotationMethod === 'random') {
      // Sélection aléatoire
      const randomIndex = Math.floor(Math.random() * group.configs.length);
      nextConfig = smtpConfigs.find(config => config.name === group.configs[randomIndex]);
    } else {
      // Round robin (par défaut)
      nextConfig = smtpConfigs.find(config => config.name === group.configs[currentIndex]);
      
      // Incrémenter l'index pour la prochaine utilisation
      currentIndex = (currentIndex + 1) % group.configs.length;
      localStorage.setItem(rotationIndexKey, currentIndex.toString());
    }
    
    return nextConfig || null;
  };
  
  // Ajouter ou mettre à jour une configuration
  const saveConfig = () => {
    if (!newConfig.name || !newConfig.host || !newConfig.port || !newConfig.username) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    if (editMode) {
      // Mettre à jour la configuration existante
      const updatedConfigs = smtpConfigs.map(config => 
        config.name === newConfig.name ? newConfig : config
      );
      setSmtpConfigs(updatedConfigs);
      
      // Mettre à jour activeConfig si c'est celui en cours d'édition
      if (activeConfig && activeConfig.name === newConfig.name) {
        setActiveConfig(newConfig);
      }
      
      addLog(`Configuration "${newConfig.name}" mise à jour`, 'success');
    } else {
      // Vérifier si le nom existe déjà
      if (smtpConfigs.some(config => config.name === newConfig.name)) {
        alert('Une configuration avec ce nom existe déjà');
        return;
      }
      
      // Si c'est la première config ou marquée comme par défaut
      const isFirstConfig = smtpConfigs.length === 0;
      
      // Si c'est la première ou marquée comme par défaut, mettre à jour les autres
      const updatedConfigs = newConfig.isDefault || isFirstConfig
        ? smtpConfigs.map(config => ({ ...config, isDefault: false }))
        : [...smtpConfigs];
      
      // Ajouter la nouvelle configuration
      const configToAdd = isFirstConfig 
        ? { ...newConfig, isDefault: true } 
        : newConfig;
        
      setSmtpConfigs([...updatedConfigs, configToAdd]);
      
      // Définir comme active si c'est la première ou par défaut
      if (isFirstConfig || configToAdd.isDefault) {
        setActiveConfig(configToAdd);
      }
      
      addLog(`Nouvelle configuration "${newConfig.name}" ajoutée`, 'success');
    }
    
    // Réinitialiser le formulaire
    setNewConfig({
      name: '',
      host: '',
      port: '',
      username: '',
      password: '',
      encryption: 'tls',
      isDefault: false,
      rateLimits: {
        perSecond: 0,
        perMinute: 0,
        perHour: 100,
        perDay: 500,
        enabled: true
      }
    });
    
    setEditMode(false);
    setShowConfigPanel(false);
  };
  
  // Supprimer une configuration
  const deleteConfig = (configName) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer la configuration "${configName}" ?`)) {
      const updatedConfigs = smtpConfigs.filter(config => config.name !== configName);
      setSmtpConfigs(updatedConfigs);
      
      // Si la configuration active est supprimée, en définir une autre
      if (activeConfig && activeConfig.name === configName) {
        const defaultConfig = updatedConfigs.find(config => config.isDefault);
        if (defaultConfig) {
          setActiveConfig(defaultConfig);
        } else if (updatedConfigs.length > 0) {
          setActiveConfig(updatedConfigs[0]);
        } else {
          setActiveConfig(null);
        }
      }
      
      addLog(`Configuration "${configName}" supprimée`, 'info');
    }
  };
  
  // Éditer une configuration
  const editConfig = (config) => {
    // S'assurer que la configuration a un objet rateLimits
    const configWithDefaults = {
      ...config,
      rateLimits: config.rateLimits || {
        perSecond: 0,
        perMinute: 0,
        perHour: 100,
        perDay: 500,
        enabled: true
      }
    };
    
    setNewConfig(configWithDefaults);
    setEditMode(true);
    setShowConfigPanel(true);
  };
  
  // Définir une configuration comme défaut
  const setDefaultConfig = (configName) => {
    const updatedConfigs = smtpConfigs.map(config => ({
      ...config,
      isDefault: config.name === configName
    }));
    setSmtpConfigs(updatedConfigs);
    
    // Mettre à jour activeConfig si nécessaire
    const newDefault = updatedConfigs.find(config => config.name === configName);
    if (newDefault) {
      setActiveConfig(newDefault);
    }
    
    addLog(`Configuration "${configName}" définie par défaut`, 'info');
  };
  
  // Sauvegarder l'historique des emails
  const saveEmailHistory = (emailData) => {
    // Ajouter le nouvel email à l'historique
    const updatedHistory = [
      {
        id: Date.now(),
        to: emailData.to.split(',').map(email => email.trim()),
        cc: emailData.cc ? emailData.cc.split(',').map(email => email.trim()) : [],
        bcc: emailData.bcc ? emailData.bcc.split(',').map(email => email.trim()) : [],
        subject: emailData.subject,
        body: emailData.body,
        htmlBody: emailData.htmlBody,
        useHtml: emailData.useHtml,
        timestamp: new Date().toISOString(),
      },
      ...emailHistory
    ].slice(0, 50); // Limiter à 50 entrées
    
    setEmailHistory(updatedHistory);
    localStorage.setItem('emailHistory', JSON.stringify(updatedHistory));
    
    // Mettre à jour les suggestions
    const recipients = [...new Set([...updatedHistory.flatMap(item => item.to)])];
    setRecipientSuggestions(recipients);
    
    const subjects = [...new Set(updatedHistory.map(item => item.subject))];
    setSubjectSuggestions(subjects);
    
    addLog('Email enregistré dans l\'historique', 'info');
  };
  
  // Auto-détection des paramètres SMTP
  const autoDetectSettings = () => {
    setAutoDetectLoading(true);
    addLog('Détection automatique des paramètres SMTP...', 'info');
    
    // Simulation de l'auto-détection basée sur le domaine de l'email
    setTimeout(() => {
      const emailDomain = newConfig.username.split('@')[1];
      
      if (!emailDomain) {
        alert("Veuillez entrer une adresse email complète pour l'auto-détection");
        setAutoDetectLoading(false);
        addLog("Échec de l'auto-détection : adresse email incomplète", 'error');
        return;
      }
      
      // Logique pour les fournisseurs communs
      let detectedSettings = {};
      
      if (emailDomain.includes('gmail.com')) {
        detectedSettings = {
          host: 'smtp.gmail.com',
          port: '587',
          encryption: 'tls'
        };
      } else if (emailDomain.includes('outlook.com') || emailDomain.includes('hotmail.com')) {
        detectedSettings = {
          host: 'smtp.office365.com',
          port: '587',
          encryption: 'tls'
        };
      } else if (emailDomain.includes('yahoo.com')) {
        detectedSettings = {
          host: 'smtp.mail.yahoo.com',
          port: '587',
          encryption: 'tls'
        };
      } else if (emailDomain.includes('lws.fr') || emailDomain.includes('lws-hosting.com')) {
        detectedSettings = {
          host: 'smtp.lws.fr',
          port: '587',
          encryption: 'tls'
        };
      } else {
        // Tentative générique
        detectedSettings = {
          host: `mail.${emailDomain}`,
          port: '587',
          encryption: 'tls'
        };
      }
      
      setNewConfig({
        ...newConfig,
        ...detectedSettings
      });
      
      setAutoDetectLoading(false);
      addLog(`Paramètres détectés pour ${emailDomain}: ${detectedSettings.host}:${detectedSettings.port}`, 'success');
    }, 1500);
  };
  
  // Tester la configuration SMTP
  const testConfiguration = () => {
    setTestStatus('loading');
    addLog(`Test de connexion à ${newConfig.host}:${newConfig.port}...`, 'info');
    
    // Simulation d'un test de connexion
    setTimeout(() => {
      // En production, cela serait remplacé par une vraie tentative de connexion SMTP
      const success = Math.random() > 0.3; // 70% de chances de succès pour la démo
      
      setTestStatus(success ? 'success' : 'error');
      
      if (success) {
        addLog(`Connexion réussie à ${newConfig.host}:${newConfig.port}`, 'success');
      } else {
        addLog(`Échec de connexion à ${newConfig.host}:${newConfig.port}`, 'error');
      }
      
      setTimeout(() => {
        setTestStatus(null);
      }, 3000);
    }, 2000);
  };
  
  // Sauvegarder un template
  const saveTemplate = () => {
    const templateName = prompt("Nom du template :");
    if (!templateName) return;
    
    // Vérifier si on utilise le HTML ou le texte brut
    const bodyContent = emailData.useHtml ? emailData.htmlBody : emailData.body;
    
    const newTemplate = {
      id: Date.now(),
      name: templateName,
      to: emailData.to,
      cc: emailData.cc,
      bcc: emailData.bcc,
      subject: emailData.subject,
      body: emailData.body,
      htmlBody: emailData.htmlBody,
      useHtml: emailData.useHtml
    };
    
    const updatedTemplates = [...savedTemplates, newTemplate];
    setSavedTemplates(updatedTemplates);
    localStorage.setItem('emailTemplates', JSON.stringify(updatedTemplates));
    
    addLog(`Template "${templateName}" sauvegardé avec succès`, 'success');
  };
  
  // Charger un template
  const loadTemplate = (template) => {
    setEmailData({
      ...emailData,
      to: template.to,
      cc: template.cc || '',
      bcc: template.bcc || '',
      subject: template.subject,
      body: template.body || '',
      htmlBody: template.htmlBody || '',
      useHtml: template.useHtml || false
    });
    setShowTemplatePanel(false);
    addLog(`Template "${template.name}" chargé`, 'info');
  };
  
  // Supprimer un template
  const deleteTemplate = (templateId) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce template ?")) {
      const template = savedTemplates.find(t => t.id === templateId);
      const updatedTemplates = savedTemplates.filter(template => template.id !== templateId);
      setSavedTemplates(updatedTemplates);
      localStorage.setItem('emailTemplates', JSON.stringify(updatedTemplates));
      
      if (template) {
        addLog(`Template "${template.name}" supprimé`, 'info');
      }
    }
  };
  
  // Envoyer un email
  const sendEmail = async () => {
    // Déterminer quelle configuration SMTP utiliser
    let smtpConfigToUse = null;
    
    if (activeGroup && activeGroup.configs.length > 0) {
      // Utiliser la rotation SMTP
      smtpConfigToUse = getNextSmtpConfig(activeGroup);
      if (!smtpConfigToUse) {
        alert("Aucune configuration SMTP valide trouvée dans le groupe de rotation");
        addLog("Échec: Aucune configuration SMTP valide dans le groupe de rotation", 'error');
        return;
      }
    } else if (activeConfig) {
      // Utiliser la configuration SMTP standard
      smtpConfigToUse = activeConfig;
    } else {
      alert("Veuillez sélectionner une configuration SMTP ou un groupe de rotation");
      addLog("Échec: Aucune configuration SMTP sélectionnée", 'error');
      return;
    }
    
    // Déterminer si on utilise la rotation de templates
    let emailContent = { ...emailData };
    
    // Si un groupe de templates est actif, utiliser le template en rotation
    if (activeTemplateGroup && activeTemplateGroup.templates.length > 0) {
      const templateToUse = getNextTemplate(activeTemplateGroup);
      if (templateToUse) {
        // On garde le destinataire actuel mais on prend le contenu du template en rotation
        emailContent = {
          ...emailData,
          subject: templateToUse.subject,
          body: templateToUse.body || '',
          htmlBody: templateToUse.htmlBody || '',
          useHtml: templateToUse.useHtml
        };
        addLog(`Utilisation du template "${templateToUse.name}" depuis le groupe de rotation`, 'info');
      } else {
        addLog("Attention: Impossible de trouver un template valide dans le groupe de rotation", 'warning');
      }
    }
    
    if (!emailContent.to || !emailContent.subject) {
      alert("Le destinataire et le sujet sont obligatoires");
      addLog("Échec: Destinataire ou sujet manquant", 'error');
      return;
    }
    
    setSendStatus('loading');
    setShowLogs(true);
    
    // Log de début d'envoi
    addLog(`Démarrage de l'envoi via ${smtpConfigToUse.host}:${smtpConfigToUse.port}${activeGroup ? ` (groupe: ${activeGroup.name})` : ''}`, 'info');
    addLog(`Destinataire(s): ${emailContent.to}`, 'info');
    addLog(`CC: ${emailContent.cc || 'Aucun'}`, 'info');
    addLog(`Sujet: ${emailContent.subject}`, 'info');
    addLog(`Type de contenu: ${emailContent.useHtml ? 'HTML' : 'Texte brut'}`, 'info');
    
    try {
      addLog(`Connexion à ${smtpConfigToUse.host}:${smtpConfigToUse.port}...`, 'info');
      
      // Préparer les données pour l'API
      const emailPayload = {
        smtpConfig: smtpConfigToUse,
        to: emailContent.to,
        cc: emailContent.cc,
        bcc: emailContent.bcc,
        subject: emailContent.subject,
        body: emailContent.body,
        htmlBody: emailContent.htmlBody,
        useHtml: emailContent.useHtml,
        senderName: smtpConfigToUse.senderName
      };
      
      addLog(`Authentification avec l'utilisateur ${smtpConfigToUse.username}...`, 'info');
      addLog(`Utilisation du chiffrement ${smtpConfigToUse.encryption.toUpperCase()}...`, 'info');
      addLog('Préparation du contenu de l\'email...', 'info');
      
      // Appel à l'API d'envoi d'email
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        addLog(`Email envoyé avec succès! ID: ${result.messageId}`, 'success');
        setSendStatus('success');
        
        // Sauvegarder dans l'historique
        saveEmailHistory(emailContent);
        
        // Réinitialiser le formulaire après un envoi réussi
        setEmailData({
          to: '',
          cc: '',
          bcc: '',
          subject: '',
          body: '',
          htmlBody: '',
          useHtml: emailContent.useHtml,
          attachments: []
        });
      } else {
        const errorMessage = result.message || result.error || 'Erreur inconnue';
        addLog(`Échec de l'envoi: ${errorMessage}`, 'error');
        setSendStatus('error');
      }
    } catch (error) {
      addLog(`Erreur lors de l'envoi: ${error.message}`, 'error');
      setSendStatus('error');
    }
    
    setTimeout(() => {
      setSendStatus(null);
    }, 3000);
  };
  
  // Gérer les pièces jointes
  const handleAttachments = (e) => {
    const files = Array.from(e.target.files);
    setEmailData({
      ...emailData,
      attachments: [...emailData.attachments, ...files]
    });
    
    addLog(`${files.length} fichier(s) ajouté(s)`, 'info');
  };
  
  // Supprimer une pièce jointe
  const removeAttachment = (index) => {
    const updatedAttachments = [...emailData.attachments];
    const removedFile = updatedAttachments[index];
    updatedAttachments.splice(index, 1);
    setEmailData({
      ...emailData,
      attachments: updatedAttachments
    });
    
    if (removedFile) {
      addLog(`Pièce jointe "${removedFile.name}" supprimée`, 'info');
    }
  };
  
  // Sauvegarder les données dans localStorage chaque fois qu'elles changent
  useEffect(() => {
    // Configurations SMTP
    if (smtpConfigs.length > 0) {
      localStorage.setItem('smtpConfigs', JSON.stringify(smtpConfigs));
    }
    
    // Groupes de rotation SMTP
    if (smtpGroups.length > 0) {
      localStorage.setItem('smtpGroups', JSON.stringify(smtpGroups));
    }
    
    // Groupes de rotation de templates
    if (templateGroups.length > 0) {
      localStorage.setItem('templateGroups', JSON.stringify(templateGroups));
    }
    
    // Emails envoyés
    if (emailHistory.length > 0) {
      localStorage.setItem('emailHistory', JSON.stringify(emailHistory));
    }
    
    // Templates
    if (savedTemplates.length > 0) {
      localStorage.setItem('emailTemplates', JSON.stringify(savedTemplates));
    }
  }, [smtpConfigs, smtpGroups, templateGroups, emailHistory, savedTemplates]);
  
  // Ajouter un groupe de rotation de templates
  const saveTemplateGroup = () => {
    if (!newTemplateGroup.name || newTemplateGroup.templates.length === 0) {
      alert('Veuillez spécifier un nom et sélectionner au moins un template');
      return;
    }
    
    if (editTemplateGroupMode) {
      // Mettre à jour le groupe existant
      const updatedGroups = templateGroups.map(group => 
        group.name === newTemplateGroup.name ? newTemplateGroup : group
      );
      setTemplateGroups(updatedGroups);
      
      // Mettre à jour activeTemplateGroup si c'est celui en cours d'édition
      if (activeTemplateGroup && activeTemplateGroup.name === newTemplateGroup.name) {
        setActiveTemplateGroup(newTemplateGroup);
      }
      
      addLog(`Groupe de rotation de templates "${newTemplateGroup.name}" mis à jour`, 'success');
    } else {
      // Vérifier si le nom existe déjà
      if (templateGroups.some(group => group.name === newTemplateGroup.name)) {
        alert('Un groupe avec ce nom existe déjà');
        return;
      }
      
      // Si c'est le premier groupe ou marqué comme par défaut
      const isFirstGroup = templateGroups.length === 0;
      
      // Si c'est le premier ou marqué comme par défaut, mettre à jour les autres
      const updatedGroups = newTemplateGroup.isDefault || isFirstGroup
        ? templateGroups.map(group => ({ ...group, isDefault: false }))
        : [...templateGroups];
      
      // Ajouter le nouveau groupe
      const groupToAdd = isFirstGroup 
        ? { ...newTemplateGroup, isDefault: true } 
        : newTemplateGroup;
        
      setTemplateGroups([...updatedGroups, groupToAdd]);
      
      // Définir comme actif si c'est le premier ou par défaut
      if (isFirstGroup || groupToAdd.isDefault) {
        setActiveTemplateGroup(groupToAdd);
      }
      
      addLog(`Nouveau groupe de rotation de templates "${newTemplateGroup.name}" ajouté`, 'success');
    }
    
    // Réinitialiser le formulaire
    setNewTemplateGroup({
      name: '',
      templates: [],
      rotationMethod: 'roundRobin',
      isDefault: false
    });
    
    setEditTemplateGroupMode(false);
    setShowTemplateGroupPanel(false);
  };
  
  // Supprimer un groupe de templates
  const deleteTemplateGroup = (groupName) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le groupe "${groupName}" ?`)) {
      const updatedGroups = templateGroups.filter(group => group.name !== groupName);
      setTemplateGroups(updatedGroups);
      
      // Si le groupe actif est supprimé, en définir un autre
      if (activeTemplateGroup && activeTemplateGroup.name === groupName) {
        const defaultGroup = updatedGroups.find(group => group.isDefault);
        if (defaultGroup) {
          setActiveTemplateGroup(defaultGroup);
        } else if (updatedGroups.length > 0) {
          setActiveTemplateGroup(updatedGroups[0]);
        } else {
          setActiveTemplateGroup(null);
        }
      }
      
      addLog(`Groupe de templates "${groupName}" supprimé`, 'info');
    }
  };
  
  // Éditer un groupe de templates
  const editTemplateGroup = (group) => {
    setNewTemplateGroup({ ...group });
    setEditTemplateGroupMode(true);
    setShowTemplateGroupPanel(true);
  };
  
  // Définir un groupe de templates comme défaut
  const setDefaultTemplateGroup = (groupName) => {
    const updatedGroups = templateGroups.map(group => ({
      ...group,
      isDefault: group.name === groupName
    }));
    setTemplateGroups(updatedGroups);
    
    // Mettre à jour activeTemplateGroup si nécessaire
    const newDefault = updatedGroups.find(group => group.name === groupName);
    if (newDefault) {
      setActiveTemplateGroup(newDefault);
    }
    
    addLog(`Groupe de templates "${groupName}" défini par défaut`, 'info');
  };
  
  // Obtenir le prochain template dans la rotation
  const getNextTemplate = (group) => {
    if (!group || group.templates.length === 0) return null;
    
    // Stocker l'index de rotation pour chaque groupe
    const rotationIndexKey = `templateRotationIndex-${group.name}`;
    let currentIndex = parseInt(localStorage.getItem(rotationIndexKey) || '0');
    
    let nextTemplate;
    
    if (group.rotationMethod === 'random') {
      // Sélection aléatoire
      const randomIndex = Math.floor(Math.random() * group.templates.length);
      nextTemplate = savedTemplates.find(template => template.id.toString() === group.templates[randomIndex]);
    } else {
      // Round robin (par défaut)
      nextTemplate = savedTemplates.find(template => template.id.toString() === group.templates[currentIndex]);
      
      // Incrémenter l'index pour la prochaine utilisation
      currentIndex = (currentIndex + 1) % group.templates.length;
      localStorage.setItem(rotationIndexKey, currentIndex.toString());
    }
    
    return nextTemplate || null;
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-800">
      {/* En-tête */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 py-4 px-6 shadow-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Mail className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-bold text-white">EmailPro SMTP</h1>
          </div>
          
          {/* Menu desktop */}
          <div className="hidden md:flex items-center space-x-2">
            <button 
              onClick={() => setShowTemplatePanel(!showTemplatePanel)}
              className="flex items-center bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-4 py-2 text-white transition-all"
            >
              <List className="w-5 h-5 mr-2" />
              <span>Templates</span>
            </button>
            <button 
              onClick={() => setShowTemplateGroupPanel(!showTemplateGroupPanel)}
              className="flex items-center bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-4 py-2 text-white transition-all"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              <span>Rotation Templates</span>
            </button>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-4 py-2 text-white transition-all"
            >
              <Clock className="w-5 h-5 mr-2" />
              <span>Historique</span>
            </button>
            <button 
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-4 py-2 text-white transition-all"
            >
              <Loader className="w-5 h-5 mr-2" />
              <span>Logs</span>
            </button>
            <button 
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className="flex items-center bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-4 py-2 text-white transition-all"
            >
              <Settings className="w-5 h-5 mr-2" />
              <span>Configuration</span>
            </button>
            <button 
              onClick={() => setShowGroupPanel(!showGroupPanel)}
              className="flex items-center bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-4 py-2 text-white transition-all"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              <span>Rotation SMTP</span>
            </button>
            
            {/* Boutons Admin et Déconnexion pour Desktop */}
            {isAdmin && (
              <a 
                href="/admin"
                className="flex items-center bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-all"
              >
                <Shield className="w-5 h-5 mr-2" />
                <span>Admin</span>
              </a>
            )}
            <button 
              onClick={onLogout}
              className="flex items-center bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all"
            >
              <LogIn className="w-5 h-5 mr-2 transform rotate-180" />
              <span>Déconnexion</span>
            </button>
          </div>
          
          {/* Menu mobile burger */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white p-2"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        {/* Menu mobile déroulant */}
        {mobileMenuOpen && (
          <div className="mt-4 md:hidden space-y-2">
            <button 
              onClick={() => {
                setShowTemplatePanel(!showTemplatePanel);
                setMobileMenuOpen(false);
              }}
              className="flex items-center w-full bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-4 py-2 text-white transition-all"
            >
              <List className="w-5 h-5 mr-2" />
              <span>Templates</span>
            </button>
            <button 
              onClick={() => {
                setShowTemplateGroupPanel(!showTemplateGroupPanel);
                setMobileMenuOpen(false);
              }}
              className="flex items-center w-full bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-4 py-2 text-white transition-all"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              <span>Rotation Templates</span>
            </button>
            <button 
              onClick={() => {
                setShowHistory(!showHistory);
                setMobileMenuOpen(false);
              }}
              className="flex items-center w-full bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-4 py-2 text-white transition-all"
            >
              <Clock className="w-5 h-5 mr-2" />
              <span>Historique</span>
            </button>
            <button 
              onClick={() => {
                setShowLogs(!showLogs);
                setMobileMenuOpen(false);
              }}
              className="flex items-center w-full bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-4 py-2 text-white transition-all"
            >
              <Loader className="w-5 h-5 mr-2" />
              <span>Logs</span>
            </button>
            <button 
              onClick={() => {
                setShowConfigPanel(!showConfigPanel);
                setMobileMenuOpen(false);
              }}
              className="flex items-center w-full bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-4 py-2 text-white transition-all"
            >
              <Settings className="w-5 h-5 mr-2" />
              <span>Configuration</span>
            </button>
            <button 
              onClick={() => {
                setShowGroupPanel(!showGroupPanel);
                setMobileMenuOpen(false);
              }}
              className="flex items-center w-full bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-4 py-2 text-white transition-all"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              <span>Rotation SMTP</span>
            </button>
            
            {/* Boutons Admin et Déconnexion pour Mobile */}
            {isAdmin && (
              <a 
                href="/admin"
                className="flex items-center w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-all"
              >
                <Shield className="w-5 h-5 mr-2" />
                <span>Panneau Admin</span>
              </a>
            )}
            <button 
              onClick={() => {
                onLogout();
                setMobileMenuOpen(false);
              }}
              className="flex items-center w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all"
            >
              <LogIn className="w-5 h-5 mr-2 transform rotate-180" />
              <span>Déconnexion</span>
            </button>
          </div>
        )}
      </header>
      
      <main className="flex flex-1 p-4">
        <div className="w-full max-w-6xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Panneau de configuration SMTP */}
          {showConfigPanel && (
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xl font-semibold mb-4">
                {editMode ? "Modifier la configuration" : "Nouvelle configuration SMTP"}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom de la configuration*</label>
                  <input 
                    type="text" 
                    value={newConfig.name} 
                    onChange={(e) => setNewConfig({...newConfig, name: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="ex: Gmail Pro"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Adresse email / Nom d'utilisateur*</label>
                  <div className="flex">
                    <input 
                      type="text" 
                      value={newConfig.username} 
                      onChange={(e) => setNewConfig({...newConfig, username: e.target.value})}
                      className="flex-1 p-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="email@domaine.com"
                    />
            <button 
                      onClick={autoDetectSettings}
                      disabled={autoDetectLoading}
                      className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 rounded-r-lg border border-l-0 border-gray-300 flex items-center"
                    >
                      {autoDetectLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span className="ml-1 text-sm hidden sm:inline">Auto</span>
            </button>
                  </div>
          </div>
          
                <div>
                  <label className="block text-sm font-medium mb-1">Nom d'expéditeur</label>
                  <input 
                    type="text" 
                    value={newConfig.senderName} 
                    onChange={(e) => setNewConfig({...newConfig, senderName: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="ex: Service Commercial"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Serveur SMTP*</label>
                  <input 
                    type="text" 
                    value={newConfig.host} 
                    onChange={(e) => setNewConfig({...newConfig, host: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="ex: smtp.domaine.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Port SMTP*</label>
                  <input 
                    type="text" 
                    value={newConfig.port} 
                    onChange={(e) => setNewConfig({...newConfig, port: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="ex: 587, 465, 25"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Mot de passe</label>
                  <input 
                    type="password" 
                    value={newConfig.password} 
                    onChange={(e) => setNewConfig({...newConfig, password: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Chiffrement</label>
                  <select 
                    value={newConfig.encryption} 
                    onChange={(e) => setNewConfig({...newConfig, encryption: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="none">Aucun</option>
                    <option value="ssl">SSL</option>
                    <option value="tls">TLS</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-4 border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Limitations d'envoi</h3>
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      id="enableRateLimits" 
                      checked={newConfig.rateLimits?.enabled ?? true} 
                      onChange={(e) => setNewConfig({
                        ...newConfig, 
                        rateLimits: {
                          ...(newConfig.rateLimits || {
                            perSecond: 2,
                            perMinute: 20,
                            perHour: 100,
                            perDay: 500
                          }), 
                          enabled: e.target.checked
                        }
                      })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="enableRateLimits" className="ml-2 text-sm">Activer les limites</label>
                  </div>
                </div>
                
                <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 ${!(newConfig.rateLimits?.enabled ?? true) && 'opacity-50'}`}>
                  <div>
                    <label className="block text-sm font-medium mb-1">Par seconde</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="100"
                      value={newConfig.rateLimits?.perSecond ?? 2} 
                      onChange={(e) => setNewConfig({
                        ...newConfig, 
                        rateLimits: {
                          ...(newConfig.rateLimits || {
                            perSecond: 2,
                            perMinute: 20,
                            perHour: 100,
                            perDay: 500
                          }), 
                          perSecond: parseInt(e.target.value)
                        }
                      })}
                      disabled={!(newConfig.rateLimits?.enabled ?? true)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Par minute</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="1000"
                      value={newConfig.rateLimits?.perMinute ?? 20} 
                      onChange={(e) => setNewConfig({
                        ...newConfig, 
                        rateLimits: {
                          ...(newConfig.rateLimits || {
                            perSecond: 2,
                            perMinute: 20,
                            perHour: 100,
                            perDay: 500
                          }), 
                          perMinute: parseInt(e.target.value)
                        }
                      })}
                      disabled={!(newConfig.rateLimits?.enabled ?? true)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Par heure</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="10000"
                      value={newConfig.rateLimits?.perHour ?? 100} 
                      onChange={(e) => setNewConfig({
                        ...newConfig, 
                        rateLimits: {
                          ...(newConfig.rateLimits || {
                            perSecond: 2,
                            perMinute: 20,
                            perHour: 100,
                            perDay: 500
                          }), 
                          perHour: parseInt(e.target.value)
                        }
                      })}
                      disabled={!(newConfig.rateLimits?.enabled ?? true)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Par jour</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="100000"
                      value={newConfig.rateLimits?.perDay ?? 500} 
                      onChange={(e) => setNewConfig({
                        ...newConfig, 
                        rateLimits: {
                          ...(newConfig.rateLimits || {
                            perSecond: 2,
                            perMinute: 20,
                            perHour: 100,
                            perDay: 500
                          }), 
                          perDay: parseInt(e.target.value)
                        }
                      })}
                      disabled={!(newConfig.rateLimits?.enabled ?? true)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 mt-2">
                  Ces limites aident à éviter les problèmes de blocage par les fournisseurs SMTP et améliorent le taux de livraison.
                </p>
              </div>
              
              <div className="flex items-center mb-4">
                <input 
                  type="checkbox" 
                  id="isDefault" 
                  checked={newConfig.isDefault} 
                  onChange={(e) => setNewConfig({...newConfig, isDefault: e.target.checked})}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="isDefault" className="ml-2 text-sm">Définir comme configuration par défaut</label>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
            <button
                    onClick={saveConfig}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {editMode ? "Mettre à jour" : "Enregistrer"}
                  </button>
                  
                  <button 
                    onClick={testConfiguration}
                    disabled={testStatus === 'loading'}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg flex items-center"
                  >
                    {testStatus === 'loading' ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : testStatus === 'success' ? (
                      <Check className="w-4 h-4 mr-2 text-green-500" />
                    ) : testStatus === 'error' ? (
                      <X className="w-4 h-4 mr-2 text-red-500" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Tester la connexion
                  </button>
                </div>
                
                <button 
                  onClick={() => {
                    setShowConfigPanel(false);
                    setEditMode(false);
                    setNewConfig({
                      name: '',
                      host: '',
                      port: '',
                      username: '',
                      password: '',
                      encryption: 'tls',
                      isDefault: false,
                      rateLimits: {
                        perSecond: 2,
                        perMinute: 20,
                        perHour: 100,
                        perDay: 500,
                        enabled: true
                      }
                    });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Annuler
                </button>
              </div>
              
              {/* Liste des configurations existantes */}
              {smtpConfigs.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-2">Configurations sauvegardées</h3>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <div className="overflow-hidden border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                              <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serveur</th>
                              <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateur</th>
                              <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Par défaut</th>
                              <th className="px-2 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {smtpConfigs.map((config, index) => (
                              <tr key={index} className={activeConfig && activeConfig.name === config.name ? "bg-blue-50" : ""}>
                                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm">
                                  <div className="max-w-[100px] sm:max-w-[120px] truncate">
                                    {config.name}
                                  </div>
                                </td>
                                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm">
                                  <div className="max-w-[100px] sm:max-w-[120px] truncate">
                                    {config.host}:{config.port}
                                  </div>
                                </td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">
                                  <div className="max-w-[100px] sm:max-w-[120px] truncate">
                                    {config.senderName ? (
                                      <span>{config.senderName} <br/><span className="text-xs text-gray-500">{config.username}</span></span>
                                    ) : (
                                      config.username
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm">
                                  {config.isDefault ? (
                                    <span className="text-green-600 flex items-center">
                                      <Check className="w-4 h-4 mr-1" /> Oui
                                    </span>
                                  ) : (
                                    <button 
                                      onClick={() => setDefaultConfig(config.name)}
                                      className="text-gray-500 hover:text-blue-600 text-sm"
                                    >
                                      Définir par défaut
                                    </button>
                                  )}
                                </td>
                                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-right text-xs sm:text-sm">
                                  <div className="flex justify-end space-x-2">
                                    <button 
                                      onClick={() => editConfig(config)}
                                      className="text-blue-600 hover:text-blue-800"
                                      title="Modifier"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => deleteConfig(config.name)}
                                      className="text-red-600 hover:text-red-800"
                                      title="Supprimer"
                                    >
                                      <Trash className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Panneau de gestion des groupes de rotation SMTP */}
          {showGroupPanel && (
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xl font-semibold mb-4">
                {editGroupMode ? "Modifier le groupe de rotation" : "Nouveau groupe de rotation SMTP"}
              </h2>
              
              <div className="grid grid-cols-1 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom du groupe*</label>
                  <input 
                    type="text" 
                    value={newGroup.name} 
                    onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="ex: Mes serveurs SMTP"
                    disabled={editGroupMode}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Méthode de rotation</label>
                  <select 
                    value={newGroup.rotationMethod} 
                    onChange={(e) => setNewGroup({...newGroup, rotationMethod: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="roundRobin">Round-Robin (à tour de rôle)</option>
                    <option value="random">Aléatoire</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Round-Robin alterne systématiquement entre les SMTP, Aléatoire en choisit un au hasard à chaque envoi.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Configurations SMTP à inclure*</label>
                  {smtpConfigs.length === 0 ? (
                    <div className="p-3 bg-yellow-50 text-yellow-800 rounded-lg">
                      Vous devez d'abord créer des configurations SMTP pour pouvoir les ajouter à un groupe.
                    </div>
                  ) : (
                    <div className="border border-gray-300 rounded-lg p-2 max-h-60 overflow-y-auto">
                      {smtpConfigs.map((config, index) => (
                        <div key={index} className="flex items-center p-2 hover:bg-gray-50 border-b last:border-b-0">
                          <input 
                            type="checkbox" 
                            id={`config-${index}`}
                            checked={newGroup.configs.includes(config.name)}
                            onChange={(e) => {
                              const updatedConfigs = e.target.checked
                                ? [...newGroup.configs, config.name]
                                : newGroup.configs.filter(name => name !== config.name);
                              setNewGroup({...newGroup, configs: updatedConfigs});
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={`config-${index}`} className="ml-2 flex-1 cursor-pointer">
                            <div className="font-medium">{config.name}</div>
                            <div className="text-xs text-gray-500">{config.host}:{config.port} - {config.username}</div>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center mb-4">
                <input 
                  type="checkbox" 
                  id="isDefaultGroup" 
                  checked={newGroup.isDefault} 
                  onChange={(e) => setNewGroup({...newGroup, isDefault: e.target.checked})}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="isDefaultGroup" className="ml-2 text-sm">Définir comme groupe par défaut</label>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <button 
                    onClick={saveSmtpGroup}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
                    disabled={smtpConfigs.length === 0}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {editGroupMode ? "Mettre à jour" : "Enregistrer le groupe"}
                  </button>
                </div>
                
                <button 
                  onClick={() => {
                    setShowGroupPanel(false);
                    setEditGroupMode(false);
                    setNewGroup({
                      name: '',
                      configs: [],
                      rotationMethod: 'roundRobin',
                      isDefault: false
                    });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Annuler
                </button>
              </div>
              
              {/* Liste des groupes existants */}
              {smtpGroups.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-2">Groupes de rotation sauvegardés</h3>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <div className="overflow-hidden border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                              <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Méthode</th>
                              <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Configurations</th>
                              <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Par défaut</th>
                              <th className="px-2 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {smtpGroups.map((group, index) => (
                              <tr key={index} className={activeGroup && activeGroup.name === group.name ? "bg-blue-50" : ""}>
                                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm">
                                  <div className="max-w-[100px] sm:max-w-[120px] truncate">
                                    {group.name}
                                  </div>
                                </td>
                                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm">
                                  {group.rotationMethod === 'roundRobin' ? 'Round-Robin' : 'Aléatoire'}
                                </td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">
                                  <div className="max-w-[120px] sm:max-w-[180px] truncate">
                                    {group.configs.length} configuration(s)
                                  </div>
                                </td>
                                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm">
                                  {group.isDefault ? (
                                    <span className="text-green-600 flex items-center">
                                      <Check className="w-4 h-4 mr-1" /> Oui
                                    </span>
                                  ) : (
                                    <button 
                                      onClick={() => setDefaultSmtpGroup(group.name)}
                                      className="text-gray-500 hover:text-blue-600 text-sm"
                                    >
                                      Définir par défaut
                                    </button>
                                  )}
                                </td>
                                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-right text-xs sm:text-sm">
                                  <div className="flex justify-end space-x-2">
                                    <button 
                                      onClick={() => editSmtpGroup(group)}
                                      className="text-blue-600 hover:text-blue-800"
                                      title="Modifier"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => deleteSmtpGroup(group.name)}
                                      className="text-red-600 hover:text-red-800"
                                      title="Supprimer"
                                    >
                                      <Trash className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Fenêtre de logs */}
          {showLogs && (
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Logs d'envoi</h2>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setLogs([])}
                    className="text-gray-600 hover:text-gray-800 text-sm bg-white hover:bg-gray-100 px-3 py-1 rounded border"
                  >
                    Effacer
                  </button>
                  <button 
                    onClick={() => setShowLogs(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Fermer
                  </button>
                </div>
              </div>
              
              <div className="bg-gray-900 text-gray-100 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
                {logs.length === 0 ? (
                  <p className="text-gray-400">Aucun log disponible. Les logs apparaîtront lors de l'envoi d'un email.</p>
                ) : (
                  logs.map((log) => (
                    <div 
                      key={log.id}
                      className={`mb-1 ${
                        log.type === 'error' 
                          ? 'text-red-400' 
                          : log.type === 'success'
                            ? 'text-green-400'
                            : log.type === 'warning'
                              ? 'text-yellow-400'
                              : 'text-blue-300'
                      }`}
                    >
                      <span className="text-gray-500">[{log.timestamp}]</span>{' '}
                      {log.type === 'error' && <AlertTriangle className="inline w-4 h-4 mr-1" />}
                      {log.type === 'success' && <Check className="inline w-4 h-4 mr-1" />}
                      {log.type === 'warning' && <AlertTriangle className="inline w-4 h-4 mr-1" />}
                      {log.type === 'info' && <Info className="inline w-4 h-4 mr-1" />}
                      {log.message}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
          
          {/* Panneau d'historique */}
          {showHistory && (
            <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <h2 className="text-xl font-semibold mb-2 sm:mb-0">Historique des envois</h2>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Fermer
                </button>
              </div>
              
              {emailHistory.length === 0 ? (
                <p className="text-gray-500">Aucun historique d'envoi disponible.</p>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden border rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destinataires</th>
                            <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sujet</th>
                            <th className="px-2 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {emailHistory.map((email, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm">
                                {new Date(email.timestamp).toLocaleString()}
                              </td>
                              <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">
                                <div className="max-w-[120px] sm:max-w-[180px] lg:max-w-xs truncate">
                                  {email.to.join(', ')}
                                </div>
                              </td>
                              <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">
                                <div className="max-w-[120px] sm:max-w-[180px] lg:max-w-xs truncate">
                                  {email.subject}
                                </div>
                              </td>
                              <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-right text-xs sm:text-sm">
                                <button 
                                  onClick={() => {
                                    setEmailData({
                                      ...emailData,
                                      to: email.to.join(', '),
                                      cc: email.cc ? email.cc.join(', ') : '',
                                      bcc: email.bcc ? email.bcc.join(', ') : '',
                                      subject: email.subject,
                                      body: email.body || '',
                                      htmlBody: email.htmlBody || '',
                                      useHtml: email.useHtml || false
                                    });
                                    setShowHistory(false);
                                    addLog(`Email réutilisé depuis l'historique: "${email.subject}"`, 'info');
                                  }}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  Réutiliser
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Panneau de templates */}
          {showTemplatePanel && (
            <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <h2 className="text-xl font-semibold mb-2 sm:mb-0">Templates d'emails</h2>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setShowTemplateGroupPanel(true)}
                    className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1 rounded-lg text-sm flex items-center"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Rotation de templates
                  </button>
                  <button 
                    onClick={() => setShowTemplatePanel(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Fermer
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                <button 
                  onClick={saveTemplate}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer template actuel
                </button>
              </div>
              
              {savedTemplates.length === 0 ? (
                <p className="text-gray-500">Aucun template disponible. Créez un email et cliquez sur "Enregistrer template actuel".</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedTemplates.map((template, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-lg truncate max-w-[180px]">{template.name}</h3>
                        <button 
                          onClick={() => deleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-800 ml-2 flex-shrink-0"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 mb-2 truncate">
                        <strong>À:</strong> {template.to}
                      </p>
                      <p className="text-sm text-gray-600 mb-2 truncate">
                        <strong>Sujet:</strong> {template.subject}
                      </p>
                      <p className="text-xs text-gray-500">
                        {template.useHtml ? 'Format HTML' : 'Format texte'}
                      </p>
                      <button 
                        onClick={() => loadTemplate(template)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm flex items-center mt-2"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Utiliser ce template
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Panneau de gestion des groupes de rotation de templates */}
          {showTemplateGroupPanel && (
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xl font-semibold mb-4">
                {editTemplateGroupMode ? "Modifier le groupe de templates" : "Nouveau groupe de rotation de templates"}
              </h2>
              
              <div className="grid grid-cols-1 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom du groupe*</label>
                  <input 
                    type="text" 
                    value={newTemplateGroup.name} 
                    onChange={(e) => setNewTemplateGroup({...newTemplateGroup, name: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="ex: Mes templates d'emails"
                    disabled={editTemplateGroupMode}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Méthode de rotation</label>
                  <select 
                    value={newTemplateGroup.rotationMethod} 
                    onChange={(e) => setNewTemplateGroup({...newTemplateGroup, rotationMethod: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="roundRobin">Round-Robin (à tour de rôle)</option>
                    <option value="random">Aléatoire</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Alterner entre différents templates aide à éviter la détection comme spam.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Templates à inclure*</label>
                  {savedTemplates.length === 0 ? (
                    <div className="p-3 bg-yellow-50 text-yellow-800 rounded-lg">
                      Vous devez d'abord créer des templates pour pouvoir les ajouter à un groupe.
                    </div>
                  ) : (
                    <div className="border border-gray-300 rounded-lg p-2 max-h-60 overflow-y-auto">
                      {savedTemplates.map((template, index) => (
                        <div key={index} className="flex items-center p-2 hover:bg-gray-50 border-b last:border-b-0">
                          <input 
                            type="checkbox" 
                            id={`template-${index}`}
                            checked={newTemplateGroup.templates.includes(template.id.toString())}
                            onChange={(e) => {
                              const updatedTemplates = e.target.checked
                                ? [...newTemplateGroup.templates, template.id.toString()]
                                : newTemplateGroup.templates.filter(id => id !== template.id.toString());
                              setNewTemplateGroup({...newTemplateGroup, templates: updatedTemplates});
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={`template-${index}`} className="ml-2 flex-1 cursor-pointer">
                            <div className="font-medium">{template.name}</div>
                            <div className="text-xs text-gray-500 truncate">Sujet: {template.subject}</div>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center mb-4">
                <input 
                  type="checkbox" 
                  id="isDefaultTemplateGroup" 
                  checked={newTemplateGroup.isDefault} 
                  onChange={(e) => setNewTemplateGroup({...newTemplateGroup, isDefault: e.target.checked})}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="isDefaultTemplateGroup" className="ml-2 text-sm">Définir comme groupe par défaut</label>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <button 
                    onClick={saveTemplateGroup}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
                    disabled={savedTemplates.length === 0}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {editTemplateGroupMode ? "Mettre à jour" : "Enregistrer le groupe"}
                  </button>
                </div>
                
                <button 
                  onClick={() => {
                    setShowTemplateGroupPanel(false);
                    setEditTemplateGroupMode(false);
                    setNewTemplateGroup({
                      name: '',
                      templates: [],
                      rotationMethod: 'roundRobin',
                      isDefault: false
                    });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Annuler
                </button>
              </div>
              
              {/* Liste des groupes existants */}
              {templateGroups.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-2">Groupes de rotation de templates</h3>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <div className="overflow-hidden border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                              <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Méthode</th>
                              <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Templates</th>
                              <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Par défaut</th>
                              <th className="px-2 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {templateGroups.map((group, index) => (
                              <tr key={index} className={activeTemplateGroup && activeTemplateGroup.name === group.name ? "bg-blue-50" : ""}>
                                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm">
                                  <div className="max-w-[100px] sm:max-w-[120px] truncate">
                                    {group.name}
                                  </div>
                                </td>
                                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm">
                                  {group.rotationMethod === 'roundRobin' ? 'Round-Robin' : 'Aléatoire'}
                                </td>
                                <td className="px-2 sm:px-4 py-2 text-xs sm:text-sm">
                                  <div className="max-w-[120px] sm:max-w-[180px] truncate">
                                    {group.templates.length} template(s)
                                  </div>
                                </td>
                                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm">
                                  {group.isDefault ? (
                                    <span className="text-green-600 flex items-center">
                                      <Check className="w-4 h-4 mr-1" /> Oui
                                    </span>
                                  ) : (
                                    <button 
                                      onClick={() => setDefaultTemplateGroup(group.name)}
                                      className="text-gray-500 hover:text-blue-600 text-sm"
                                    >
                                      Définir par défaut
                                    </button>
                                  )}
                                </td>
                                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-right text-xs sm:text-sm">
                                  <div className="flex justify-end space-x-2">
                                    <button 
                                      onClick={() => editTemplateGroup(group)}
                                      className="text-blue-600 hover:text-blue-800"
                                      title="Modifier"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => deleteTemplateGroup(group.name)}
                                      className="text-red-600 hover:text-red-800"
                                      title="Supprimer"
                                    >
                                      <Trash className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Formulaire d'envoi d'email */}
          <div className="p-6">
            {/* Sélection de configuration active */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Configuration d'envoi</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select 
                    value={activeGroup ? `group:${activeGroup.name}` : (activeConfig ? activeConfig.name : '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.startsWith('group:')) {
                        const groupName = value.replace('group:', '');
                        const selected = smtpGroups.find(group => group.name === groupName);
                        if (selected) {
                          setActiveGroup(selected);
                          setActiveConfig(null);
                        }
                      } else {
                        const selected = smtpConfigs.find(config => config.name === value);
                        if (selected) {
                          setActiveConfig(selected);
                          setActiveGroup(null);
                        }
                      }
                    }}
                    className="appearance-none w-full p-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <optgroup label="Configurations SMTP">
                      {smtpConfigs.map((config, index) => (
                        <option key={`config-${index}`} value={config.name}>
                          {config.name} {config.isDefault ? '(Par défaut)' : ''} - {config.username}
                        </option>
                      ))}
                    </optgroup>
                    
                    {smtpGroups.length > 0 && (
                      <optgroup label="Groupes de rotation">
                        {smtpGroups.map((group, index) => (
                          <option key={`group-${index}`} value={`group:${group.name}`}>
                            🔄 {group.name} {group.isDefault ? '(Par défaut)' : ''} - {group.configs.length} config(s)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
                
                {smtpConfigs.length > 0 && (
                  <button
                    onClick={() => setShowGroupPanel(true)} 
                    className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm flex-shrink-0 flex items-center"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Créer un groupe
                  </button>
                )}
              </div>
              
              {activeGroup && (
                <div className="mt-2 text-sm text-gray-500 flex items-center">
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Rotation {activeGroup.rotationMethod === 'roundRobin' ? 'Round-Robin' : 'Aléatoire'} avec {activeGroup.configs.length} configurations SMTP
                </div>
              )}
              
              {activeConfig && (
                <div className="mt-2 text-sm text-gray-500 flex items-center">
                  <Server className="w-4 h-4 mr-1" />
                  {activeConfig.host}:{activeConfig.port} • 
                  <Key className="w-4 h-4 mx-1" />
                  {activeConfig.encryption.toUpperCase()} • 
                  <User className="w-4 h-4 mx-1" />
                  {activeConfig.senderName ? `${activeConfig.senderName} <${activeConfig.username}>` : activeConfig.username}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Destinataire(s)*</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={emailData.to} 
                    onChange={(e) => {
                      setEmailData({...emailData, to: e.target.value});
                      setShowRecipientSuggestions(e.target.value.length > 0);
                    }}
                    onFocus={() => setShowRecipientSuggestions(emailData.to.length > 0)}
                    onBlur={() => setTimeout(() => setShowRecipientSuggestions(false), 200)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="email@example.com, autre@example.com"
                  />
                  {showRecipientSuggestions && recipientSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {recipientSuggestions
                        .filter(recipient => recipient.toLowerCase().includes(emailData.to.toLowerCase()))
                        .slice(0, 10)
                        .map((recipient, index) => (
                          <div 
                            key={index} 
                            className="p-2 hover:bg-blue-50 cursor-pointer text-sm"
                            onClick={() => {
                              // Vérifier si le destinataire n'est pas déjà dans la liste
                              const currentRecipients = emailData.to
                                .split(',')
                                .map(email => email.trim())
                                .filter(email => email !== '');
                              
                              if (!currentRecipients.includes(recipient)) {
                                // Ajouter le destinataire à la liste existante
                                const newRecipients = currentRecipients.length > 0
                                  ? [...currentRecipients, recipient].join(', ')
                                  : recipient;
                                
                                setEmailData({...emailData, to: newRecipients});
                              }
                              
                              setShowRecipientSuggestions(false);
                            }}
                          >
                            {recipient}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                {recipientSuggestions.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {recipientSuggestions.slice(0, 5).map((recipient, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          // Vérifier si le destinataire n'est pas déjà dans la liste
                          const currentRecipients = emailData.to
                            .split(',')
                            .map(email => email.trim())
                            .filter(email => email !== '');
                          
                          if (!currentRecipients.includes(recipient)) {
                            // Ajouter le destinataire à la liste existante
                            const newRecipients = currentRecipients.length > 0
                              ? [...currentRecipients, recipient].join(', ')
                              : recipient;
                            
                            setEmailData({...emailData, to: newRecipients});
                          }
                        }}
                        className="inline-flex items-center px-2 py-1 bg-gray-100 text-xs text-gray-800 rounded-md hover:bg-gray-200"
                      >
                        {recipient}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <button 
                  onClick={() => setAdvancedOptions(!advancedOptions)}
                  className="text-sm text-gray-600 hover:text-gray-800 flex items-center"
                >
                  {advancedOptions ? (
                    <ChevronUp className="w-4 h-4 mr-1" />
                  ) : (
                    <ChevronDown className="w-4 h-4 mr-1" />
                  )}
                  Options avancées (Cc, Bcc)
                </button>
                
                {advancedOptions && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Cc</label>
                      <input 
                        type="text" 
                        value={emailData.cc} 
                        onChange={(e) => setEmailData({...emailData, cc: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder="cc@example.com"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Bcc</label>
                      <input 
                        type="text" 
                        value={emailData.bcc} 
                        onChange={(e) => setEmailData({...emailData, bcc: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        placeholder="bcc@example.com"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Sujet*</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={emailData.subject} 
                    onChange={(e) => {
                      setEmailData({...emailData, subject: e.target.value});
                      setShowSubjectSuggestions(e.target.value.length > 0);
                    }}
                    onFocus={() => setShowSubjectSuggestions(emailData.subject.length > 0)}
                    onBlur={() => setTimeout(() => setShowSubjectSuggestions(false), 200)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Sujet de l'email"
                  />
                  {showSubjectSuggestions && subjectSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {subjectSuggestions
                        .filter(subject => subject.toLowerCase().includes(emailData.subject.toLowerCase()))
                        .slice(0, 10)
                        .map((subject, index) => (
                          <div 
                            key={index} 
                            className="p-2 hover:bg-blue-50 cursor-pointer text-sm"
                            onClick={() => {
                              setEmailData({...emailData, subject: subject});
                              setShowSubjectSuggestions(false);
                            }}
                          >
                            {subject}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                {subjectSuggestions.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {subjectSuggestions.slice(0, 5).map((subject, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setEmailData({...emailData, subject: subject});
                        }}
                        className="inline-flex items-center px-2 py-1 bg-gray-100 text-xs text-gray-800 rounded-md hover:bg-gray-200"
                      >
                        {subject}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 p-2 border-b border-gray-300 flex justify-between items-center">
                    <div className="flex">
                      <button
                        onClick={() => setEmailData({...emailData, useHtml: false})}
                        className={`px-3 py-1 rounded-l-lg ${!emailData.useHtml ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEmailData({...emailData, useHtml: true})}
                        className={`px-3 py-1 rounded-r-lg ${emailData.useHtml ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                      >
                        <Code className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center space-x-2">
                      {templateGroups.length > 0 && (
                        <div className="relative">
                          <select
                            value={activeTemplateGroup ? activeTemplateGroup.name : ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '') {
                                setActiveTemplateGroup(null);
                              } else {
                                const selected = templateGroups.find(group => group.name === value);
                                if (selected) {
                                  setActiveTemplateGroup(selected);
                                }
                              }
                            }}
                            className="text-sm appearance-none bg-white border border-gray-300 rounded-lg py-1 pl-3 pr-8 font-medium border-indigo-300 bg-indigo-50"
                          >
                            <option value="">Aucune rotation de template</option>
                            {templateGroups.map((group, index) => (
                              <option key={index} value={group.name}>
                                🔄 {group.name} ({group.templates.length} templates)
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-indigo-700">
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                      )}
                      
                      {emailData.useHtml && (
                        <button
                          onClick={() => setShowHtmlPreview(!showHtmlPreview)}
                          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          {showHtmlPreview ? "Masquer l'aperçu" : "Aperçu HTML"}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {activeTemplateGroup && (
                    <div className="bg-indigo-50 p-2 text-sm text-indigo-700 border-b border-indigo-100 flex items-center">
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" style={{animationDuration: '3s'}} />
                      <span>
                        Rotation active: <strong>{activeTemplateGroup.name}</strong> (
                        {activeTemplateGroup.rotationMethod === 'roundRobin' ? 'séquentiel' : 'aléatoire'}) 
                        avec {activeTemplateGroup.templates.filter(id => 
                          savedTemplates.some(template => template.id.toString() === id)
                        ).length} templates
                      </span>
                    </div>
                  )}
                  
                  {emailData.useHtml ? (
                    <div>
                      <textarea 
                        value={emailData.htmlBody} 
                        onChange={(e) => setEmailData({...emailData, htmlBody: e.target.value})}
                        rows={10}
                        className="w-full p-2 border-0 focus:ring-0 font-mono"
                        placeholder="<h1>Titre</h1><p>Votre contenu HTML ici...</p>"
                      ></textarea>
                      
                      {showHtmlPreview && (
                        <div className="border-t border-gray-300 p-4">
                          <div className="text-sm font-medium mb-2">Aperçu HTML:</div>
                          <div 
                            className="border border-gray-200 rounded-lg p-4 bg-white max-h-96 overflow-auto"
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
                                  <body>${emailData.htmlBody}</body>
                                </html>
                              `}
                              title="Aperçu HTML"
                              className="w-full border-0 min-h-[300px]"
                              sandbox="allow-same-origin"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <textarea 
                      value={emailData.body} 
                      onChange={(e) => setEmailData({...emailData, body: e.target.value})}
                      rows={10}
                      className="w-full p-2 border-0 focus:ring-0"
                      placeholder="Contenu de votre message..."
                    ></textarea>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Pièces jointes</label>
                <div className="flex items-center">
                  <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-4 rounded-lg flex items-center mr-2">
                    <input 
                      type="file" 
                      multiple 
                      onChange={handleAttachments}
                      className="hidden"
                    />
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Ajouter des fichiers
                    </span>
                  </label>
                  <span className="text-sm text-gray-500">
                    {emailData.attachments.length > 0 ? `${emailData.attachments.length} fichier(s) joint(s)` : "Aucun fichier joint"}
                  </span>
                </div>
                
                {emailData.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {emailData.attachments.map((file, index) => (
                      <div key={index} className="flex items-center bg-gray-100 text-gray-800 rounded-lg px-3 py-1 text-sm">
                        <span className="truncate max-w-xs">{file.name}</span>
                        <button 
                          onClick={() => removeAttachment(index)}
                          className="ml-2 text-gray-500 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-6">
              <div className="flex space-x-2">
                <button 
                  onClick={saveTemplate}
                  className="flex items-center bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg px-4 py-2"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Sauvegarder comme template
                </button>
                
                <button 
                  onClick={() => setShowBulkMode(true)}
                  className="flex items-center bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-lg px-4 py-2"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Mode envoi en masse
                </button>
              </div>
              <button 
                onClick={sendEmail}
                disabled={sendStatus === 'loading' || !activeConfig}
                className={`flex items-center rounded-lg px-6 py-3 font-medium ${
                  !activeConfig 
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed" 
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {sendStatus === 'loading' ? (
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                ) : sendStatus === 'success' ? (
                  <Check className="w-5 h-5 mr-2 text-green-500" />
                ) : sendStatus === 'error' ? (
                  <X className="w-5 h-5 mr-2 text-red-500" />
                ) : (
                  <Send className="w-5 h-5 mr-2" />
                )}
                {sendStatus === 'loading' 
                  ? "Envoi en cours..." 
                  : sendStatus === 'success' 
                    ? "Envoyé avec succès !" 
                    : sendStatus === 'error' 
                      ? "Échec de l'envoi" 
                      : "Envoyer l'email"
                }
              </button>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="bg-gray-100 py-3 px-6 text-center text-gray-600 text-sm">
        <p>EmailPro SMTP • Application d'envoi d'emails professionnelle</p>
      </footer>
      
      {/* Modale pour l'envoi en masse */}
      {showBulkMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-5xl w-full">
            <BulkEmailSender 
              onClose={() => setShowBulkMode(false)}
              smtpConfig={activeConfig}
              initialEmailData={{
                subject: emailData.subject,
                body: emailData.body,
                htmlBody: emailData.htmlBody,
                useHtml: emailData.useHtml
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailSender;