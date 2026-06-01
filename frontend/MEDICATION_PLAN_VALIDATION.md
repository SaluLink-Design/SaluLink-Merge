# Medication Plan Validation Feature

## Overview
The app now validates medication selections against the patient's medical plan and alerts/blocks doctors from selecting medications that are not covered by the patient's plan.

## How It Works

### 1. Plan Restrictions Parsing
The system automatically detects plan restrictions from the medication data in the `Medicine List.csv`. Two types of restrictions are supported:

#### "Only" Restrictions
Example: `Innuvair 120 dose 100/6mcg (Only Executive and Comprehensive plans)`
- These medications are **only available** on specific plans
- Attempting to select them on other plans will be blocked

#### "Not Available" Restrictions
Example: `Sereflo DPI 60 dose (Not available on KeyCare plans)`
- These medications are **not available** on specific plans
- KeyCare plans are mapped to Core plans in the system

### 2. Visual Indicators

When browsing medications, the app provides several visual cues:

- **Orange Badge**: "Not Covered by [Plan] Plan" - Shows when a medication is restricted
- **Orange Border**: Restricted medications have an orange border and reduced opacity
- **X Icon**: Blocked medications show an X icon instead of a checkmark
- **Coverage Notice**: A summary box shows how many medications are restricted for the current plan
- **Detailed Info**: Each restricted medication shows which plans it's available on

### 3. Blocking Mechanism

When a doctor attempts to select a restricted medication:
1. A clear alert dialog appears explaining:
   - Why the medication cannot be selected
   - Which plans support this medication
   - Suggested actions (select different medication or change patient's plan)
2. The medication is not added to the selection
3. The doctor can continue browsing other medications

### 4. Supported Plans

The system supports five medical plan types:
- **Core** (includes KeyCare)
- **Priority**
- **Saver**
- **Executive**
- **Comprehensive**

### 5. Integration with Existing Features

The plan validation works alongside existing validations:
- **Insulin Limits**: For diabetes patients, insulin monthly limits still apply
- **Duplicate Prevention**: Cannot select already prescribed medications
- **Plan-Based Pricing**: CDA amounts adjust based on plan selection

## Example Scenarios

### Scenario 1: Core Plan Patient
**Medication**: Innuvair 120 dose 100/6mcg (Only Executive and Comprehensive plans)
- **Result**: ❌ Blocked
- **Alert**: "This medication is only available on: Executive, Comprehensive plans"
- **Suggested Action**: Choose a different medication or upgrade patient's plan

### Scenario 2: Executive Plan Patient
**Medication**: Innuvair 120 dose 100/6mcg (Only Executive and Comprehensive plans)
- **Result**: ✅ Allowed
- **Behavior**: Medication can be selected normally

### Scenario 3: Core Plan Patient
**Medication**: Sereflo DPI 60 dose (Not available on KeyCare plans)
- **Result**: ❌ Blocked
- **Alert**: "This medication is not available on the Core plan"
- **Suggested Action**: Choose a different medication or upgrade patient's plan

## Technical Implementation

### Files Modified
1. **types/index.ts**: Added `planRestriction` field to `MedicineItem` interface
2. **lib/dataService.ts**: 
   - Added `parsePlanRestriction()` method to extract restrictions from CSV data
   - Added `isMedicationAllowedForPlan()` method to validate medications
3. **components/MedicationSelection.tsx**: 
   - Added plan validation in medication selection handler
   - Added visual indicators for restricted medications
   - Added coverage summary notice

### Data Format
Plan restrictions are automatically parsed from the medication name field using regex patterns:
```
/(Only\s+(.+?)\s+plans?)/i
/(Not\s+available\s+on\s+(.+?)\s+plans?)/i
```

## Benefits
- ✅ Prevents billing errors from selecting uncovered medications
- ✅ Improves compliance with medical scheme rules
- ✅ Clear communication to doctors about plan limitations
- ✅ Guides doctors to appropriate medication alternatives
- ✅ Reduces claim rejections and administrative overhead

## Future Enhancements
- Add ability to view all restricted medications for a plan
- Export plan coverage reports
- Add plan comparison view
- Integration with medical scheme APIs for real-time coverage verification
