# 🔍 Browser Console Test - Verify CSV Data Loading

## Quick Test to Verify COPD Data is Loading Correctly

This test will help you determine if the issue is browser cache or something else.

---

## Step 1: Open Browser Console

1. Open your app in the browser
2. Press **F12** (or right-click → Inspect)
3. Click on the **Console** tab

---

## Step 2: Run This Test Script

Copy and paste this entire script into the console and press Enter:

```javascript
// COPD Data Verification Test
(async function testCOPDData() {
  console.clear();
  console.log('🧪 Starting COPD Data Verification Test...\n');
  
  try {
    // Test 1: Fetch Chronic Conditions CSV
    console.log('📋 Test 1: Loading Chronic Conditions CSV...');
    const chronicResponse = await fetch('/Chronic Conditions.csv?v=' + Date.now());
    const chronicText = await chronicResponse.text();
    const chronicLines = chronicText.split('\n');
    
    // Count COPD entries
    const copdIcdCodes = chronicLines.filter(line => 
      line.toLowerCase().includes('chronic obstructive pulmonary disease (copd)')
    );
    
    console.log(`✅ Found ${copdIcdCodes.length} COPD ICD code entries`);
    console.log('📄 First COPD entry:', copdIcdCodes[0]);
    
    if (copdIcdCodes.length === 9) {
      console.log('✅ CORRECT: Expected 9 ICD codes, found 9');
    } else {
      console.error(`❌ WRONG: Expected 9 ICD codes, found ${copdIcdCodes.length}`);
      console.error('🔄 Your browser is using CACHED DATA! Clear cache and try again.');
    }
    
    // Test 2: Fetch Medicine List CSV
    console.log('\n📋 Test 2: Loading Medicine List CSV...');
    const medicineResponse = await fetch('/Medicine List.csv?v=' + Date.now());
    const medicineText = await medicineResponse.text();
    const medicineLines = medicineText.split('\n');
    
    // Count COPD medications
    const copdMeds = medicineLines.filter(line => 
      line.startsWith('Chronic obstructive pulmonary disease (COPD)')
    );
    
    console.log(`✅ Found ${copdMeds.length} COPD medication entries`);
    console.log('💊 First medication:', copdMeds[0]?.substring(0, 100) + '...');
    
    if (copdMeds.length === 7) {
      console.log('✅ CORRECT: Expected 7 medications, found 7');
    } else {
      console.error(`❌ WRONG: Expected 7 medications, found ${copdMeds.length}`);
      console.error('🔄 Your browser is using CACHED DATA! Clear cache and try again.');
    }
    
    // Test 3: Fetch Treatment Basket CSV
    console.log('\n📋 Test 3: Loading Treatment Basket CSV...');
    const basketResponse = await fetch('/Treatment Basket.csv?v=' + Date.now());
    const basketText = await basketResponse.text();
    const basketLines = basketText.split('\n');
    
    // Count COPD treatments
    const copdTreatments = basketLines.filter(line => 
      line.startsWith('Chronic obstructive pulmonary disease (COPD)')
    );
    
    console.log(`✅ Found ${copdTreatments.length} COPD treatment entries`);
    console.log('🏥 First treatment:', copdTreatments[0]?.substring(0, 100) + '...');
    
    if (copdTreatments.length === 3) {
      console.log('✅ CORRECT: Expected 3 treatments, found 3');
    } else {
      console.error(`❌ WRONG: Expected 3 treatments, found ${copdTreatments.length}`);
      console.error('🔄 Your browser is using CACHED DATA! Clear cache and try again.');
    }
    
    // Final Result
    console.log('\n' + '='.repeat(60));
    const allCorrect = copdIcdCodes.length === 9 && copdMeds.length === 7 && copdTreatments.length === 3;
    
    if (allCorrect) {
      console.log('✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅');
      console.log('CSV files are loading correctly.');
      console.log('If the app still shows "No ICD codes", it might be:');
      console.log('  1. DataService initialization issue');
      console.log('  2. Component not re-rendering after data load');
      console.log('  3. Condition name mismatch in the workflow');
    } else {
      console.log('❌ ❌ ❌ TESTS FAILED! ❌ ❌ ❌');
      console.log('Your browser is using CACHED CSV files!');
      console.log('\n🔧 SOLUTION:');
      console.log('  1. Close ALL browser tabs');
      console.log('  2. Clear browser cache (Ctrl+Shift+Delete)');
      console.log('  3. Open app in INCOGNITO MODE');
      console.log('  4. Run this test again');
    }
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
})();
```

---

## Step 3: Interpret Results

### ✅ If You See This:
```
✅ Found 9 COPD ICD code entries
✅ CORRECT: Expected 9 ICD codes, found 9
✅ Found 7 COPD medication entries
✅ CORRECT: Expected 7 medications, found 7
✅ Found 3 COPD treatment entries
✅ CORRECT: Expected 3 treatments, found 3
✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅
```

**Meaning**: CSV files are loading correctly! If the app still doesn't work:
- The issue is NOT browser cache
- Might be a component rendering issue
- Try refreshing the page
- Check if condition name is being passed correctly

### ❌ If You See This:
```
❌ WRONG: Expected 9 ICD codes, found 0
❌ WRONG: Expected 7 medications, found 0
❌ ❌ ❌ TESTS FAILED! ❌ ❌ ❌
```

**Meaning**: Your browser IS using cached files!
1. **Close ALL browser tabs/windows**
2. **Clear cache**: Ctrl+Shift+Delete → Select "Cached images and files" → Clear
3. **Open in INCOGNITO mode**: Ctrl+Shift+N (Chrome) or Ctrl+Shift+P (Firefox)
4. **Run test again**

---

## Alternative Quick Test

If you just want to quickly check the CSV files, paste this simpler version:

```javascript
// Quick COPD check
fetch('/Chronic Conditions.csv?v=' + Date.now())
  .then(r => r.text())
  .then(text => {
    const count = (text.match(/Chronic obstructive pulmonary disease \(COPD\)/g) || []).length;
    console.log(`COPD ICD codes found: ${count} (should be 9)`);
    console.log(count === 9 ? '✅ CORRECT' : '❌ WRONG - Clear cache!');
  });
```

---

## What Each Test Checks

1. **Test 1**: Verifies 9 ICD codes are in Chronic Conditions.csv
2. **Test 2**: Verifies 7 medications are in Medicine List.csv
3. **Test 3**: Verifies 3 treatments are in Treatment Basket.csv

All three must pass for the workflow to work correctly.

---

## Next Steps Based on Results

### If Tests PASS but App Still Doesn't Work

Run this additional test to check DataService:

```javascript
// Check if DataService is initialized
console.log('Checking DataService...');

// Wait for page to load completely
setTimeout(() => {
  // Try to access the DataService (this might fail if it's not exposed)
  console.log('Try entering a COPD clinical note and clicking Analyze.');
  console.log('Then open console and check for any errors.');
  console.log('Look for fetch errors or parsing errors.');
}, 1000);
```

### If Tests FAIL

**YOU MUST CLEAR BROWSER CACHE!**

Follow these steps exactly:
1. Close this browser completely (all windows)
2. Reopen browser
3. Press Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)
4. Select "Cached images and files"
5. Time range: "All time"
6. Click "Clear data"
7. Close browser again
8. Open in Incognito/Private mode
9. Navigate to your app
10. Run the test again

---

## Still Not Working?

If tests pass but COPD still doesn't work:

1. **Check browser console for errors** when you:
   - Click "Analyze Note"
   - Select COPD condition
   - Try to view ICD codes

2. **Look for these specific errors**:
   - `Failed to fetch`
   - `CSV parsing error`
   - `Cannot read property 'filter' of undefined`
   - `No ICD codes found`

3. **Share the error message** and we can debug further.

---

**TIP**: Save this test script for future use. Anytime you update CSV files, run this test to verify they're loading correctly!
