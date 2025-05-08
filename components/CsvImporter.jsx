import React, { useState, useRef } from 'react';
import { Upload, Table, ChevronDown, Info, Check, AlertTriangle } from 'lucide-react';

const CsvImporter = ({ onImportComplete }) => {
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mappings, setMappings] = useState({});
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: upload, 2: map fields, 3: preview
  
  const fileInputRef = useRef(null);
  
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsProcessing(true);
    setError(null);
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target.result;
        const lines = csv.split('\n');
        
        // Extraire les en-têtes (première ligne)
        const headerLine = lines[0].trim();
        
        // Essayer de détecter le séparateur (virgule, point-virgule, tabulation)
        const detectSeparator = (line) => {
          const separators = [',', ';', '\t'];
          const counts = separators.map(sep => (line.match(new RegExp(sep, 'g')) || []).length);
          const maxIndex = counts.indexOf(Math.max(...counts));
          return separators[maxIndex];
        };
        
        const separator = detectSeparator(headerLine);
        const headerValues = headerLine.split(separator).map(header => header.trim().replace(/^"|"$/g, ''));
        setHeaders(headerValues);
        
        // Initialiser les mappages par défaut
        const initialMappings = {};
        headerValues.forEach(header => {
          // Essayer de deviner les mappages standards
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes('email') || lowerHeader.includes('mail') || lowerHeader.includes('e-mail')) {
            initialMappings[header] = 'email';
          } else if (lowerHeader.includes('prénom') || lowerHeader.includes('prenom') || lowerHeader.includes('firstname') || lowerHeader.includes('first name')) {
            initialMappings[header] = 'firstName';
          } else if (lowerHeader.includes('nom') || lowerHeader.includes('lastname') || lowerHeader.includes('last name') || lowerHeader.includes('family name')) {
            initialMappings[header] = 'lastName';
          } else if (lowerHeader.includes('societe') || lowerHeader.includes('société') || lowerHeader.includes('company') || lowerHeader.includes('entreprise')) {
            initialMappings[header] = 'company';
          } else if (lowerHeader.includes('adresse') || lowerHeader.includes('address') || lowerHeader.includes('rue') || lowerHeader.includes('street') || lowerHeader.includes('voie')) {
            initialMappings[header] = 'address';
          } else if (lowerHeader.includes('ville') || lowerHeader.includes('city')) {
            initialMappings[header] = 'city';
          } else if (lowerHeader.includes('code postal') || lowerHeader.includes('cp') || lowerHeader.includes('zip') || lowerHeader.includes('postal') || lowerHeader.match(/^code$/) || lowerHeader.match(/^cp$/) || lowerHeader.match(/^zip$/)) {
            initialMappings[header] = 'zipCode';
          } else if (lowerHeader.includes('pays') || lowerHeader.includes('country')) {
            initialMappings[header] = 'country';
          } else {
            initialMappings[header] = '';
          }
        });
        setMappings(initialMappings);
        
        // Extraire les données
        const dataRows = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Utiliser le même séparateur pour les données
          const values = line.split(separator).map(value => value.trim().replace(/^"|"$/g, ''));
          
          if (values.length === headerValues.length) {
            const rowData = {};
            headerValues.forEach((header, index) => {
              rowData[header] = values[index];
            });
            dataRows.push(rowData);
          }
        }
        
        setCsvData(dataRows);
        
        if (dataRows.length > 0) {
          setStep(2); // Passer à l'étape de mappage
        } else {
          setError("Aucune donnée trouvée dans le fichier CSV.");
        }
        
      } catch (err) {
        setError("Erreur lors de l'analyse du fichier CSV. Assurez-vous que le format est correct.");
        console.error("CSV parsing error:", err);
      } finally {
        setIsProcessing(false);
      }
    };
    
    reader.onerror = () => {
      setError("Erreur lors de la lecture du fichier.");
      setIsProcessing(false);
    };
    
    reader.readAsText(file);
  };
  
  const handleMappingChange = (header, mappingType) => {
    setMappings(prev => ({
      ...prev,
      [header]: mappingType
    }));
  };
  
  const handleConfirmMapping = () => {
    // Vérifier qu'un champ email est mappé
    const hasEmailMapping = Object.values(mappings).includes('email');
    if (!hasEmailMapping) {
      setError("Vous devez associer un champ à l'email.");
      return;
    }
    
    setStep(3); // Passer à l'étape de prévisualisation
  };
  
  const handleConfirmImport = () => {
    // Transformer les données avec les mappages
    const transformedData = csvData.map(row => {
      const transformedRow = {
        email: '',
        firstName: '',
        lastName: '',
        address: '',
        zipCode: '',
        city: '',
        country: '',
        company: '',
        phone: '',
        customFields: {}
      };
      
      Object.keys(mappings).forEach(header => {
        const mappingType = mappings[header];
        const standardFields = ['email', 'firstName', 'lastName', 'address', 'zipCode', 'city', 'country', 'company', 'phone'];
        
        if (standardFields.includes(mappingType)) {
          transformedRow[mappingType] = row[header] || '';
        } else if (mappingType && mappingType !== '') {
          transformedRow.customFields[mappingType] = row[header] || '';
        }
      });
      
      return transformedRow;
    });
    
    // Filtrer les entrées sans email
    const validData = transformedData.filter(row => row.email.trim() !== '');
    
    if (validData.length === 0) {
      setError("Aucune adresse email valide trouvée après le mappage.");
      return;
    }
    
    onImportComplete(validData);
  };
  
  const resetImport = () => {
    setCsvData([]);
    setHeaders([]);
    setMappings({});
    setFileName('');
    setError(null);
    setStep(1);
    
    // Réinitialiser l'input de fichier
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Options de mappage disponibles
  const mappingOptions = [
    { value: '', label: 'Ne pas utiliser' },
    { value: 'email', label: 'Email' },
    { value: 'firstName', label: 'Prénom' },
    { value: 'lastName', label: 'Nom' },
    { value: 'company', label: 'Société' },
    { value: 'phone', label: 'Téléphone' },
    { value: 'address', label: 'Adresse' },
    { value: 'city', label: 'Ville' },
    { value: 'zipCode', label: 'Code postal' },
    { value: 'country', label: 'Pays' },
    { value: 'custom1', label: 'Champ personnalisé 1' },
    { value: 'custom2', label: 'Champ personnalisé 2' },
    { value: 'custom3', label: 'Champ personnalisé 3' }
  ];
  
  const renderStep1 = () => (
    <div className="text-center py-8">
      <input
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="hidden"
        ref={fileInputRef}
      />
      <div className="mb-6">
        <div 
          className="w-20 h-20 mx-auto bg-blue-50 rounded-full flex items-center justify-center cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-8 h-8 text-blue-600" />
        </div>
        <p className="mt-4 text-gray-700">
          Cliquez pour sélectionner un fichier CSV contenant vos destinataires
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Le fichier doit avoir au moins une colonne pour les adresses email
        </p>
      </div>
      
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-4 h-4 mr-2" />
        Importer un fichier CSV
      </button>
      
      {isProcessing && (
        <div className="mt-4 text-blue-600">
          Traitement en cours...
        </div>
      )}
      
      {error && (
        <div className="mt-4 text-red-600 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
    </div>
  );
  
  const renderStep2 = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Mapper les colonnes</h3>
        <div className="text-sm text-gray-500">
          Fichier: {fileName} ({csvData.length} lignes)
        </div>
      </div>
      
      <div className="mb-4 p-2 bg-blue-50 rounded-lg text-sm text-blue-800 flex items-start">
        <Info className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium mb-1">Comment fonctionne l'import :</p>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li>Associez chaque colonne du fichier CSV à un champ correspondant</li>
            <li>Au minimum, vous devez associer une colonne à l'email</li>
            <li>Les autres colonnes peuvent être utilisées comme variables personnalisées</li>
          </ol>
          <div className="mt-2 p-1 bg-white rounded border border-blue-200">
            <p className="font-medium mb-1 text-blue-700">Exemples de variables pour vos emails :</p>
            <span className="text-xs bg-blue-100 px-1 py-0.5 rounded">{"{{firstName}}"}</span>{' '}
            <span className="text-xs bg-blue-100 px-1 py-0.5 rounded">{"{{lastName}}"}</span>{' '}
            <span className="text-xs bg-blue-100 px-1 py-0.5 rounded">{"{{email}}"}</span>{' '}
            <span className="text-xs bg-blue-100 px-1 py-0.5 rounded">{"{{company}}"}</span>{' '}
            <span className="text-xs bg-blue-100 px-1 py-0.5 rounded">{"{{city}}"}</span>
          </div>
        </div>
      </div>
      
      <div className="border rounded-lg overflow-hidden mb-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Colonne CSV
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Associer à
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aperçu (première ligne)
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {headers.map((header, index) => (
              <tr key={index}>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                  {header}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <div className="relative">
                    <select
                      value={mappings[header]}
                      onChange={(e) => handleMappingChange(header, e.target.value)}
                      className="appearance-none w-full bg-white border border-gray-300 rounded-lg p-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {mappingOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 text-sm text-gray-500 truncate max-w-xs">
                  {csvData[0] && csvData[0][header]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {error && (
        <div className="mb-4 text-red-600 flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
      
      <div className="flex justify-between">
        <button
          onClick={resetImport}
          className="text-gray-600 hover:text-gray-800"
        >
          Annuler
        </button>
        <button
          onClick={handleConfirmMapping}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Continuer
        </button>
      </div>
    </div>
  );
  
  const renderStep3 = () => (
    <div>
      <h3 className="text-lg font-semibold mb-3">Prévisualisation des données</h3>
      <div className="mb-5 bg-blue-50 p-3 rounded-lg flex items-start">
        <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p>
            {csvData.length} enregistrements importés. {csvData.length === 0 ? "Aucun contact à importer." : ""}
          </p>
        </div>
      </div>
      
      {csvData.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden mb-5">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prénom</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adresse</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code Postal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ville</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {csvData.slice(0, 5).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {Object.keys(mappings).find(header => mappings[header] === 'email') ? row[Object.keys(mappings).find(header => mappings[header] === 'email')] : '-'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {Object.keys(mappings).find(header => mappings[header] === 'firstName') ? row[Object.keys(mappings).find(header => mappings[header] === 'firstName')] : '-'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {Object.keys(mappings).find(header => mappings[header] === 'lastName') ? row[Object.keys(mappings).find(header => mappings[header] === 'lastName')] : '-'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {Object.keys(mappings).find(header => mappings[header] === 'address') ? row[Object.keys(mappings).find(header => mappings[header] === 'address')] : '-'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {Object.keys(mappings).find(header => mappings[header] === 'zipCode') ? row[Object.keys(mappings).find(header => mappings[header] === 'zipCode')] : '-'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {Object.keys(mappings).find(header => mappings[header] === 'city') ? row[Object.keys(mappings).find(header => mappings[header] === 'city')] : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {csvData.length > 5 && (
            <div className="px-4 py-3 bg-gray-50 text-xs text-gray-500">
              + {csvData.length - 5} autres enregistrements
            </div>
          )}
        </div>
      )}
      
      <div className="mb-4 p-2 bg-green-50 rounded-lg text-sm text-green-800 flex items-start">
        <Check className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
        <div>
          Votre fichier CSV a été analysé avec succès. Cliquez sur "Importer" pour ajouter ces destinataires à votre liste d'envoi.
        </div>
      </div>
      
      <div className="flex justify-between">
        <button
          onClick={() => setStep(2)}
          className="text-gray-600 hover:text-gray-800"
        >
          Retour aux mappages
        </button>
        <button
          onClick={handleConfirmImport}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Importer {csvData.length} destinataires
        </button>
      </div>
    </div>
  );
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </div>
  );
};

export default CsvImporter; 