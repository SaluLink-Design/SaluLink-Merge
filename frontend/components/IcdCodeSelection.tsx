'use client';

import { useState, useEffect } from 'react';
import { Check, Search, FileText } from 'lucide-react';
import { ChronicCondition } from '@/types';
import { DataService } from '@/lib/dataService';

interface IcdCodeSelectionProps {
  condition: string;
  selectedIcdCode: string | null;
  onSelect: (icdCode: string, description: string) => void;
}

const IcdCodeSelection = ({ condition, selectedIcdCode, onSelect }: IcdCodeSelectionProps) => {
  const [icdCodes, setIcdCodes] = useState<ChronicCondition[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    const codes = DataService.getIcdCodesForCondition(condition);
    setIcdCodes(codes);
  }, [condition]);
  
  const filteredCodes = icdCodes.filter(code =>
    code.icdCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    code.icdDescription.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <div className="brand-icon">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Confirm ICD-10 code</h2>
          <p className="text-sm text-slate-500">
            Diagnosis: <span className="font-medium text-violet-600">{condition}</span>
            {' · '}
            Choose or refine the ICD-10 code for scheme submission
          </p>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            className="input-field pl-10"
            placeholder="Search ICD codes or descriptions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredCodes.map((code, index) => {
          const isSelected = selectedIcdCode === code.icdCode;
          
          return (
            <button
              key={`${code.icdCode}-${index}`}
              onClick={() => onSelect(code.icdCode, code.icdDescription)}
              className={`w-full text-left p-4 transition-all ${
                isSelected ? 'brand-card-selected' : 'brand-card'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-semibold text-violet-600">
                      {code.icdCode}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">
                    {code.icdDescription}
                  </p>
                </div>
                
                {isSelected ? (
                  <div className="brand-check">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <div className="w-6 h-6 border-2 border-slate-300 rounded-full flex-shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>
      
      {filteredCodes.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No ICD codes found matching your search.
        </div>
      )}
    </div>
  );
};

export default IcdCodeSelection;

