'use client';

import { PatientCase } from '@/types';
import { FileText, CheckCircle, Pill, Stethoscope, FileBarChart, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';

interface FinalClaimSummaryProps {
  clinicalNote: string;
  selectedCondition: string;
  selectedIcdCode: string;
  selectedIcdDescription: string;
  diagnosticTreatments: any[];
  ongoingTreatments: any[];
  medications: any[];
  medicationNote: string;
  selectedPlan: string;
  onConfirm: () => void;
  onBack: () => void;
  onNewClaim: () => void;
}

const FinalClaimSummary = ({
  clinicalNote,
  selectedCondition,
  selectedIcdCode,
  selectedIcdDescription,
  diagnosticTreatments,
  ongoingTreatments,
  medications,
  medicationNote,
  selectedPlan,
  onConfirm,
  onBack,
  onNewClaim,
}: FinalClaimSummaryProps) => {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <FileBarChart className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Final Claim Assembly</h2>
            <p className="text-sm text-gray-500">Review complete claim before submission</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Ready for Submission</p>
              <p className="text-sm text-blue-700 mt-1">
                All required components have been completed. Review the information below and confirm to finalize the claim.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Medical Plan */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-lg text-gray-900">Medical Plan</h3>
            </div>
            <p className="text-gray-700 font-medium">{selectedPlan}</p>
          </div>

          {/* Original Clinical Note */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-lg text-gray-900">Original Clinical Note</h3>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-gray-700 text-sm whitespace-pre-wrap">{clinicalNote}</p>
            </div>
          </div>

          {/* Confirmed Chronic Condition & ICD-10 */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Stethoscope className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-lg text-gray-900">Confirmed Diagnosis</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Chronic Condition</label>
                <p className="text-gray-900 font-medium mt-1">{selectedCondition}</p>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <label className="text-sm font-medium text-gray-500">ICD-10 Code</label>
                <p className="text-primary-600 font-semibold text-lg mt-1">{selectedIcdCode}</p>
                <p className="text-gray-600 text-sm mt-1">{selectedIcdDescription}</p>
              </div>
            </div>
          </div>

          {/* Diagnostic Basket Treatments */}
          {diagnosticTreatments.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileBarChart className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-lg text-gray-900">Diagnostic Basket</h3>
              </div>
              <div className="space-y-3">
                {diagnosticTreatments.map((treatment, index) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{treatment.description}</p>
                        <p className="text-sm text-gray-600 mt-1">Code: {treatment.code}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-700">
                          {treatment.timesCompleted} of {treatment.maxCovered}
                        </span>
                      </div>
                    </div>
                    {treatment.documentation?.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-500 mb-1">Documentation:</p>
                        <p className="text-sm text-gray-700">{treatment.documentation.notes}</p>
                      </div>
                    )}
                    {treatment.documentation?.findings && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-500 mb-1">Clinical Findings:</p>
                        <p className="text-sm text-gray-700">{treatment.documentation.findings}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ongoing Management Treatments */}
          {ongoingTreatments.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Stethoscope className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-lg text-gray-900">Ongoing Management</h3>
              </div>
              <div className="space-y-3">
                {ongoingTreatments.map((treatment, index) => (
                  <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{treatment.description}</p>
                        <p className="text-sm text-gray-600 mt-1">Code: {treatment.code}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                          {treatment.timesCompleted} of {treatment.maxCovered}
                        </span>
                      </div>
                    </div>
                    {treatment.documentation?.notes && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <p className="text-sm font-medium text-blue-600 mb-1">Documentation:</p>
                        <p className="text-sm text-gray-700">{treatment.documentation.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Medications */}
          {medications.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Pill className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-lg text-gray-900">Prescribed Medications</h3>
              </div>
              <div className="space-y-3">
                {medications.map((med, index) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{med.medicineNameAndStrength}</p>
                        <p className="text-sm text-gray-600 mt-1">{med.activeIngredient}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                          CDA: {med.cdaAmount}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Medication Registration Note */}
              {medicationNote && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-blue-900 mb-2">Chronic Medication Registration Note</p>
                  <p className="text-sm text-blue-700 whitespace-pre-wrap">{medicationNote}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-lg p-5">
          <h3 className="font-semibold text-lg text-gray-900 mb-3">Claim Summary</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">{diagnosticTreatments.length}</div>
              <div className="text-sm text-gray-600 mt-1">Diagnostic Tests</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{ongoingTreatments.length}</div>
              <div className="text-sm text-gray-600 mt-1">Ongoing Treatments</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{medications.length}</div>
              <div className="text-sm text-gray-600 mt-1">Medications</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">1</div>
              <div className="text-sm text-gray-600 mt-1">Chronic Condition</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mt-8 pt-6 border-t border-gray-200">
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="btn-secondary flex-1"
            >
              Back to Edit
            </button>
            <button
              onClick={onConfirm}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Confirm and Finalize Claim
            </button>
          </div>

          <button
            onClick={onNewClaim}
            className="w-full py-3 px-4 bg-gradient-to-r from-primary-600 to-blue-600 text-white font-semibold rounded-lg hover:from-primary-700 hover:to-blue-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            <FileText className="w-5 h-5" />
            Start New Claim
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalClaimSummary;
