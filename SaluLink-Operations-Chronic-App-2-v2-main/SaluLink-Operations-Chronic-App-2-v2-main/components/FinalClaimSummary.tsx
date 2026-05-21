'use client';

import { MedicationReport, PatientCase } from '@/types';
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
  medicationReports?: MedicationReport[];
  selectedPlan: string;
  onConfirm: () => void;
  onBack: () => void;
  confirmLabel?: string;
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
  medicationReports = [],
  selectedPlan,
  onConfirm,
  onBack,
  confirmLabel = 'Confirm and Save Claim',
}: FinalClaimSummaryProps) => {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center brand-gradient shadow-md">
            <FileBarChart className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Final Claim Assembly</h2>
            <p className="text-sm text-slate-500">Review complete claim before submission</p>
          </div>
        </div>

        <div className="brand-info-box border-2 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-violet-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-violet-800">Ready for Submission</p>
              <p className="text-sm text-violet-700 mt-1">
                All required components have been completed. Review the information below and confirm to finalize the claim.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Medical Plan */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-slate-900">Medical Plan</h3>
            </div>
            <p className="text-slate-700 font-medium">{selectedPlan}</p>
          </div>

          {/* Original Clinical Note */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-slate-900">Original Clinical Note</h3>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-slate-700 text-sm whitespace-pre-wrap">{clinicalNote}</p>
            </div>
          </div>

          {/* Confirmed Chronic Condition & ICD-10 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Stethoscope className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-slate-900">Confirmed Diagnosis</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-slate-500">Chronic Condition</p>
                <p className="text-slate-900 font-medium mt-1">{selectedCondition}</p>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <p className="text-xs font-medium text-slate-500">ICD-10 Code</p>
                <p className="text-blue-600 font-semibold text-lg mt-1">{selectedIcdCode}</p>
                <p className="text-slate-500 text-sm mt-1">{selectedIcdDescription}</p>
              </div>
            </div>
          </div>

          {/* Diagnostic Basket Treatments */}
          {diagnosticTreatments.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileBarChart className="w-5 h-5 text-slate-400" />
                <h3 className="font-semibold text-slate-900">Diagnostic Basket</h3>
              </div>
              <div className="space-y-3">
                {diagnosticTreatments.map((treatment, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{treatment.description}</p>
                        <p className="text-sm text-slate-500 mt-1">Code: {treatment.code}</p>
                      </div>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                        {treatment.timesCompleted} of {treatment.maxCovered}
                      </span>
                    </div>
                    {treatment.documentation?.notes && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs font-medium text-slate-500 mb-1">Documentation:</p>
                        <p className="text-sm text-slate-700">{treatment.documentation.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ongoing Management Treatments */}
          {ongoingTreatments.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Stethoscope className="w-5 h-5 text-slate-400" />
                <h3 className="font-semibold text-slate-900">Ongoing Management</h3>
              </div>
              <div className="space-y-3">
                {ongoingTreatments.map((treatment, index) => (
                  <div key={index} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{treatment.description}</p>
                        <p className="text-sm text-slate-500 mt-1">Code: {treatment.code}</p>
                      </div>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                        {treatment.timesCompleted} of {treatment.maxCovered}
                      </span>
                    </div>
                    {treatment.documentation?.notes && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <p className="text-xs font-medium text-blue-600 mb-1">Documentation:</p>
                        <p className="text-sm text-slate-700">{treatment.documentation.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Medications */}
          {medications.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Pill className="w-5 h-5 text-slate-400" />
                <h3 className="font-semibold text-slate-900">Prescribed Medications</h3>
              </div>
              <div className="space-y-3">
                {medications.map((med, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{med.medicineNameAndStrength}</p>
                        <p className="text-sm text-slate-500 mt-1">{med.activeIngredient}</p>
                      </div>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                        CDA: {med.cdaAmount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {medicationNote && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm font-semibold text-blue-700 mb-2">Chronic Medication Registration Note</p>
                  <p className="text-sm text-blue-600 whitespace-pre-wrap">{medicationNote}</p>
                </div>
              )}
            </div>
          )}

          {medicationReports.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Pill className="w-5 h-5 text-violet-600" />
                <h3 className="font-semibold text-slate-900">Medication Report Updates</h3>
              </div>
              <div className="space-y-4">
                {medicationReports.map((report, index) => (
                  <div key={report.id || index} className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                    <p className="text-xs font-medium text-violet-600 uppercase tracking-wide">
                      Report {index + 1}
                    </p>
                    {report.followUpNotes && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-slate-500">Follow-up notes</p>
                        <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{report.followUpNotes}</p>
                      </div>
                    )}
                    {report.newMedications.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-slate-500">New medications added</p>
                        <ul className="mt-2 space-y-1">
                          {report.newMedications.map((med, medIndex) => (
                            <li key={medIndex} className="text-sm text-slate-700">
                              {med.medicineNameAndStrength} ({med.activeIngredient})
                            </li>
                          ))}
                        </ul>
                        {report.motivationLetter && (
                          <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">
                            <span className="font-medium text-slate-500">Motivation: </span>
                            {report.motivationLetter}
                          </p>
                        )}
                      </div>
                    )}
                    {report.documentation?.notes && (
                      <div className="mt-3 pt-3 border-t border-violet-200">
                        <p className="text-xs font-medium text-slate-500">Documentation</p>
                        <p className="text-sm text-slate-700 mt-1">{report.documentation.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Claim Summary</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{diagnosticTreatments.length}</div>
              <div className="text-xs text-slate-500 mt-1">Diagnostic Tests</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-600">{ongoingTreatments.length}</div>
              <div className="text-xs text-slate-500 mt-1">Ongoing Treatments</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-600">{medications.length}</div>
              <div className="text-xs text-slate-500 mt-1">Medications</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-violet-600">1</div>
              <div className="text-xs text-slate-500 mt-1">Chronic Condition</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-slate-200">
          <button onClick={onBack} className="btn-secondary flex-1">
            Back to Edit
          </button>
          <button onClick={onConfirm} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalClaimSummary;
