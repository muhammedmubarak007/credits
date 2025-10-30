/* Set your deployed Google Apps Script Web App URL here */
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwYQO8eJKoEThmKjWHmnJA4EvbuwpeEcbPpb1I86yEsbSC8ei-dM7-WpUHG6BO2HnEx/exec';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('creditForm');
  const submitBtn = document.getElementById('submitBtn');
  const errorBox = document.getElementById('formError');
  const toast = document.getElementById('toast');
  const configNotice = document.getElementById('configNotice');

  const nameInput = document.getElementById('name');
  const currentCreditsInput = document.getElementById('currentCredits');
  const durationSelect = document.getElementById('durationSelection');
  const subscriptionEndDateInput = document.getElementById('subscriptionEndDate');


  if (!GAS_WEB_APP_URL) {
    configNotice.classList.remove('hidden');
  }

  // Helpers for computing plan totals
  function parsePlan(pattern) {
    return pattern.split('-').map(x => Number(x.trim())).filter(n => Number.isFinite(n) && n >= 0);
  }
  function sumPlan(pattern) {
    return parsePlan(pattern).reduce((a, b) => a + b, 0);
  }

  function collectFormData() {
    const planPattern = durationSelect.value;
    const endDateIso = subscriptionEndDateInput.value ? subscriptionEndDateInput.value : '';
    const currentNum = Number(currentCreditsInput.value.trim() || '0');
    const planTotal = sumPlan(planPattern);
    const delta = planTotal - (Number.isFinite(currentNum) ? currentNum : 0);
    const creditAction = delta >= 0 ? 'add' : 'remove';
    const creditCount = String(Math.abs(delta));

    return {
      name: nameInput.value.trim(),
      plan: planPattern,
      plane: "'" + planPattern,
      planPattern,
      currentCredits: currentCreditsInput.value.trim(),
      subscriptionEndDate: endDateIso,
      creditAction,
      creditCount,
    };
  }

  function validate(payload) {
    if (!payload.name) return 'Name is required';
    const currentNum = Number(payload.currentCredits);
    if (!Number.isInteger(currentNum) || currentNum < 0) return 'Current credits must be a whole number ≥ 0';

    const allowedPlans = ['4-2-2', '4-4-2', '4-4-4-2-2-2', '4-2-2-2-2-2'];
    if (!allowedPlans.includes(payload.planPattern)) return 'Please select a valid plan';
    if (payload.subscriptionEndDate) {
      const d = new Date(payload.subscriptionEndDate);
      if (Number.isNaN(d.getTime())) return 'Invalid subscription end date';
    }
    const changeCountNum = Number(payload.creditCount);
    if (!Number.isInteger(changeCountNum) || changeCountNum < 0) return 'Credit count must be a whole number ≥ 0';
    return '';
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.querySelector('.btn-text').textContent = isLoading ? 'Saving…' : 'Save entry';
    submitBtn.querySelector('.btn-spinner').style.display = isLoading ? 'inline-block' : 'none';
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  function showError(message) {
    errorBox.textContent = message || '';
  }

  // No conditional listeners

  form.addEventListener('reset', () => {
    setTimeout(() => {
      showError('');
    }, 0);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = collectFormData();
    const validationError = validate(payload);
    if (validationError) {
      showError(validationError);
      return;
    }
    showError('');

    if (!GAS_WEB_APP_URL) {
      showError('Web App URL not configured. Please set GAS_WEB_APP_URL in app.js');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(payload).forEach(([key, value]) => {
        params.append(key, String(value == null ? '' : value));
      });

      const res = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: params.toString()
      });
      if (res.type === 'opaque') {
        showToast('Saved (no-cors)');
        form.reset();
        return;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        showError(`Save failed (HTTP ${res.status}). ${txt ? txt.slice(0, 120) : ''}`.trim());
        return;
      }
      const json = await res.json().catch(() => ({ ok: false, error: 'Invalid JSON response' }));
      if (json && json.ok) {
        showToast('Saved successfully');
        form.reset();
      } else {
        showError(json && json.error ? json.error : 'Save failed');
      }
    } catch (err) {
      showError(`Network error: ${err && err.message ? err.message : err}`);
    } finally {
      setLoading(false);
    }
  });
});
