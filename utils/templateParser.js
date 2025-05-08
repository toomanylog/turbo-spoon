/**
 * Utilitaire pour remplacer les variables dans les templates d'emails
 * Prend en charge les formats {{variable}} pour le remplacement
 */

/**
 * Remplace les variables dans un template par leurs valeurs
 * @param {string} template - Le texte contenant des variables au format {{nomVariable}}
 * @param {Object} data - Objet contenant les valeurs des variables
 * @returns {string} Le texte avec les variables remplacées
 */
export function parseTemplate(template, data) {
  if (!template) return '';
  if (!data) return template;
  
  // Remplacer les variables de base (firstName, lastName, email)
  let result = template;
  
  // Regex pour identifier les variables {{nomVariable}}
  const variableRegex = /{{([^{}]+)}}/g;
  
  // Remplacer toutes les variables trouvées
  result = result.replace(variableRegex, (match, variableName) => {
    const trimmedName = variableName.trim();
    
    // Vérifier d'abord dans les champs de base
    if (trimmedName in data) {
      return data[trimmedName] || '';
    }
    
    // Vérifier dans les champs personnalisés
    if (data.customFields && trimmedName in data.customFields) {
      return data.customFields[trimmedName] || '';
    }
    
    // Si la variable n'est pas trouvée, la laisser intacte ou la remplacer par une chaîne vide
    return ''; // Ou retourner match pour conserver la variable
  });
  
  return result;
}

/**
 * Remplace les variables dans un texte HTML par leurs valeurs
 * @param {string} htmlTemplate - Le contenu HTML avec des variables
 * @param {Object} variables - Objet contenant les valeurs des variables
 * @returns {string} Le HTML avec les variables remplacées
 */
export function parseHtmlTemplate(htmlTemplate, variables) {
  // Vérifier si le template est défini
  if (!htmlTemplate) return '';
  
  // Ne pas nettoyer le HTML - conserver le format exact
  let result = htmlTemplate;
  
  // Remplacer les variables par leurs valeurs
  if (variables) {
    // Regex pour identifier les variables {{nomVariable}}
    const variableRegex = /{{([^{}]+)}}/g;
    
    // Remplacer toutes les variables trouvées
    result = result.replace(variableRegex, (match, variableName) => {
      const trimmedName = variableName.trim();
      
      // Vérifier d'abord dans les champs de base
      if (trimmedName in variables) {
        return variables[trimmedName] || '';
      }
      
      // Vérifier dans les champs personnalisés
      if (variables.customFields && trimmedName in variables.customFields) {
        return variables.customFields[trimmedName] || '';
      }
      
      // Si la variable n'est pas trouvée, la remplacer par une chaîne vide
      return '';
    });
  }
  
  return result;
}

/**
 * Extrait les variables d'un template
 * @param {string} template - Le texte contenant des variables au format {{nomVariable}}
 * @returns {string[]} Tableau des noms de variables trouvées
 */
export function extractTemplateVariables(template) {
  if (!template) return [];
  
  const variableRegex = /{{([^{}]+)}}/g;
  const variables = [];
  let match;
  
  while ((match = variableRegex.exec(template)) !== null) {
    const variableName = match[1].trim();
    if (!variables.includes(variableName)) {
      variables.push(variableName);
    }
  }
  
  return variables;
}

/**
 * Vérifie si les données fournies contiennent toutes les variables nécessaires
 * @param {string} template - Le template contenant des variables
 * @param {Object} data - Les données à vérifier
 * @returns {Object} Résultat de la validation {isValid, missingVariables}
 */
export function validateTemplateData(template, data) {
  const variables = extractTemplateVariables(template);
  const missingVariables = [];
  
  for (const variable of variables) {
    let found = false;
    
    // Vérifier dans les champs de base
    if (variable in data) {
      found = true;
    }
    // Vérifier dans les champs personnalisés
    else if (data.customFields && variable in data.customFields) {
      found = true;
    }
    
    if (!found) {
      missingVariables.push(variable);
    }
  }
  
  return {
    isValid: missingVariables.length === 0,
    missingVariables
  };
} 